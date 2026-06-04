import assert from 'node:assert/strict';

import { buildPublicAnalyticsProductionSnapshot } from './lib/publicAnalyticsProductionSnapshot.mjs';

const completeReport = buildPublicAnalyticsProductionSnapshot({
  generatedAt: '2026-06-04T00:00:00.000Z',
  now: new Date('2026-06-04T01:00:00.000Z'),
  target: 'https://db.example.test (service_role_or_custom)',
  epochRow: {
    value: JSON.stringify({
      version: 'cache-v1',
      scope: 'public-analytics',
      reason: 'test',
      updatedAt: '2026-06-04T00:00:00.000Z',
    }),
    updated_at: '2026-06-04T00:00:00.000Z',
  },
  poolCacheCount: 2,
  poolCacheRows: [
    {
      pool_id: 'special_1001',
      pool_type: 'limited',
      total_pulls: 100,
      target_six_star: 3,
      offrate_six_star: 1,
      avg_pity_six_star: 25,
      avg_pity_five_star: 9,
      distribution: [{ bucket: '1-10', limited: 1 }],
      source_version: 'pool-v1',
      updated_at: '2026-06-04T00:00:00.000Z',
    },
  ],
  trendCacheCount: 3,
  trendCacheRows: [
    {
      metric: 'pulls',
      granularity: 'day',
      period_start: '2026-06-03',
      pool_type: 'all',
      pool_id: 'all',
      value: 12,
      source_version: 'trend-v1',
      updated_at: '2026-06-04T00:00:00.000Z',
    },
  ],
});

assert.equal(completeReport.reportType, 'public_analytics_production_snapshot');
assert.equal(completeReport.writesDatabase, false);
assert.equal(completeReport.ok, true);
assert.deepEqual(completeReport.warnings, []);
assert.equal(completeReport.publicCacheEpoch.cacheVersion, 'cache-v1');
assert.equal(completeReport.freshness.level, 'ok');
assert.equal(completeReport.poolAnalyticsCache.rowCount, 2);
assert.equal(completeReport.poolAnalyticsCache.sample.missingCorePoolIds.length, 0);
assert.equal(completeReport.poolAnalyticsCache.sample.missingDistributionPoolIds.length, 0);
assert.equal(completeReport.poolAnalyticsCache.sample.totalPullsInSample, 100);
assert.deepEqual(completeReport.trendCache.sample.metrics, ['pulls']);

const objectEpochReport = buildPublicAnalyticsProductionSnapshot({
  now: new Date('2026-06-04T01:00:00.000Z'),
  epochRow: {
    value: {
      scope: 'site-config',
      reason: 'object-jsonb',
      updatedAt: '2026-06-04T00:05:00.000Z',
    },
    updated_at: '2026-06-04T00:05:00.000Z',
  },
});

assert.equal(objectEpochReport.publicCacheEpoch.cacheVersion, '2026-06-04T00:05:00.000Z');
assert.equal(objectEpochReport.publicCacheEpoch.scope, 'site-config');

const warningReport = buildPublicAnalyticsProductionSnapshot({
  now: new Date('2026-06-04T00:00:00.000Z'),
  poolCacheCount: 1,
  poolCacheRows: [
    {
      pool_id: 'special_missing',
      pool_type: 'limited',
      target_six_star: null,
      offrate_six_star: 0,
      distribution: null,
    },
  ],
  trendCacheCount: 1,
  trendCacheRows: [
    {
      metric: 'pulls',
      granularity: 'day',
      pool_type: 'all',
      pool_id: 'all',
      value: null,
    },
  ],
});

assert.equal(warningReport.ok, false);
assert.deepEqual(warningReport.poolAnalyticsCache.sample.missingCorePoolIds, ['special_missing']);
assert.deepEqual(warningReport.poolAnalyticsCache.sample.missingDistributionPoolIds, ['special_missing']);
assert.deepEqual(warningReport.warnings, [
  'public_pool_analytics_core_fields_missing',
  'public_pool_analytics_distribution_missing',
  'public_pool_trend_points_incomplete',
  'public_analytics_cache_latest_time_missing',
]);

const staleReport = buildPublicAnalyticsProductionSnapshot({
  now: new Date('2026-06-04T00:00:00.000Z'),
  poolCacheCount: 1,
  poolCacheRows: [
    {
      pool_id: 'special_old',
      pool_type: 'limited',
      target_six_star: 1,
      offrate_six_star: 0,
      avg_pity_six_star: 50,
      avg_pity_five_star: 9,
      distribution: [],
      updated_at: '2026-05-25T00:00:00.000Z',
    },
  ],
  trendCacheCount: 1,
  trendCacheRows: [
    {
      metric: 'pulls',
      granularity: 'day',
      period_start: '2026-05-25',
      pool_type: 'all',
      pool_id: 'all',
      value: 10,
      updated_at: '2026-05-25T00:00:00.000Z',
    },
  ],
});

assert.equal(staleReport.ok, false);
assert.equal(staleReport.freshness.level, 'warning');
assert.ok(staleReport.freshness.ageHours > 48);
assert.ok(staleReport.warnings.includes('public_analytics_cache_stale'));

const unavailableReport = buildPublicAnalyticsProductionSnapshot({
  now: new Date('2026-06-04T00:00:00.000Z'),
  poolCacheAvailable: false,
  poolCacheError: 'relation missing',
  trendCacheAvailable: false,
  trendCacheError: 'relation missing',
});

assert.equal(unavailableReport.ok, false);
assert.deepEqual(unavailableReport.warnings, [
  'public_pool_analytics_cache_unavailable',
  'public_pool_trend_cache_unavailable',
  'public_analytics_cache_latest_time_missing',
]);

console.log('API-005/STATS-005 public analytics production snapshot verification passed');
