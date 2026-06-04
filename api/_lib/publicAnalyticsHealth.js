const DEFAULT_LIMIT = 30;

function normalizeRows(data) {
  return Array.isArray(data) ? data : [];
}

function normalizeError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 200);
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toTimestampMs(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function latestTimestamp(rows, fields = ['updated_at', 'last_pull_at', 'period_start']) {
  let latest = null;
  rows.forEach((row) => {
    fields.forEach((field) => {
      const value = row?.[field];
      const timestamp = toTimestampMs(value);
      if (timestamp == null) return;
      if (!latest || timestamp > latest.timestamp) {
        latest = { timestamp, value };
      }
    });
  });
  return latest?.value || null;
}

function uniqValues(rows, field, limit = 8) {
  return [...new Set(rows
    .map(row => String(row?.[field] || '').trim())
    .filter(Boolean))]
    .slice(0, limit);
}

function normalizeFreshness(latestAt, now = new Date(), {
  noticeAfterHours = 12,
  warningAfterHours = 48,
} = {}) {
  const latestMs = toTimestampMs(latestAt);
  if (latestMs == null) {
    return {
      level: 'unknown',
      ageHours: null,
    };
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();
  const ageHours = Math.max(0, (nowMs - latestMs) / 3600000);

  if (ageHours >= warningAfterHours) {
    return {
      level: 'warning',
      ageHours: Number(ageHours.toFixed(2)),
    };
  }
  if (ageHours >= noticeAfterHours) {
    return {
      level: 'notice',
      ageHours: Number(ageHours.toFixed(2)),
    };
  }
  return {
    level: 'ok',
    ageHours: Number(ageHours.toFixed(2)),
  };
}

async function safeSection(name, loader) {
  try {
    return {
      name,
      ok: true,
      rows: await loader(),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      rows: [],
      error: normalizeError(error),
    };
  }
}

async function queryRows(supabase, table, fields, {
  orderField = 'updated_at',
  limit = DEFAULT_LIMIT,
} = {}) {
  if (!supabase?.from) {
    throw new Error('Supabase client is not configured');
  }

  const { data, error } = await supabase
    .from(table)
    .select(fields)
    .order(orderField, { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return normalizeRows(data);
}

function buildAnalyticsSection(section) {
  if (!section.ok) {
    return {
      ok: false,
      available: false,
      sampledRows: 0,
      latestAt: null,
      sourceVersions: [],
      totalPullsSample: 0,
      error: section.error,
      latest: null,
    };
  }

  const rows = normalizeRows(section.rows);
  const latest = rows[0] || null;
  return {
    ok: true,
    available: true,
    sampledRows: rows.length,
    latestAt: latestTimestamp(rows, ['updated_at', 'last_pull_at']),
    sourceVersions: uniqValues(rows, 'source_version'),
    totalPullsSample: rows.reduce((sum, row) => sum + normalizeNumber(row?.total_pulls, 0), 0),
    latest: latest ? {
      poolId: latest.pool_id || null,
      poolType: latest.pool_type || null,
      totalPulls: normalizeNumber(latest.total_pulls, 0),
      sourceVersion: latest.source_version || null,
      lastPullAt: latest.last_pull_at || null,
      updatedAt: latest.updated_at || null,
    } : null,
  };
}

function buildTrendSection(section) {
  if (!section.ok) {
    return {
      ok: false,
      available: false,
      sampledRows: 0,
      latestAt: null,
      sourceVersions: [],
      metrics: [],
      error: section.error,
      latest: null,
    };
  }

  const rows = normalizeRows(section.rows);
  const latest = rows[0] || null;
  return {
    ok: true,
    available: true,
    sampledRows: rows.length,
    latestAt: latestTimestamp(rows, ['updated_at', 'period_start']),
    sourceVersions: uniqValues(rows, 'source_version'),
    metrics: uniqValues(rows, 'metric'),
    latest: latest ? {
      metric: latest.metric || null,
      granularity: latest.granularity || null,
      periodStart: latest.period_start || null,
      poolType: latest.pool_type || null,
      poolId: latest.pool_id || null,
      value: normalizeNumber(latest.value, 0),
      sourceVersion: latest.source_version || null,
      updatedAt: latest.updated_at || null,
    } : null,
  };
}

function deriveHealthStatus({ analytics, trends, latestAt, freshness }) {
  const warnings = [];
  let level = 'ok';

  if (!analytics.available) {
    warnings.push(`public_pool_analytics_cache: ${analytics.error || '读取失败'}`);
    level = 'warning';
  } else if (analytics.sampledRows === 0) {
    warnings.push('public_pool_analytics_cache_empty');
    level = level === 'warning' ? level : 'notice';
  }

  if (!trends.available) {
    warnings.push(`public_pool_trend_cache: ${trends.error || '读取失败'}`);
    level = 'warning';
  } else if (trends.sampledRows === 0) {
    warnings.push('public_pool_trend_cache_empty');
    level = level === 'warning' ? level : 'notice';
  }

  if (!latestAt) {
    level = level === 'warning' ? level : 'notice';
    warnings.push('public_analytics_cache_latest_time_missing');
  } else if (freshness.level === 'warning') {
    level = 'warning';
    warnings.push('public_analytics_cache_stale');
  } else if (freshness.level === 'notice' && level === 'ok') {
    level = 'notice';
  }

  return {
    level,
    warnings,
  };
}

export async function loadPublicAnalyticsHealth(supabase, {
  now = new Date(),
  limit = DEFAULT_LIMIT,
} = {}) {
  const [analyticsResult, trendsResult] = await Promise.all([
    safeSection('analytics', () => queryRows(
      supabase,
      'public_pool_analytics_cache',
      'pool_id, pool_type, total_pulls, source_version, last_pull_at, updated_at',
      { limit }
    )),
    safeSection('trends', () => queryRows(
      supabase,
      'public_pool_trend_cache',
      'metric, granularity, period_start, pool_type, pool_id, value, source_version, updated_at',
      { limit }
    )),
  ]);

  const analytics = buildAnalyticsSection(analyticsResult);
  const trends = buildTrendSection(trendsResult);
  const latestAt = latestTimestamp([
    { updated_at: analytics.latestAt },
    { updated_at: trends.latestAt },
  ], ['updated_at']);
  const freshness = normalizeFreshness(latestAt, now);
  const status = deriveHealthStatus({
    analytics,
    trends,
    latestAt,
    freshness,
  });

  return {
    ok: status.level !== 'warning',
    level: status.level,
    latestAt,
    freshness,
    analytics,
    trends,
    sourceVersions: [...new Set([
      ...analytics.sourceVersions,
      ...trends.sourceVersions,
    ])].slice(0, 12),
    sampledRows: analytics.sampledRows + trends.sampledRows,
    warnings: status.warnings,
  };
}

export const __internal = {
  buildAnalyticsSection,
  buildTrendSection,
  deriveHealthStatus,
  latestTimestamp,
  normalizeFreshness,
};
