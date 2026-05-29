import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildPublicPoolStats,
  buildPublicSinglePoolStats,
  buildPublicTrends,
} from '../api/_lib/publicAnalytics.js';

const TEST_POOL_ID = 'special_1001';
const TEST_POOL = {
  pool_id: TEST_POOL_ID,
  name: '测试池',
  name_en: 'Test Pool',
  type: 'limited',
  up_character: '阿尔法',
  is_limited_weapon: false,
  start_time: '2026-06-01T00:00:00.000Z',
  end_time: '2026-06-30T00:00:00.000Z',
  created_at: '2026-05-31T00:00:00.000Z',
  updated_at: '2026-06-05T12:00:00.000Z',
};

const CACHE_ROW = {
  pool_id: TEST_POOL_ID,
  pool_type: 'limited',
  total_pulls: 120,
  total_pulls_with_free: 130,
  free_pull_count: 10,
  rarity_counts: { 4: 90, 5: 25, 6: 5 },
  target_six_star: 3,
  offrate_six_star: 2,
  avg_pity_six_star: 24,
  avg_pity_five_star: 8.5,
  avg_pity_target_six_star: 40,
  distribution: [
    { range: '1-10', limited: 1, standard: 0 },
    { range: '11-20', limited: 2, standard: 2 },
  ],
  first_pull_at: '2026-06-01T00:00:00.000Z',
  last_pull_at: '2026-06-05T00:00:00.000Z',
  source_version: 'cache-v1',
  updated_at: '2026-06-05T12:00:00.000Z',
};

const TREND_ROWS = [
  {
    metric: 'six_star',
    granularity: 'day',
    period_start: '2026-06-03',
    pool_type: 'limited',
    pool_id: 'all',
    value: 4,
    source_version: 'trend-v2',
    updated_at: '2026-06-05T12:00:00.000Z',
  },
  {
    metric: 'six_star',
    granularity: 'day',
    period_start: '2026-06-01',
    pool_type: 'limited',
    pool_id: 'all',
    value: 1,
    source_version: 'trend-v1',
    updated_at: '2026-06-04T12:00:00.000Z',
  },
];

class MockQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.selectColumns = null;
    this.selectOptions = {};
    this.filters = [];
    this.orderOptions = null;
  }

  select(columns, options = {}) {
    this.selectColumns = columns;
    this.selectOptions = options || {};
    return this;
  }

  in(column, values) {
    this.filters.push({ op: 'in', column, values });
    return this;
  }

  or(condition) {
    this.filters.push({ op: 'or', condition });
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  order(column, options = {}) {
    this.orderOptions = { column, options };
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.resolveQuery(this)).then(resolve, reject);
  }
}

function createMockAdminClient({
  cacheRows = [],
  cacheError = null,
  trendRows = [],
  trendError = null,
  historyCounts = {},
  firstPullAt = '2026-06-01T00:00:00.000Z',
  lastPullAt = '2026-06-05T00:00:00.000Z',
} = {}) {
  const calls = [];

  return {
    calls,
    rpc(name) {
      calls.push({ type: 'rpc', name });
      assert.equal(name, 'get_app_visible_pools', '卡池统计应只通过公开可见池 RPC 读取池目录');
      return Promise.resolve({ data: [TEST_POOL], error: null });
    },
    from(table) {
      calls.push({ type: 'from', table });
      return new MockQuery(this, table);
    },
    resolveQuery(query) {
      if (query.table === 'public_pool_analytics_cache') {
        if (cacheError) {
          return { data: null, error: cacheError };
        }

        const poolIds = query.filters.find((filter) => filter.op === 'in' && filter.column === 'pool_id')?.values || [];
        return {
          data: cacheRows.filter((row) => poolIds.includes(row.pool_id)),
          error: null,
        };
      }

      if (query.table === 'public_pool_trend_cache') {
        if (trendError) {
          return { data: null, error: trendError };
        }

        const metric = query.filters.find((filter) => filter.op === 'eq' && filter.column === 'metric')?.value;
        const granularity = query.filters.find((filter) => filter.op === 'eq' && filter.column === 'granularity')?.value;
        const poolType = query.filters.find((filter) => filter.op === 'eq' && filter.column === 'pool_type')?.value;
        const poolId = query.filters.find((filter) => filter.op === 'eq' && filter.column === 'pool_id')?.value;
        const filteredRows = trendRows
          .filter((row) => row.metric === metric)
          .filter((row) => row.granularity === granularity)
          .filter((row) => row.pool_type === poolType)
          .filter((row) => row.pool_id === poolId)
          .sort((left, right) => new Date(right.period_start).getTime() - new Date(left.period_start).getTime())
          .slice(0, query.limitValue || trendRows.length);

        return {
          data: filteredRows,
          error: null,
        };
      }

      if (query.table === 'history') {
        const rarity = query.filters.find((filter) => filter.op === 'eq' && filter.column === 'rarity')?.value;
        const isCountQuery = query.selectOptions?.count === 'exact' && query.selectOptions?.head === true;

        if (isCountQuery) {
          return {
            count: historyCounts[rarity ?? 'total'] ?? 0,
            error: null,
          };
        }

        const timestamp = query.orderOptions?.options?.ascending ? firstPullAt : lastPullAt;
        return {
          data: timestamp ? [{ timestamp }] : [],
          error: null,
        };
      }

      throw new Error(`Unexpected table read: ${query.table}`);
    },
  };
}

