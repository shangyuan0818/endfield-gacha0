import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { PUBLIC_CACHE_EPOCH_KEY } from '../api/_lib/publicCache.js';
import { buildPublicAnalyticsProductionSnapshot } from './lib/publicAnalyticsProductionSnapshot.mjs';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

const DEFAULT_POOL_SAMPLE_LIMIT = 20;
const DEFAULT_TREND_SAMPLE_LIMIT = 60;
const ENV_FILE_CANDIDATES = [
  '.env.local',
  '.env',
  path.join('backend', '.env.local'),
  path.join('backend', '.env'),
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    writeJson: null,
    poolSampleLimit: DEFAULT_POOL_SAMPLE_LIMIT,
    trendSampleLimit: DEFAULT_TREND_SAMPLE_LIMIT,
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

    if (arg === '--write-json' && nextValue) {
      options.writeJson = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--pool-sample-limit' && nextValue) {
      options.poolSampleLimit = parsePositiveInteger(nextValue, options.poolSampleLimit);
      index += 1;
      continue;
    }

    if (arg === '--trend-sample-limit' && nextValue) {
      options.trendSampleLimit = parsePositiveInteger(nextValue, options.trendSampleLimit);
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

function formatTargetLabel(supabaseUrl, authMode) {
  try {
    return `${new URL(supabaseUrl).origin} (${authMode})`;
  } catch {
    return `Supabase (${authMode})`;
  }
}

function normalizeError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 240);
}

async function countTableRows(supabaseClient, table, selectColumn) {
  const { count, error } = await supabaseClient
    .from(table)
    .select(selectColumn, { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return Number.isFinite(count) ? count : 0;
}

async function loadRows(supabaseClient, table, selectColumns, {
  orderBy = 'updated_at',
  limit = 20,
} = {}) {
  const { data, error } = await supabaseClient
    .from(table)
    .select(selectColumns)
    .order(orderBy, { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function loadEpochRow(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('site_config')
    .select('key, value, updated_at')
    .eq('key', PUBLIC_CACHE_EPOCH_KEY)
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}

async function loadCacheSection(loader) {
  try {
    return {
      available: true,
      value: await loader(),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      value: null,
      error: normalizeError(error),
    };
  }
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

  const [epochRow, poolCount, poolRows, trendCount, trendRows] = await Promise.all([
    loadEpochRow(supabaseClient),
    loadCacheSection(() => countTableRows(supabaseClient, 'public_pool_analytics_cache', 'pool_id')),
    loadCacheSection(() => loadRows(
      supabaseClient,
      'public_pool_analytics_cache',
      'pool_id, pool_type, total_pulls, total_pulls_with_free, target_six_star, offrate_six_star, avg_pity_six_star, avg_pity_five_star, avg_pity_target_six_star, distribution, last_pull_at, updated_at, source_version',
      { limit: options.poolSampleLimit }
    )),
    loadCacheSection(() => countTableRows(supabaseClient, 'public_pool_trend_cache', 'metric')),
    loadCacheSection(() => loadRows(
      supabaseClient,
      'public_pool_trend_cache',
      'metric, granularity, period_start, pool_type, pool_id, value, source_version, updated_at',
      { limit: options.trendSampleLimit }
    )),
  ]);

  const report = buildPublicAnalyticsProductionSnapshot({
    generatedAt: new Date().toISOString(),
    target: formatTargetLabel(supabaseUrl, authMode),
    epochRow,
    poolCacheCount: poolCount.value,
    poolCacheRows: poolRows.value,
    poolCacheAvailable: poolCount.available && poolRows.available,
    poolCacheError: poolCount.error || poolRows.error,
    trendCacheCount: trendCount.value,
    trendCacheRows: trendRows.value,
    trendCacheAvailable: trendCount.available && trendRows.available,
    trendCacheError: trendCount.error || trendRows.error,
  });

  const absoluteOutputPath = await writeOutputFile(options.writeJson, report);

  console.log('# API-005 / STATS-005 公共分析生产快照');
  console.log(`目标: ${report.target}`);
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`公共缓存版本: ${report.publicCacheEpoch.cacheVersion || '无'}`);
  console.log(`卡池分析缓存: ${report.poolAnalyticsCache.available ? '可用' : '不可用'}，行数 ${report.poolAnalyticsCache.rowCount}，样本 ${report.poolAnalyticsCache.sample.sampleSize}`);
  console.log(`趋势缓存: ${report.trendCache.available ? '可用' : '不可用'}，行数 ${report.trendCache.rowCount}，样本 ${report.trendCache.sample.sampleSize}`);
  console.log(`告警: ${report.warnings.length > 0 ? report.warnings.join(', ') : '无'}`);
  if (absoluteOutputPath) {
    console.log(`已写出 JSON 报告: ${absoluteOutputPath}`);
  }
  console.log('注意：该脚本只读取公共分析缓存和公共缓存版本，不扫描原始 history，也不写数据库。');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[audit-public-analytics-production-snapshot] 执行失败:', error);
    process.exitCode = 1;
  });
}

export {
  parseArgs,
};
