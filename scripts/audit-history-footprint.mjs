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
const ENV_FILE_CANDIDATES = [
  '.env.local',
  '.env',
  path.join('backend', '.env.local'),
  path.join('backend', '.env'),
];

const BASE_HISTORY_COLUMNS = [
  'id',
  'user_id',
  'pool_id',
  'record_id',
  'special_type',
  'is_free',
  'timestamp',
  'created_at'
];

const OPTIONAL_HISTORY_COLUMNS = [
  'game_uid',
  'seq_id',
  'batch_id',
  'server_id',
  'region',
  'is_simulated'
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: DEFAULT_PAGE_SIZE,
    writeJson: null
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

    if (arg === '--write-json' && nextValue) {
      options.writeJson = nextValue;
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

function detectMissingColumn(error) {
  const message = String(error?.message || '');
  const match = /column(?:\s+[A-Za-z0-9_]+\.)?['"]?([A-Za-z0-9_]+)['"]?\s+does not exist/i.exec(message)
    || /Could not find the ['"]([A-Za-z0-9_]+)['"] column/i.exec(message);

  return match?.[1] || null;
}

async function fetchHistoryPage(supabase, columns, afterId, limit) {
  let query = supabase
    .from('history')
    .select(columns.join(','))
    // Keyset pagination keeps long scans stable and avoids high-offset timeouts.
    .order('id', { ascending: true })
    .limit(limit);

  if (afterId !== null && afterId !== undefined) {
    query = query.gt('id', afterId);
  }

  const { data, error } = await query;

  if (!error) {
  return {
    rows: Array.isArray(data) ? data : [],
    columns
  };
  }

  const missingColumn = detectMissingColumn(error);
  if (!missingColumn || !columns.includes(missingColumn)) {
    throw error;
  }

  const reducedColumns = columns.filter((column) => column !== missingColumn);
  return fetchHistoryPage(supabase, reducedColumns, afterId, limit);
}

async function fetchPoolMap(supabase) {
  const { data, error } = await supabase
    .from('pools')
    .select('pool_id, name, type');

  if (error) {
    throw error;
  }

  const poolMap = new Map();
  (data || []).forEach((row) => {
    if (!row?.pool_id) {
      return;
    }

    poolMap.set(row.pool_id, {
      pool_id: row.pool_id,
      name: row.name || row.pool_id,
      type: row.type || null
    });
  });

  return poolMap;
}

function incrementCounter(map, key, amount = 1) {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) || 0) + amount);
}

function pickTopEntries(map, limit, formatter = null) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0]), 'zh-CN'))
    .slice(0, limit)
    .map(([key, count]) => (formatter ? formatter(key, count) : { key, count }));
}

function toMonthBucket(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  return raw.slice(0, 7);
}

function toRecentAgeBucket(value, now) {
  const raw = normalizeText(value);
  if (!raw) {
    return 'unknown';
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return 'unknown';
  }

  const diffMs = now.getTime() - parsed.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);

  if (diffDays <= 30) {
    return '0-30d';
  }
  if (diffDays <= 90) {
    return '31-90d';
  }
  if (diffDays <= 180) {
    return '91-180d';
  }
  if (diffDays <= 365) {
    return '181-365d';
  }

  return '365d+';
}

