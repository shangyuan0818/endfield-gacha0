import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

const MAX_API_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = MAX_API_PAGE_SIZE;
const DEFAULT_SAMPLE_LIMIT = 100;
const ENV_FILE_CANDIDATES = [
  '.env.local',
  '.env',
  path.join('backend', '.env.local'),
  path.join('backend', '.env'),
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: DEFAULT_PAGE_SIZE,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
    out: path.join('supabase', 'manual', 'history-snapshot-latest.ndjson'),
    summaryJson: path.join('supabase', 'manual', 'history-snapshot-summary.json'),
    duplicatesJson: path.join('supabase', 'manual', 'history-duplicate-samples.json'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--supabase-url' && nextValue) {
      options.supabaseUrl = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--supabase-key' && nextValue) {
      options.supabaseKey = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--page-size' && nextValue) {
      const parsed = Number.parseInt(nextValue, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        options.pageSize = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === '--sample-limit' && nextValue) {
      const parsed = Number.parseInt(nextValue, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        options.sampleLimit = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === '--out' && nextValue) {
      options.out = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--summary-json' && nextValue) {
      options.summaryJson = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--duplicates-json' && nextValue) {
      options.duplicatesJson = nextValue;
      index += 1;
    }
  }

  return options;
}

async function loadEnvFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const contents = await fs.readFile(absolutePath, 'utf8').catch(() => null);
  if (!contents) {
    return;
  }

  contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=');
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

async function hydrateEnvFiles() {
  for (const candidate of ENV_FILE_CANDIDATES) {
    await loadEnvFile(candidate);
  }
}

function resolveCredentials(options) {
  const supabaseUrl = normalizeText(options.supabaseUrl) || resolveSupabaseUrl();
  const serviceRoleKey = resolveSupabaseSecretKey();
  const explicitKey = normalizeText(options.supabaseKey);
  const publicKey = resolveSupabasePublishableKey();
  const supabaseKey = explicitKey || serviceRoleKey || publicKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少 Supabase URL 或可用密钥；请配置 SUPABASE_URL/VITE_SUPABASE_URL 与 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    supabaseUrl,
    supabaseKey,
    usingServiceRole: Boolean(serviceRoleKey && supabaseKey === serviceRoleKey),
  };
}

async function fetchExactCount(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return Number(count || 0);
}

async function fetchHistoryPage(supabase, afterId, limit) {
  let query = supabase
    .from('history')
    .select('*')
    .order('id', { ascending: true })
    .limit(limit);

  if (afterId !== null && afterId !== undefined) {
    query = query.gt('id', afterId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function buildCompositeKey(row) {
  return [
    normalizeText(row.user_id),
    normalizeText(row.game_uid),
    normalizeText(row.pool_id),
    normalizeText(row.seq_id),
  ].join('|');
}

function toSlimRow(row) {
  return {
    id: row.id ?? null,
    user_id: row.user_id ?? null,
    game_uid: row.game_uid ?? null,
    pool_id: row.pool_id ?? null,
    seq_id: row.seq_id ?? null,
    record_id: row.record_id ?? null,
    batch_id: row.batch_id ?? null,
    rarity: row.rarity ?? null,
    item_name: row.item_name ?? null,
    character_name: row.character_name ?? null,
    special_type: row.special_type ?? null,
    is_free: row.is_free ?? null,
    timestamp: row.timestamp ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(path.resolve(process.cwd(), filePath)), { recursive: true });
}

async function exportHistorySnapshot(options) {
  await hydrateEnvFiles();
  const { supabaseUrl, supabaseKey, usingServiceRole } = resolveCredentials(options);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        'x-codex-task': 'export-history-snapshot',
      },
    },
  });

  await ensureParentDir(options.out);
  await ensureParentDir(options.summaryJson);
  await ensureParentDir(options.duplicatesJson);

  const effectivePageSize = Math.min(options.pageSize, MAX_API_PAGE_SIZE);
  const totalRows = await fetchExactCount(supabase, 'history');
  await fs.writeFile(path.resolve(process.cwd(), options.out), '', 'utf8');

  const compositeCounts = new Map();
  const duplicateSamples = new Map();
  let processedRows = 0;
  let lastId = null;

  while (processedRows < totalRows) {
    const rows = await fetchHistoryPage(supabase, lastId, effectivePageSize);
    if (rows.length === 0) {
      break;
    }

    const lines = rows.map((row) => {
      const key = buildCompositeKey(row);
      const nextCount = (compositeCounts.get(key) || 0) + 1;
      compositeCounts.set(key, nextCount);

      if (nextCount >= 2) {
        const bucket = duplicateSamples.get(key) || [];
        if (bucket.length < 5) {
          bucket.push(toSlimRow(row));
          duplicateSamples.set(key, bucket);
        }
      }

      return JSON.stringify(row);
    });

    if (lines.length > 0) {
      await fs.appendFile(path.resolve(process.cwd(), options.out), `${lines.join('\n')}\n`, 'utf8');
    }

    lastId = rows.at(-1)?.id ?? lastId;
    processedRows += rows.length;
    console.log(`[history-export] ${processedRows}/${totalRows}`);
  }

  const duplicateEntries = Array.from(compositeCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .slice(0, options.sampleLimit)
    .map(([key, count]) => {
      const [user_id, game_uid, pool_id, seq_id] = key.split('|');
      return {
        user_id,
        game_uid,
        pool_id,
        seq_id,
        count,
        samples: duplicateSamples.get(key) || [],
      };
    });

  const summary = {
    exportedAt: new Date().toISOString(),
    totalRows,
    effectivePageSize,
    usingServiceRole,
    output: path.resolve(process.cwd(), options.out),
    duplicateCompositeKeyCount: Array.from(compositeCounts.values()).filter(count => count > 1).length,
    topDuplicateKeys: duplicateEntries.slice(0, 20).map(({ samples, ...rest }) => rest),
  };

  await fs.writeFile(
    path.resolve(process.cwd(), options.summaryJson),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );

  await fs.writeFile(
    path.resolve(process.cwd(), options.duplicatesJson),
    `${JSON.stringify(duplicateEntries, null, 2)}\n`,
    'utf8'
  );

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await exportHistorySnapshot(options);
}

main().catch((error) => {
  console.error('[history-export] failed:', error?.message || error);
  process.exitCode = 1;
});