function getHistoryReadCount(adminClient) {
  return adminClient.calls.filter((call) => call.type === 'from' && call.table === 'history').length;
}

function getPoolCacheReadCount(adminClient) {
  return adminClient.calls.filter((call) => call.type === 'from' && call.table === 'public_pool_analytics_cache').length;
}

function getTrendCacheReadCount(adminClient) {
  return adminClient.calls.filter((call) => call.type === 'from' && call.table === 'public_pool_trend_cache').length;
}

async function verifyCacheHit() {
  const adminClient = createMockAdminClient({ cacheRows: [CACHE_ROW] });
  const result = await buildPublicPoolStats(adminClient, { limit: 1 });
  const poolStats = result.pools[0];

  assert.equal(getPoolCacheReadCount(adminClient), 1, '应读取一次公共卡池分析缓存表');
  assert.equal(getHistoryReadCount(adminClient), 0, '缓存命中时不应访问 raw history');
  assert.equal(poolStats.pool.id, TEST_POOL_ID);
  assert.equal(poolStats.stats.source, 'preaggregated_pool_cache');
  assert.equal(poolStats.stats.totalPulls, 120);
  assert.equal(poolStats.stats.totalPullsWithFree, 130);
  assert.equal(poolStats.stats.freePullCount, 10);
  assert.deepEqual(poolStats.stats.rarityCounts, { 4: 90, 5: 25, 6: 5 });
  assert.equal(poolStats.stats.targetSixStar, 3);
  assert.equal(poolStats.stats.offrateSixStar, 2);
  assert.equal(poolStats.stats.averagePity.sixStar, 24);
  assert.equal(poolStats.stats.averagePity.fiveStar, 8.5);
  assert.equal(poolStats.stats.averagePity.targetSixStar, 40);
  assert.equal(poolStats.stats.distribution.length, 2);
  assert.equal(poolStats.stats.distribution[0].bucket, '1-10');
  assert.equal(poolStats.stats.distribution[0].count, 1);
  assert.equal(poolStats.stats.distribution[1].count, 4);
  assert.equal(poolStats.stats.analyticsMeta.source, 'preaggregated_pool_cache');
  assert.equal(poolStats.stats.analyticsMeta.partial, false);
  assert.equal(poolStats.stats.analyticsMeta.cacheVersion, 'cache-v1');
  assert.match(poolStats.stats.analyticsMeta.cacheKey, /^public_pool_analytics:special_1001:cache-v1$/);
}

async function verifyCacheMissFallback() {
  const adminClient = createMockAdminClient({
    cacheRows: [],
    historyCounts: {
      total: 12,
      4: 8,
      5: 3,
      6: 1,
    },
  });
  const result = await buildPublicSinglePoolStats(adminClient, { id: TEST_POOL_ID });
  const poolStats = result.pool;

  assert.equal(getPoolCacheReadCount(adminClient), 1, '缓存缺行时仍应先查公共卡池分析缓存');
  assert.equal(getHistoryReadCount(adminClient), 6, '缓存缺行时只允许 bounded count/timestamp fallback');
  assert.equal(poolStats.stats.source, 'bounded_count_queries');
  assert.equal(poolStats.stats.totalPulls, 12);
  assert.deepEqual(poolStats.stats.rarityCounts, { 4: 8, 5: 3, 6: 1 });
  assert.equal(poolStats.stats.targetSixStar, null);
  assert.equal(poolStats.stats.offrateSixStar, null);
  assert.equal(poolStats.stats.distribution.length, 0);
  assert.equal(poolStats.stats.analyticsMeta.source, 'bounded_count_queries');
  assert.equal(poolStats.stats.analyticsMeta.partial, true);
  assert.equal(poolStats.stats.analyticsMeta.warning, 'public_pool_analytics_cache_miss');
  assert.deepEqual(poolStats.stats.analyticsMeta.missingFields, [
    'targetSixStar',
    'offrateSixStar',
    'averagePity.sixStar',
    'averagePity.fiveStar',
    'averagePity.targetSixStar',
    'distribution',
  ]);
}

