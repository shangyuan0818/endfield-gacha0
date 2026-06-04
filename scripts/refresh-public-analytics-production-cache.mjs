import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  bumpPublicCacheEpoch,
  refreshPublicAnalyticsCache,
} from '../api/_lib/publicCache.js';
import {
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

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
    reason: 'goal-2:api-005-public-analytics-refresh',
    writeJson: null,
    skipCacheVersionBump: false,
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

    if (arg === '--reason' && nextValue) {
      options.reason = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--write-json' && nextValue) {
      options.writeJson = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--skip-cache-version-bump') {
      options.skipCacheVersionBump = true;
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
  const supabaseUrl = normalizeText(options.supabaseUrl) || resolveSupabaseUrl() || null;
  const supabaseKey = normalizeText(options.supabaseKey) || resolveSupabaseSecretKey() || null;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少生产 Supabase 写入配置；请提供 --supabase-url / --supabase-key，或在 .env 中配置 SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    supabaseUrl,
    supabaseKey,
  };
}

function formatTargetLabel(supabaseUrl) {
  try {
    return `${new URL(supabaseUrl).origin} (service_role_or_custom)`;
  } catch {
    return 'Supabase (service_role_or_custom)';
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

function sanitizeRefreshResult(result) {
  return {
    ok: Boolean(result?.ok),
    reason: result?.reason || null,
    functionName: result?.functionName || null,
    refreshedPools: Number(result?.refreshedPools || 0),
    refreshedTrendRows: Number(result?.refreshedTrendRows || 0),
    updatedAt: result?.updatedAt || null,
    partial: Boolean(result?.partial),
    warning: result?.warning || null,
    error: result?.error || null,
    attempts: Array.isArray(result?.attempts)
      ? result.attempts.map((attempt) => ({
        functionName: attempt?.functionName || null,
        ok: Boolean(attempt?.ok),
        error: attempt?.error || null,
      }))
      : [],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureEnvLoaded();
  const { supabaseUrl, supabaseKey } = resolveSupabaseConfig(options);
  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const refreshResult = sanitizeRefreshResult(await refreshPublicAnalyticsCache(supabaseClient, {
    reason: options.reason,
  }));

  const cacheVersionResult = options.skipCacheVersionBump || !refreshResult.ok
    ? {
      ok: true,
      skipped: true,
      reason: refreshResult.ok ? 'skip-cache-version-bump' : 'refresh-failed',
    }
    : await bumpPublicCacheEpoch(supabaseClient, {
      scope: 'stats',
      reason: options.reason,
    });

  const report = {
    reportType: 'public_analytics_production_refresh',
    generatedAt: new Date().toISOString(),
    target: formatTargetLabel(supabaseUrl),
    writesDatabase: true,
    refreshResult,
    cacheVersion: {
      ok: Boolean(cacheVersionResult?.ok),
      skipped: Boolean(cacheVersionResult?.skipped),
      version: cacheVersionResult?.version || null,
      updatedAt: cacheVersionResult?.updatedAt || null,
      scope: cacheVersionResult?.scope || null,
      reason: cacheVersionResult?.reason || null,
      error: cacheVersionResult?.error || null,
    },
    ok: Boolean(refreshResult.ok && cacheVersionResult?.ok),
  };

  const absoluteOutputPath = await writeOutputFile(options.writeJson, report);

  console.log('# API-005 / STATS-005 公共分析生产刷新');
  console.log(`目标: ${report.target}`);
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`刷新函数: ${refreshResult.functionName || '未执行成功'}`);
  console.log(`刷新结果: ${refreshResult.ok ? '成功' : '失败'}`);
  console.log(`刷新卡池: ${refreshResult.refreshedPools}`);
  console.log(`刷新趋势点: ${refreshResult.refreshedTrendRows}`);
  console.log(`公共缓存版本: ${report.cacheVersion.skipped ? '跳过更新' : report.cacheVersion.version || '未更新'}`);
  if (refreshResult.warning) {
    console.log(`警告: ${refreshResult.warning}`);
  }
  if (refreshResult.error || report.cacheVersion.error) {
    console.log(`错误: ${refreshResult.error || report.cacheVersion.error}`);
  }
  if (absoluteOutputPath) {
    console.log(`已写出 JSON 报告: ${absoluteOutputPath}`);
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[refresh-public-analytics-production-cache] 执行失败:', error);
    process.exitCode = 1;
  });
}

export {
  parseArgs,
  sanitizeRefreshResult,
};