async function auditHistoryFootprint(supabase, { pageSize }) {
  const effectivePageSize = Math.min(pageSize, MAX_API_PAGE_SIZE);
  const totalHistoryRows = await fetchExactCount(supabase, 'history');
  const poolMap = await fetchPoolMap(supabase);
  const now = new Date();

  const userCounts = new Map();
  const userGameUidCounts = new Map();
  const poolCounts = new Map();
  const batchCounts = new Map();
  const createdMonthCounts = new Map();
  const timestampMonthCounts = new Map();
  const createdAgeBuckets = new Map();
  const serverCounts = new Map();
  const regionCounts = new Map();
  const compositeSeen = new Set();
  const duplicateCompositeKeys = new Set();

  let freeRows = 0;
  let giftRows = 0;
  let guaranteedRows = 0;
  let missingGameUidRows = 0;
  let missingSeqIdRows = 0;
  let missingBatchIdRows = 0;
  let simulatedRows = 0;
  let activeColumns = [...BASE_HISTORY_COLUMNS, ...OPTIONAL_HISTORY_COLUMNS];
  let processedRows = 0;
  let lastId = null;

  while (processedRows < totalHistoryRows) {
    const { rows, columns } = await fetchHistoryPage(supabase, activeColumns, lastId, effectivePageSize);
    activeColumns = columns;
    if (rows.length === 0) {
      break;
    }

    rows.forEach((row) => {
      incrementCounter(userCounts, row.user_id);
      incrementCounter(
        userGameUidCounts,
        row.game_uid ? `${row.user_id}::${row.game_uid}` : `${row.user_id}::(missing)`
      );
      incrementCounter(poolCounts, row.pool_id);
      incrementCounter(batchCounts, row.batch_id || '(missing)');
      incrementCounter(createdMonthCounts, toMonthBucket(row.created_at) || '(missing)');
      incrementCounter(timestampMonthCounts, toMonthBucket(row.timestamp) || '(missing)');
      incrementCounter(createdAgeBuckets, toRecentAgeBucket(row.created_at, now));
      incrementCounter(serverCounts, normalizeText(row.server_id) || '(missing)');
      incrementCounter(regionCounts, normalizeText(row.region) || '(missing)');

      if (row.is_free === true) {
        freeRows += 1;
      }

      if (row.special_type === 'gift') {
        giftRows += 1;
      }

      if (row.special_type === 'guaranteed') {
        guaranteedRows += 1;
      }

      if (row.is_simulated === true) {
        simulatedRows += 1;
      }

      if (!normalizeText(row.game_uid)) {
        missingGameUidRows += 1;
      }

      if (row.seq_id === null || row.seq_id === undefined || row.seq_id === '') {
        missingSeqIdRows += 1;
      }

      if (!normalizeText(row.batch_id)) {
        missingBatchIdRows += 1;
      }

      const gameUid = normalizeText(row.game_uid);
      const seqId = row.seq_id === null || row.seq_id === undefined || row.seq_id === '' ? null : String(row.seq_id);
      if (gameUid && seqId && row.pool_id && row.user_id) {
        const compositeKey = `${row.user_id}::${gameUid}::${row.pool_id}::${seqId}`;
        if (compositeSeen.has(compositeKey)) {
          duplicateCompositeKeys.add(compositeKey);
        } else {
          compositeSeen.add(compositeKey);
        }
      }
    });

    lastId = rows.at(-1)?.id ?? lastId;
    processedRows += rows.length;
    console.log(`[audit-history-footprint] 已处理 ${processedRows}/${totalHistoryRows}`);
  }

  const topUsers = pickTopEntries(userCounts, 20, (key, count) => ({ user_id: key, count }));
  const topUserGameUids = pickTopEntries(userGameUidCounts, 20, (key, count) => {
    const [user_id, game_uid] = String(key).split('::');
    return { user_id, game_uid, count };
  });
  const topPools = pickTopEntries(poolCounts, 20, (key, count) => {
    const poolMeta = poolMap.get(key);
    return {
      pool_id: key,
      name: poolMeta?.name || key,
      type: poolMeta?.type || null,
      count
    };
  });
  const topBatches = pickTopEntries(batchCounts, 20, (key, count) => ({
    batch_id: key,
    count
  }));

  const top10UserRows = topUsers.slice(0, 10).reduce((sum, item) => sum + item.count, 0);
  const top50UserRows = topUsers.slice(0, 20).reduce((sum, item) => sum + item.count, 0);

  return {
    totalHistoryRows,
    effectivePageSize,
    activeColumns,
    totals: {
      freeRows,
      giftRows,
      guaranteedRows,
      simulatedRows,
      paidNonGiftRows: totalHistoryRows - freeRows - giftRows,
      missingGameUidRows,
      missingSeqIdRows,
      missingBatchIdRows,
      duplicateCompositeKeyCount: duplicateCompositeKeys.size,
      distinctUsers: userCounts.size,
      distinctUserGameUids: userGameUidCounts.size,
      distinctPools: poolCounts.size,
      distinctBatches: batchCounts.size,
    },
    concentration: {
      top10UserShare: totalHistoryRows > 0 ? Number((top10UserRows / totalHistoryRows).toFixed(4)) : 0,
      top20UserShare: totalHistoryRows > 0 ? Number((top50UserRows / totalHistoryRows).toFixed(4)) : 0,
      averageRowsPerUser: userCounts.size > 0 ? Number((totalHistoryRows / userCounts.size).toFixed(1)) : 0,
    },
    topUsers,
    topUserGameUids,
    topPools,
    topBatches,
    byCreatedMonth: pickTopEntries(createdMonthCounts, createdMonthCounts.size, (key, count) => ({ month: key, count })),
    byTimestampMonth: pickTopEntries(timestampMonthCounts, timestampMonthCounts.size, (key, count) => ({ month: key, count })),
    byCreatedAgeBucket: pickTopEntries(createdAgeBuckets, createdAgeBuckets.size, (key, count) => ({ bucket: key, count })),
    byServer: pickTopEntries(serverCounts, serverCounts.size, (key, count) => ({ server: key, count })),
    byRegion: pickTopEntries(regionCounts, regionCounts.size, (key, count) => ({ region: key, count })),
  };
}