async function verifyCacheUnavailableFallback() {
  const adminClient = createMockAdminClient({
    cacheError: {
      code: '42P01',
      message: 'relation "public.public_pool_analytics_cache" does not exist',
    },
    historyCounts: {
      total: 9,
      4: 6,
      5: 2,
      6: 1,
    },
  });
  const result = await buildPublicSinglePoolStats(adminClient, { id: TEST_POOL_ID });
  const poolStats = result.pool;

  assert.equal(getPoolCacheReadCount(adminClient), 1, '缺表时应尝试读取公共卡池分析缓存一次');
  assert.equal(getHistoryReadCount(adminClient), 6, '缺表时只能降级到 bounded count/timestamp fallback');
  assert.equal(poolStats.stats.totalPulls, 9);
  assert.equal(poolStats.stats.targetSixStar, null);
  assert.equal(poolStats.stats.analyticsMeta.partial, true);
  assert.equal(poolStats.stats.analyticsMeta.warning, 'public_pool_analytics_cache_unavailable');
}

async function verifyTrendCacheHit() {
  const adminClient = createMockAdminClient({ trendRows: TREND_ROWS });
  const result = await buildPublicTrends(adminClient, {
    metric: 'six_star',
    granularity: 'day',
    days: 7,
    poolType: 'limited',
  });

  assert.equal(getTrendCacheReadCount(adminClient), 1, '趋势端点应读取一次公共趋势缓存');
  assert.equal(getHistoryReadCount(adminClient), 0, '趋势缓存命中时不应读取 raw history');
  assert.equal(result.source, 'preaggregated_trend_cache');
  assert.equal(result.metric, 'six_star');
  assert.equal(result.granularity, 'day');
  assert.equal(result.days, 7);
  assert.equal(result.poolType, 'limited');
  assert.equal(result.poolId, null);
  assert.deepEqual(result.points.map((point) => [point.period, point.value]), [
    ['2026-06-01', 1],
    ['2026-06-03', 4],
  ]);
  assert.equal(result.analyticsMeta.source, 'preaggregated_trend_cache');
  assert.equal(result.analyticsMeta.partial, false);
  assert.equal(result.analyticsMeta.cacheVersion, 'trend-v2');
  assert.match(result.analyticsMeta.cacheKey, /^public_pool_trends:six_star:day:7:limited:trend-v2$/);
}

async function verifyTrendCacheMiss() {
  const adminClient = createMockAdminClient({ trendRows: [] });
  const result = await buildPublicTrends(adminClient, {
    metric: 'five_star',
    granularity: 'week',
    days: 30,
    poolType: 'weapon',
  });

  assert.equal(getTrendCacheReadCount(adminClient), 1, '趋势缺行时仍应只查公共趋势缓存');
  assert.equal(getHistoryReadCount(adminClient), 0, '趋势缺行时不应降级扫描 raw history');
  assert.equal(result.source, 'trend_cache_miss');
  assert.equal(result.points.length, 0);
  assert.equal(result.analyticsMeta.partial, true);
  assert.equal(result.analyticsMeta.warning, 'public_pool_trend_cache_miss');
  assert.deepEqual(result.analyticsMeta.missingFields, ['points']);
}

async function verifyTrendCacheUnavailable() {
  const adminClient = createMockAdminClient({
    trendError: {
      code: '42P01',
      message: 'relation "public.public_pool_trend_cache" does not exist',
    },
  });
  const result = await buildPublicTrends(adminClient, {
    metric: 'pulls',
    granularity: 'day',
    days: 90,
  });

  assert.equal(getTrendCacheReadCount(adminClient), 1, '趋势缺表时应尝试读取公共趋势缓存一次');
  assert.equal(getHistoryReadCount(adminClient), 0, '趋势缺表时不应降级扫描 raw history');
  assert.equal(result.source, 'trend_cache_unavailable');
  assert.equal(result.points.length, 0);
  assert.equal(result.analyticsMeta.partial, true);
  assert.equal(result.analyticsMeta.warning, 'public_pool_trend_cache_unavailable');
}

async function verifyRefreshFunctionOrderingMigration() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '121_fix_public_pool_analytics_ordering.sql'
  );
  const migrationSql = await fs.readFile(migrationPath, 'utf8');
  assert.match(
    migrationSql,
    /COALESCE\(seq_id::TEXT,\s*record_id::TEXT\)/,
    '刷新函数排序必须显式把 seq_id / record_id 转成同一类型'
  );
  assert.doesNotMatch(
    migrationSql,
    /COALESCE\(seq_id,\s*record_id\)/,
    '刷新函数排序不能使用会在生产库触发类型不匹配的裸 COALESCE(seq_id, record_id)'
  );
}

await verifyCacheHit();
await verifyCacheMissFallback();
await verifyCacheUnavailableFallback();
await verifyTrendCacheHit();
await verifyTrendCacheMiss();
await verifyTrendCacheUnavailable();
await verifyRefreshFunctionOrderingMigration();

console.log('API-003/STATS-004 public pool analytics cache verification passed');
