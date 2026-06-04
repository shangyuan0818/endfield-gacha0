import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  classifyCharacterIdSource,
  classifyPoolIdSource,
} from '../src/utils/canonicalEntityUtils.js';
import { buildManualPlaceholderRetirementReport } from './lib/manualPlaceholderAudit.mjs';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

const DEFAULT_PAGE_SIZE = 1000;
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
    writeJson: null,
  };
  const positional = [];

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
      const pageSize = Number.parseInt(nextValue, 10);
      if (Number.isFinite(pageSize) && pageSize > 0) {
        options.pageSize = pageSize;
      }
      index += 1;
      continue;
    }

    if (arg === '--write-json' && nextValue) {
      options.writeJson = nextValue;
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (!options.writeJson && positional[0] && /\.json$/i.test(positional[0])) {
    options.writeJson = positional[0];
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
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

async function ensureEnvLoaded() {
  for (const candidate of ENV_FILE_CANDIDATES) {
    await loadEnvFile(candidate);
  }
}

function resolveSupabaseConfig(options) {
  const secretKey = resolveSupabaseSecretKey();
  const supabaseUrl = normalizeText(options.supabaseUrl) || resolveSupabaseUrl() || null;
  const supabaseKey = normalizeText(options.supabaseKey)
    || secretKey
    || resolveSupabasePublishableKey()
    || null;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少 Supabase 配置；请提供 --supabase-url / --supabase-key，或在 .env 中配置 SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    supabaseUrl,
    supabaseKey,
    authMode: normalizeText(options.supabaseKey) || (secretKey && supabaseKey === secretKey) ? 'service_role_or_custom' : 'anon_or_public',
  };
}

async function loadPagedRows(supabaseClient, { table, select, orderBy, pageSize }) {
  const rows = [];
  let pageIndex = 0;

  while (true) {
    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;
    let query = supabaseClient.from(table).select(select).range(from, to);
    if (orderBy) {
      query = query.order(orderBy, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`[${table}] ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }

    pageIndex += 1;
  }

  return rows;
}

function isMissingColumnError(error) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ].map(value => String(value || '')).join('\n');

  return !text.trim()
    || text.includes('does not exist')
    || text.includes('Could not find')
    || text.includes('column')
    || text.includes('PGRST204')
    || text.includes('42703');
}

async function countRowsByColumn(supabaseClient, { table, column, value, optionalMissingColumn = false }) {
  const { count, error } = await supabaseClient
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq(column, value);

  if (error) {
    if (optionalMissingColumn && isMissingColumnError(error)) {
      return {
        count: 0,
        missingColumn: true,
        error: error.message,
      };
    }

    throw new Error(`[${table}.${column}] ${error.message}`);
  }

  return {
    count: Number.isFinite(count) ? count : 0,
    missingColumn: false,
    error: null,
  };
}

function idsFrom(rows, keyName, classifyIdSource) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => normalizeText(row?.[keyName]))
    .filter(id => id && classifyIdSource(id) === 'manual_placeholder');
}

async function countHistoryReferences(supabaseClient, ids, column, { optionalMissingColumn = false } = {}) {
  const counts = {};
  let missingColumn = false;
  let missingColumnError = null;

  for (const id of ids) {
    const result = await countRowsByColumn(supabaseClient, {
      table: 'history',
      column,
      value: id,
      optionalMissingColumn,
    });
    counts[id] = result.count;
    if (result.missingColumn) {
      missingColumn = true;
      missingColumnError = result.error;
    }
  }

  return {
    counts,
    missingColumn,
    missingColumnError,
  };
}

function buildReferenceOverrides(ids, historyCounts) {
  return Object.fromEntries(
    ids.map(id => [id, { historyRows: historyCounts[id] || 0 }])
  );
}

async function writeOutputFile(filePath, data) {
  if (!filePath) {
    return null;
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return absolutePath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureEnvLoaded();
  const { supabaseUrl, supabaseKey, authMode } = resolveSupabaseConfig(options);
  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const [characters, pools, characterAliasRows, poolAliasRows, poolCharacterRows] = await Promise.all([
    loadPagedRows(supabaseClient, {
      table: 'characters',
      select: 'id, name, type',
      orderBy: 'id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'pools',
      select: 'pool_id, name, type, start_time, end_time, up_character, featured_characters',
      orderBy: 'pool_id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'character_id_aliases',
      select: 'source, alias_id, character_id, is_primary',
      orderBy: 'alias_id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'pool_id_aliases',
      select: 'source, alias_id, pool_id, is_primary',
      orderBy: 'alias_id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'pool_characters',
      select: 'pool_id, character_id',
      orderBy: 'pool_id',
      pageSize: options.pageSize,
    }),
  ]);

  const normalizedCharacters = characters.map(row => ({ ...row, source: 'supabase-characters' }));
  const normalizedPools = pools.map(row => ({ ...row, source: 'supabase-pools' }));
  const characterPlaceholderIds = idsFrom(normalizedCharacters, 'id', classifyCharacterIdSource);
  const poolPlaceholderIds = idsFrom(normalizedPools, 'pool_id', classifyPoolIdSource);

  const [historyCharacterReferences, historyPoolReferences] = await Promise.all([
    countHistoryReferences(supabaseClient, characterPlaceholderIds, 'character_id', {
      optionalMissingColumn: true,
    }),
    countHistoryReferences(supabaseClient, poolPlaceholderIds, 'pool_id'),
  ]);

  const manualPlaceholderRetirement = buildManualPlaceholderRetirementReport({
    characters: normalizedCharacters,
    pools: normalizedPools,
    characterAliasRows,
    poolAliasRows,
    poolCharacterRows,
    referenceCountOverrides: {
      characters: buildReferenceOverrides(characterPlaceholderIds, historyCharacterReferences.counts),
      pools: buildReferenceOverrides(poolPlaceholderIds, historyPoolReferences.counts),
    },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    target: (() => {
      try {
        return `${new URL(supabaseUrl).origin} (${authMode})`;
      } catch {
        return `Supabase (${authMode})`;
      }
    })(),
    mode: 'lightweight_placeholder_reference_snapshot',
    writesDatabase: false,
    schemaCapabilities: {
      historyCharacterId: !historyCharacterReferences.missingColumn,
      historyCharacterIdError: historyCharacterReferences.missingColumnError,
    },
    sourceCounts: {
      characterCount: characters.length,
      poolCount: pools.length,
      characterAliasRowCount: characterAliasRows.length,
      poolAliasRowCount: poolAliasRows.length,
      poolCharacterRowCount: poolCharacterRows.length,
      characterPlaceholderCount: characterPlaceholderIds.length,
      poolPlaceholderCount: poolPlaceholderIds.length,
    },
    candidateSourceRows: {
      characters: normalizedCharacters.map(row => ({
        id: row.id,
        name: row.name || null,
        type: row.type || null,
        source: row.source,
      })),
      pools: normalizedPools.map(row => ({
        pool_id: row.pool_id,
        name: row.name || null,
        type: row.type || null,
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        up_character: row.up_character || null,
        source: row.source,
      })),
      characterAliasRows: characterAliasRows.map(row => ({
        source: row.source || null,
        alias_id: row.alias_id || null,
        character_id: row.character_id || null,
        is_primary: row.is_primary === true,
      })),
      poolAliasRows: poolAliasRows.map(row => ({
        source: row.source || null,
        alias_id: row.alias_id || null,
        pool_id: row.pool_id || null,
        is_primary: row.is_primary === true,
      })),
    },
    manualPlaceholderRetirement,
  };

  const absoluteOutputPath = await writeOutputFile(options.writeJson, report);

  console.log('# DATA-NEW-018 轻量 placeholder 生产快照');
  console.log(`目标: ${report.target}`);
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`history.character_id 列存在: ${report.schemaCapabilities.historyCharacterId ? '是' : '否'}`);
  console.log(`角色/武器 placeholder: ${manualPlaceholderRetirement.summary.characterPlaceholderCount}，可迁移: ${manualPlaceholderRetirement.summary.readyCharacterMergeCount}，待官方 ID: ${manualPlaceholderRetirement.summary.characterNeedsOfficialIdCount}`);
  console.log(`卡池 placeholder: ${manualPlaceholderRetirement.summary.poolPlaceholderCount}，可迁移: ${manualPlaceholderRetirement.summary.readyPoolMergeCount}，待官方 ID: ${manualPlaceholderRetirement.summary.poolNeedsOfficialIdCount}`);
  console.log(`history.pool_id 手动引用: ${manualPlaceholderRetirement.summary.historyPoolManualReferenceCount}`);
  console.log(`history.character_id 手动引用: ${manualPlaceholderRetirement.summary.historyCharacterManualReferenceCount}`);
  console.log(`pool_characters 手动角色引用: ${manualPlaceholderRetirement.summary.poolCharacterManualCharacterReferenceCount}`);
  console.log(`pool_characters 手动卡池引用: ${manualPlaceholderRetirement.summary.poolCharacterManualPoolReferenceCount}`);
  if (absoluteOutputPath) {
    console.log(`已写出 JSON 报告: ${absoluteOutputPath}`);
  }
  console.log('注意：该脚本不写数据库；真正生产回填前仍需数据库快照、最新审计、人工确认 token 和回滚方案。');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[audit-manual-placeholder-production-snapshot] 执行失败:', error);
    process.exitCode = 1;
  });
}

export {
  parseArgs,
};