async function maybeWriteJson(filePath, payload) {
  if (!filePath) {
    return;
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, JSON.stringify(payload, null, 2), 'utf8');
}

function printSummary(report) {
  console.log('\n=== History 体积审计 ===');
  console.log(`总记录: ${report.totalHistoryRows}`);
  console.log(`有效列: ${report.activeColumns.join(', ')}`);
  console.log(`distinct users: ${report.totals.distinctUsers}`);
  console.log(`distinct user+game_uid: ${report.totals.distinctUserGameUids}`);
  console.log(`distinct pools: ${report.totals.distinctPools}`);
  console.log(`distinct batches: ${report.totals.distinctBatches}`);
  console.log(`free rows: ${report.totals.freeRows}`);
  console.log(`gift rows: ${report.totals.giftRows}`);
  console.log(`guaranteed rows: ${report.totals.guaranteedRows}`);
  console.log(`simulated rows: ${report.totals.simulatedRows}`);
  console.log(`missing game_uid rows: ${report.totals.missingGameUidRows}`);
  console.log(`missing seq_id rows: ${report.totals.missingSeqIdRows}`);
  console.log(`missing batch_id rows: ${report.totals.missingBatchIdRows}`);
  console.log(`duplicate composite keys: ${report.totals.duplicateCompositeKeyCount}`);
  console.log(`top10 user share: ${report.concentration.top10UserShare}`);
  console.log(`top20 user share: ${report.concentration.top20UserShare}`);
  console.log(`avg rows per user: ${report.concentration.averageRowsPerUser}`);

  const sections = [
    ['Top users', report.topUsers.map((item) => `${item.user_id}: ${item.count}`)],
    ['Top user+game_uid', report.topUserGameUids.map((item) => `${item.user_id}/${item.game_uid}: ${item.count}`)],
    ['Top pools', report.topPools.map((item) => `${item.pool_id} (${item.name}): ${item.count}`)],
    ['Top batches', report.topBatches.map((item) => `${item.batch_id}: ${item.count}`)],
    ['Created month', report.byCreatedMonth.map((item) => `${item.month}: ${item.count}`)],
    ['Created age bucket', report.byCreatedAgeBucket.map((item) => `${item.bucket}: ${item.count}`)],
  ];

  sections.forEach(([title, lines]) => {
    console.log(`\n${title}:`);
    lines.slice(0, 10).forEach((line) => {
      console.log(`- ${line}`);
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await hydrateEnvFiles();
  const credentials = resolveCredentials(options);

  const supabase = createClient(credentials.supabaseUrl, credentials.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  const report = await auditHistoryFootprint(supabase, {
    pageSize: options.pageSize
  });

  printSummary(report);
  await maybeWriteJson(options.writeJson, report);
}

main().catch((error) => {
  console.error('[audit-history-footprint] 失败:', error?.message || error);
  process.exitCode = 1;
});
