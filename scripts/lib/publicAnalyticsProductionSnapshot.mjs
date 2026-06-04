export const PUBLIC_ANALYTICS_SNAPSHOT_VERSION = 1;

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function parseDateMs(value) {
  if (!value) {
    return NaN;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function normalizeFreshness(latestAt, now = new Date(), {
  noticeAfterHours = 12,
  warningAfterHours = 48,
} = {}) {
  const timestamp = parseDateMs(latestAt);
  if (!Number.isFinite(timestamp)) {
    return {
      level: 'unknown',
      ageHours: null,
      latestAt: latestAt || null,
    };
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();
  const ageHours = Math.max(0, (nowMs - timestamp) / 3600000);

  if (ageHours >= warningAfterHours) {
    return {
      level: 'warning',
      ageHours: Number(ageHours.toFixed(2)),
      latestAt,
    };
  }

  if (ageHours >= noticeAfterHours) {
    return {
      level: 'notice',
      ageHours: Number(ageHours.toFixed(2)),
      latestAt,
    };
  }

  return {
    level: 'ok',
    ageHours: Number(ageHours.toFixed(2)),
    latestAt,
  };
}

function latestTimestamp(rows, fields = ['updated_at', 'source_version']) {
  let latest = null;
  normalizeRows(rows).forEach((row) => {
    fields.forEach((field) => {
      const value = row?.[field];
      const timestamp = parseDateMs(value);
      if (!Number.isFinite(timestamp)) {
        return;
      }

      if (!latest || timestamp > latest.timestamp) {
        latest = {
          timestamp,
          value,
          field,
        };
      }
    });
  });
  return latest;
}

function uniqueTexts(values = []) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function isArrayLikeJson(value) {
  return Array.isArray(value);
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function analyzePoolRows(rows = []) {
  const normalizedRows = normalizeRows(rows);
  const missingCore = [];
  const missingDistribution = [];
  const averagePityNull = [];

  normalizedRows.forEach((row) => {
    const poolId = normalizeText(row?.pool_id);
    const label = poolId || 'unknown_pool';
    if (!hasValue(row?.target_six_star) || !hasValue(row?.offrate_six_star)) {
      missingCore.push(label);
    }

    if (!isArrayLikeJson(row?.distribution)) {
      missingDistribution.push(label);
    }

    if (!hasValue(row?.avg_pity_six_star) || !hasValue(row?.avg_pity_five_star)) {
      averagePityNull.push(label);
    }
  });

  const latest = latestTimestamp(normalizedRows, ['updated_at']);

  return {
    sampleSize: normalizedRows.length,
    latestUpdatedAt: latest?.value || null,
    latestSourceVersions: uniqueTexts(normalizedRows.map(row => row?.source_version)).slice(0, 5),
    poolTypes: uniqueTexts(normalizedRows.map(row => row?.pool_type)).sort(),
    totalPullsInSample: normalizedRows.reduce((total, row) => total + normalizeNumber(row?.total_pulls), 0),
    missingCorePoolIds: missingCore,
    missingDistributionPoolIds: missingDistribution,
    averagePityNullPoolIds: averagePityNull,
  };
}

function analyzeTrendRows(rows = []) {
  const normalizedRows = normalizeRows(rows);
  const latest = latestTimestamp(normalizedRows, ['updated_at']);
  const missingPointRows = normalizedRows
    .filter(row => !hasValue(row?.period_start) || !hasValue(row?.value))
    .map(row => ({
      metric: row?.metric || null,
      granularity: row?.granularity || null,
      poolType: row?.pool_type || null,
      poolId: row?.pool_id || null,
    }));

  return {
    sampleSize: normalizedRows.length,
    latestUpdatedAt: latest?.value || null,
    latestSourceVersions: uniqueTexts(normalizedRows.map(row => row?.source_version)).slice(0, 5),
    metrics: uniqueTexts(normalizedRows.map(row => row?.metric)).sort(),
    granularities: uniqueTexts(normalizedRows.map(row => row?.granularity)).sort(),
    poolTypes: uniqueTexts(normalizedRows.map(row => row?.pool_type)).sort(),
    missingPointRows,
  };
}

function normalizeEpochRow(row) {
  let parsedValue = null;
  const rawValue = row?.value;
  if (rawValue && typeof rawValue === 'object') {
    parsedValue = rawValue;
  } else {
    try {
      parsedValue = rawValue ? JSON.parse(rawValue) : null;
    } catch {
      parsedValue = null;
    }
  }

  return {
    exists: Boolean(row),
    rawUpdatedAt: row?.updated_at || null,
    cacheVersion: parsedValue?.version
      || parsedValue?.updatedAt
      || (typeof rawValue === 'string' ? rawValue : null),
    scope: parsedValue?.scope || null,
    reason: parsedValue?.reason || null,
    updatedAt: parsedValue?.updatedAt || row?.updated_at || null,
  };
}

function buildWarnings({ poolCache, trendCache, freshness }) {
  const warnings = [];

  if (!poolCache.available) {
    warnings.push('public_pool_analytics_cache_unavailable');
  } else if (poolCache.rowCount === 0) {
    warnings.push('public_pool_analytics_cache_empty');
  }

  if (!trendCache.available) {
    warnings.push('public_pool_trend_cache_unavailable');
  } else if (trendCache.rowCount === 0) {
    warnings.push('public_pool_trend_cache_empty');
  }

  if (poolCache.sample?.missingCorePoolIds?.length > 0) {
    warnings.push('public_pool_analytics_core_fields_missing');
  }

  if (poolCache.sample?.missingDistributionPoolIds?.length > 0) {
    warnings.push('public_pool_analytics_distribution_missing');
  }

  if (trendCache.sample?.missingPointRows?.length > 0) {
    warnings.push('public_pool_trend_points_incomplete');
  }

  if (freshness.level === 'unknown') {
    warnings.push('public_analytics_cache_latest_time_missing');
  } else if (freshness.level === 'warning') {
    warnings.push('public_analytics_cache_stale');
  }

  return warnings;
}

export function buildPublicAnalyticsProductionSnapshot({
  generatedAt = new Date().toISOString(),
  target = null,
  epochRow = null,
  poolCacheCount = 0,
  poolCacheRows = [],
  poolCacheAvailable = true,
  poolCacheError = null,
  trendCacheCount = 0,
  trendCacheRows = [],
  trendCacheAvailable = true,
  trendCacheError = null,
  now = new Date(),
} = {}) {
  const poolCache = {
    available: poolCacheAvailable === true,
    rowCount: normalizeNumber(poolCacheCount, 0),
    error: poolCacheError || null,
    sample: analyzePoolRows(poolCacheRows),
  };
  const trendCache = {
    available: trendCacheAvailable === true,
    rowCount: normalizeNumber(trendCacheCount, 0),
    error: trendCacheError || null,
    sample: analyzeTrendRows(trendCacheRows),
  };
  const latestAt = latestTimestamp([
    { updated_at: poolCache.sample.latestUpdatedAt },
    { updated_at: trendCache.sample.latestUpdatedAt },
  ], ['updated_at'])?.value || null;
  const freshness = normalizeFreshness(latestAt, now);
  const warnings = buildWarnings({ poolCache, trendCache, freshness });

  return {
    reportType: 'public_analytics_production_snapshot',
    version: PUBLIC_ANALYTICS_SNAPSHOT_VERSION,
    generatedAt,
    target,
    writesDatabase: false,
    publicCacheEpoch: normalizeEpochRow(epochRow),
    freshness,
    poolAnalyticsCache: poolCache,
    trendCache,
    warnings,
    ok: warnings.length === 0,
  };
}
