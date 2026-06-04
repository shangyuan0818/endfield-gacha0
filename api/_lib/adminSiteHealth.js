import { getMailProviderConfigFromEnv } from './mailProviderAdapter.js';
import { getMailInboundWebhookSecret } from './mailInboundEvents.js';
import { getMailWorkerConfigFromEnv } from './mailOutboxWorker.js';
import { loadMailRuntimeState } from './mailRuntimeConfig.js';
import { loadPublicAnalyticsHealth } from './publicAnalyticsHealth.js';
import { PUBLIC_CACHE_EPOCH_KEY, normalizeCacheVersion } from './publicCache.js';
import {
  classifyCharacterIdSource,
  classifyPoolIdSource,
} from '../../src/utils/canonicalEntityUtils.js';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function toIsoTimestamp(value = new Date()) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 240);
}

function normalizeRows(data) {
  return Array.isArray(data) ? data : [];
}

function latestTimestamp(rows, fields = ['updated_at', 'created_at']) {
  let latest = null;
  rows.forEach((row) => {
    fields.forEach((field) => {
      const value = row?.[field];
      if (!value) return;
      const timestamp = new Date(value).getTime();
      if (!Number.isFinite(timestamp)) return;
      if (latest == null || timestamp > latest.timestamp) {
        latest = {
          timestamp,
          value,
        };
      }
    });
  });
  return latest?.value || null;
}

function countBy(rows, key, knownKeys = []) {
  const counts = Object.fromEntries(knownKeys.map((item) => [item, 0]));
  rows.forEach((row) => {
    const value = String(row?.[key] || 'unknown');
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBoolean(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function toTimestampMs(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeDurationMs(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }
  return Math.round(durationMs);
}

function normalizeOpsRunDurationMs(row) {
  const summaryDurationMs = normalizeDurationMs(
    row?.summary?.ops?.durationMs ?? row?.summary?.durationMs
  );
  if (summaryDurationMs != null) {
    return summaryDurationMs;
  }

  const startedMs = toTimestampMs(row?.started_at || row?.created_at);
  const finishedMs = toTimestampMs(row?.finished_at || row?.updated_at);
  if (startedMs == null || finishedMs == null || finishedMs < startedMs) {
    return null;
  }
  return finishedMs - startedMs;
}

function percentileNumber(values, percentile) {
  const numbers = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  if (numbers.length === 0) {
    return null;
  }

  const safePercentile = Math.min(100, Math.max(0, Number(percentile) || 0));
  const index = Math.min(
    numbers.length - 1,
    Math.max(0, Math.ceil((safePercentile / 100) * numbers.length) - 1)
  );
  return numbers[index];
}

function getOpsRunPresentationStatus(row) {
  return String(row?.summary?.ops?.presentationStatus || row?.status || 'unknown');
}

function getOpsRunFailureType(row) {
  const failureType = String(
    row?.summary?.ops?.failureType
    || row?.summary?.failureType
    || ''
  ).trim();
  if (failureType) {
    return failureType.slice(0, 80);
  }
  return row?.error_message ? 'unexpected' : '';
}

const OPS_DAILY_CRON_EXPECTATIONS = Object.freeze([
  {
    id: 'ops-automation-daily',
    label: '运营自动化每日任务',
    path: '/api/ops-automation',
    schedule: '0 2 * * *',
    hourUtc: 2,
    minuteUtc: 0,
    displayHourLocal: 10,
    displayMinuteLocal: 0,
    displayTimeZone: 'Asia/Shanghai',
    graceMinutes: 90,
  },
]);

function buildUtcDateAt(date, hourUtc, minuteUtc) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hourUtc,
    minuteUtc,
    0,
    0
  ));
}

function getDailyUtcScheduleWindow({ hourUtc, minuteUtc }, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();
  const safeNow = new Date(nowMs);
  let lastExpected = buildUtcDateAt(safeNow, hourUtc, minuteUtc);
  if (lastExpected.getTime() > nowMs) {
    lastExpected = new Date(lastExpected.getTime() - 24 * 60 * 60 * 1000);
  }
  const nextExpected = new Date(lastExpected.getTime() + 24 * 60 * 60 * 1000);
  return {
    lastExpectedAt: lastExpected.toISOString(),
    nextExpectedAt: nextExpected.toISOString(),
  };
}

function buildOpsCronHealth(rows, now = new Date()) {
  const orderedRows = normalizeRows(rows);
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();

  const schedules = OPS_DAILY_CRON_EXPECTATIONS.map((expectation) => {
    const { lastExpectedAt, nextExpectedAt } = getDailyUtcScheduleWindow(expectation, nowDate);
    const lastExpectedMs = toTimestampMs(lastExpectedAt);
    const graceMs = Math.max(0, normalizeNumber(expectation.graceMinutes, 0)) * 60 * 1000;
    const latestCronRun = orderedRows.find(row => row?.trigger_type === 'cron') || null;
    const latestCronAt = latestCronRun
      ? latestTimestamp([latestCronRun], ['finished_at', 'updated_at', 'created_at'])
      : null;
    const latestCronMs = toTimestampMs(latestCronAt);
    const hasCurrentRun = latestCronMs != null && lastExpectedMs != null && latestCronMs >= lastExpectedMs;
    const isPastGrace = lastExpectedMs != null && nowMs > lastExpectedMs + graceMs;
    const status = hasCurrentRun ? 'ok' : (isPastGrace ? 'missed' : 'pending');

    return {
      id: expectation.id,
      label: expectation.label,
      path: expectation.path,
      schedule: expectation.schedule,
      scheduleText: `每日北京时间 ${String(expectation.displayHourLocal).padStart(2, '0')}:${String(expectation.displayMinuteLocal).padStart(2, '0')}`,
      timeZone: expectation.displayTimeZone,
      graceMinutes: expectation.graceMinutes,
      status,
      missed: status === 'missed',
      lastExpectedAt,
      nextExpectedAt,
      latestCronAt,
      latestCronStatus: latestCronRun?.summary?.ops?.presentationStatus || latestCronRun?.status || null,
      latestCronJobId: latestCronRun?.job_id || null,
    };
  });

  return {
    schedules,
    missedCount: schedules.filter(item => item.missed).length,
    pendingCount: schedules.filter(item => item.status === 'pending').length,
    nextExpectedAt: minTimestamp(schedules.map(item => item.nextExpectedAt)),
  };
}

function buildOpsRunHealth(rows) {
  const orderedRows = normalizeRows(rows);
  const rowsByJob = new Map();
  orderedRows.forEach((row) => {
    const jobId = String(row?.job_id || 'unknown');
    if (!rowsByJob.has(jobId)) {
      rowsByJob.set(jobId, []);
    }
    rowsByJob.get(jobId).push(row);
  });

  const jobHealth = [...rowsByJob.entries()].map(([jobId, jobRows]) => {
    const latestRun = jobRows[0] || {};
    const latestStatus = getOpsRunPresentationStatus(latestRun);
    let consecutiveFailureCount = 0;
    for (const row of jobRows) {
      if (getOpsRunPresentationStatus(row) !== 'failure') {
        break;
      }
      consecutiveFailureCount += 1;
    }

    const latestSuccess = jobRows.find(row => getOpsRunPresentationStatus(row) === 'success');
    const latestFailure = jobRows.find(row => getOpsRunPresentationStatus(row) === 'failure');
    const durations = jobRows
      .map(normalizeOpsRunDurationMs)
      .filter(value => value != null);

    return {
      jobId,
      jobLabel: latestRun.job_label || jobId,
      sampled: jobRows.length,
      latestStatus,
      consecutiveFailureCount,
      latestFailureType: latestFailure ? getOpsRunFailureType(latestFailure) : '',
      latestSuccessAt: latestSuccess?.finished_at || latestSuccess?.updated_at || latestSuccess?.created_at || null,
      latestFailureAt: latestFailure?.finished_at || latestFailure?.updated_at || latestFailure?.created_at || null,
      latestDurationMs: normalizeOpsRunDurationMs(latestRun),
      p95DurationMs: percentileNumber(durations, 95),
      updatedAt: latestRun.updated_at || latestRun.created_at || null,
    };
  });

  const worstJob = jobHealth.reduce((currentWorst, item) => {
    if (!currentWorst || item.consecutiveFailureCount > currentWorst.consecutiveFailureCount) {
      return item;
    }
    return currentWorst;
  }, null);
  const allDurations = orderedRows
    .map(normalizeOpsRunDurationMs)
    .filter(value => value != null);
  const successRows = orderedRows.filter(row => getOpsRunPresentationStatus(row) === 'success');
  const failureRows = orderedRows.filter(row => getOpsRunPresentationStatus(row) === 'failure');

  return {
    jobs: jobHealth,
    maxConsecutiveFailures: worstJob?.consecutiveFailureCount || 0,
    worstJobId: worstJob?.consecutiveFailureCount > 0 ? worstJob.jobId : null,
    worstJobLabel: worstJob?.consecutiveFailureCount > 0 ? worstJob.jobLabel : null,
    p95DurationMs: percentileNumber(allDurations, 95),
    sampledDurations: allDurations.length,
    latestSuccessAt: latestTimestamp(successRows),
    latestFailureAt: latestTimestamp(failureRows),
  };
}

function budgetRiskFromRatio(ratio, enabled) {
  if (!enabled) return 'disabled';
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'warning';
  if (ratio >= 0.5) return 'notice';
  return 'ok';
}

function minTimestamp(values) {
  let selected = null;
  values.forEach((value) => {
    if (!value) return;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return;
    if (selected == null || timestamp < selected.timestamp) {
      selected = { timestamp, value };
    }
  });
  return selected?.value || null;
}

async function section(name, loader) {
  try {
    const value = await loader();
    return {
      name,
      ok: true,
      value,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      value: null,
      error: normalizeError(error),
    };
  }
}

async function queryRows(adminClient, table, buildQuery) {
  const query = buildQuery(adminClient.from(table));
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return normalizeRows(data);
}

async function loadLatestContent(adminClient, {
  table,
  fields,
  orderField = 'updated_at',
  limit = 1,
  label,
  mapRow = row => row,
}) {
  const rows = await queryRows(adminClient, table, query => query
    .select(fields)
    .order(orderField, { ascending: false, nullsFirst: false })
    .limit(limit));
  const row = rows[0] || null;
  return {
    label,
    table,
    ok: true,
    latestAt: row ? latestTimestamp([row]) : null,
    latest: row ? mapRow(row) : null,
  };
}

async function loadContentHealth(adminClient) {
  const checks = await Promise.all([
    section('announcements', () => loadLatestContent(adminClient, {
      table: 'announcements',
      fields: 'id, title, announcement_type, severity, is_active, source_id, published_at, updated_at, created_at',
      label: '公告',
      mapRow: row => ({
        id: row.id,
        title: row.title || '',
        type: row.announcement_type || null,
        severity: row.severity || null,
        active: row.is_active !== false,
        source: row.source_id ? 'official' : 'manual',
        publishedAt: row.published_at || null,
        updatedAt: row.updated_at || row.created_at || null,
      }),
    })),
    section('pools', () => loadLatestContent(adminClient, {
      table: 'pools',
      fields: 'pool_id, name, type, start_time, end_time, updated_at, created_at',
      label: '卡池',
      mapRow: row => ({
        poolId: row.pool_id,
        name: row.name || row.pool_id || '',
        type: row.type || null,
        startTime: row.start_time || null,
        endTime: row.end_time || null,
        updatedAt: row.updated_at || row.created_at || null,
      }),
    })),
    section('characters', () => loadLatestContent(adminClient, {
      table: 'characters',
      fields: 'id, name, type, rarity, updated_at, created_at',
      label: '角色/武器',
      mapRow: row => ({
        id: row.id,
        name: row.name || row.id || '',
        type: row.type || null,
        rarity: row.rarity || null,
        updatedAt: row.updated_at || row.created_at || null,
      }),
    })),
    section('siteConfig', () => loadLatestContent(adminClient, {
      table: 'site_config',
      fields: 'key, label, category, updated_at',
      label: '站点配置',
      mapRow: row => ({
        key: row.key,
        label: row.label || row.key || '',
        category: row.category || null,
        updatedAt: row.updated_at || null,
      }),
    })),
  ]);

  const failed = checks.filter(item => !item.ok);
  const items = checks.map((item) => {
    if (!item.ok) {
      return {
        key: item.name,
        ok: false,
        error: item.error,
      };
    }
    return {
      key: item.name,
      ...item.value,
    };
  });

  return {
    ok: failed.length === 0,
    items,
    warnings: failed.map(item => `${item.name}: ${item.error}`),
    latestAt: latestTimestamp(items.map(item => ({ updated_at: item.latestAt }))),
  };
}

async function loadPublicCacheHealth(adminClient, now = new Date()) {
  const checks = await Promise.all([
    section('epoch', async () => {
      const rows = await queryRows(adminClient, 'site_config', query => query
        .select('key, value, updated_at')
        .eq('key', PUBLIC_CACHE_EPOCH_KEY)
        .limit(1));
      const row = rows[0] || null;
      let parsed = null;
      try {
        parsed = row?.value ? JSON.parse(row.value) : null;
      } catch {
        parsed = null;
      }
      return {
        exists: Boolean(row),
        cacheVersion: normalizeCacheVersion(row?.value, '0'),
        scope: parsed?.scope || null,
        reason: parsed?.reason || null,
        updatedAt: parsed?.updatedAt || row?.updated_at || null,
      };
    }),
    section('analyticsHealth', () => loadPublicAnalyticsHealth(adminClient, { now })),
  ]);

  const failed = checks.filter(item => !item.ok);
  const byName = new Map(checks.map(item => [item.name, item]));
  const analyticsHealth = byName.get('analyticsHealth')?.ok
    ? byName.get('analyticsHealth').value
    : null;

  return {
    ok: failed.length === 0 && analyticsHealth?.level !== 'warning',
    epoch: byName.get('epoch')?.ok ? byName.get('epoch').value : null,
    analytics: analyticsHealth,
    aggregates: analyticsHealth ? [
      {
        key: 'poolAnalytics',
        label: '公共卡池聚合',
        ok: analyticsHealth.analytics.available,
        table: 'public_pool_analytics_cache',
        latestAt: analyticsHealth.analytics.latestAt,
        latest: analyticsHealth.analytics.latest,
        sampledRows: analyticsHealth.analytics.sampledRows,
        sourceVersions: analyticsHealth.analytics.sourceVersions,
        error: analyticsHealth.analytics.error || null,
      },
      {
        key: 'poolTrends',
        label: '公共趋势聚合',
        ok: analyticsHealth.trends.available,
        table: 'public_pool_trend_cache',
        latestAt: analyticsHealth.trends.latestAt,
        latest: analyticsHealth.trends.latest,
        sampledRows: analyticsHealth.trends.sampledRows,
        sourceVersions: analyticsHealth.trends.sourceVersions,
        error: analyticsHealth.trends.error || null,
      },
    ] : [
      {
        key: 'analyticsHealth',
        ok: false,
        error: byName.get('analyticsHealth')?.error || '公共统计缓存检查失败',
      },
    ],
    warnings: [
      ...failed.map(item => `${item.name}: ${item.error}`),
      ...(analyticsHealth?.warnings || []),
    ],
  };
}

async function loadOpsHealth(adminClient, now = new Date()) {
  const rows = await queryRows(adminClient, 'ops_automation_runs', query => query
    .select('id, job_id, job_label, trigger_type, status, summary, error_message, started_at, finished_at, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(30));

  const latestByJob = new Map();
  rows.forEach((row) => {
    if (!latestByJob.has(row.job_id)) {
      latestByJob.set(row.job_id, row);
    }
  });
  const runHealth = buildOpsRunHealth(rows);
  const cronHealth = buildOpsCronHealth(rows, now);

  return {
    ok: true,
    totalSampled: rows.length,
    countsByStatus: countBy(rows, 'status', ['success', 'failure', 'skipped']),
    latestAt: latestTimestamp(rows),
    health: runHealth,
    cron: cronHealth,
    latestRuns: [...latestByJob.values()].slice(0, 8).map(row => ({
      id: row.id,
      jobId: row.job_id,
      jobLabel: row.job_label || row.job_id,
      triggerType: row.trigger_type || null,
      status: row.status || null,
      presentationStatus: row.summary?.ops?.presentationStatus || row.status || null,
      failureType: getOpsRunFailureType(row),
      durationMs: normalizeOpsRunDurationMs(row),
      error: row.error_message ? String(row.error_message).slice(0, 160) : '',
      startedAt: row.started_at || null,
      finishedAt: row.finished_at || null,
      updatedAt: row.updated_at || row.created_at || null,
    })),
  };
}

async function loadMailBudgetHealth(adminClient, now = new Date()) {
  const [configRows, counterRows] = await Promise.all([
    queryRows(adminClient, 'mail_abuse_budget_config', query => query
      .select('scope, event_type, window_seconds, max_attempts, enabled, updated_at')
      .order('updated_at', { ascending: false })
      .limit(120)),
    queryRows(adminClient, 'mail_abuse_budget_counters', query => query
      .select('scope, event_type, window_reset_at, used_count, updated_at')
      .order('updated_at', { ascending: false })
      .limit(240)),
  ]);

  const nowMs = new Date(now).getTime();
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const activeCounters = counterRows.filter((row) => {
    const resetAtMs = new Date(row.window_reset_at || 0).getTime();
    return Number.isFinite(resetAtMs) && resetAtMs > safeNowMs;
  });

  const items = configRows.map((config) => {
    const scope = String(config.scope || 'unknown');
    const eventType = String(config.event_type || '*');
    const maxAttempts = Math.max(0, normalizeNumber(config.max_attempts, 0));
    const matchingCounters = activeCounters.filter(row => (
      String(row.scope || 'unknown') === scope
      && String(row.event_type || '*') === eventType
    ));
    const maxUsed = matchingCounters.reduce(
      (max, row) => Math.max(max, normalizeNumber(row.used_count, 0)),
      0
    );
    const ratio = maxAttempts > 0 ? maxUsed / maxAttempts : 0;
    const enabled = normalizeBoolean(config.enabled);

    return {
      scope,
      eventType,
      enabled,
      windowSeconds: normalizeNumber(config.window_seconds, 0),
      maxAttempts,
      activeBuckets: matchingCounters.length,
      maxUsed,
      remaining: Math.max(0, maxAttempts - maxUsed),
      usageRatio: Number(ratio.toFixed(4)),
      risk: budgetRiskFromRatio(ratio, enabled),
      resetAt: minTimestamp(matchingCounters.map(row => row.window_reset_at)),
      updatedAt: config.updated_at || null,
    };
  }).sort((left, right) => (
    right.usageRatio - left.usageRatio
    || right.activeBuckets - left.activeBuckets
    || left.scope.localeCompare(right.scope)
    || left.eventType.localeCompare(right.eventType)
  ));

  const countsByRisk = countBy(items, 'risk', ['ok', 'notice', 'warning', 'exceeded', 'disabled']);
  const highWater = items.filter(item => ['warning', 'exceeded'].includes(item.risk));

  return {
    sampledConfig: configRows.length,
    sampledCounters: counterRows.length,
    activeCounters: activeCounters.length,
    countsByRisk,
    highWaterCount: highWater.length,
    latestAt: latestTimestamp([...configRows, ...counterRows]),
    items,
    topItems: items.slice(0, 12),
  };
}

async function loadMailHealth(adminClient, env, now = new Date()) {
  const [outboxResult, suppressionResult, eventsResult, budgetResult, runtimeResult] = await Promise.all([
    section('outbox', async () => {
      const rows = await queryRows(adminClient, 'mail_outbox', query => query
        .select('id, event_type, recipient_domain, status, attempt_count, next_attempt_at, last_error_code, last_error_redacted_json, provider_key, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(80));
      const nowMs = new Date(now).getTime();
      const queued = rows.filter(row => row.status === 'queued');
      const overdueQueued = queued.filter((row) => {
        const dueMs = new Date(row.next_attempt_at || 0).getTime();
        return Number.isFinite(dueMs) && dueMs <= nowMs;
      });
      return {
        sampled: rows.length,
        countsByStatus: countBy(rows, 'status', ['queued', 'sending', 'sent', 'failed', 'suppressed', 'cancelled']),
        countsByEventType: countBy(rows, 'event_type', []),
        dueQueued: overdueQueued.length,
        latestAt: latestTimestamp(rows),
        latestFailures: rows
          .filter(row => ['failed', 'suppressed'].includes(row.status))
          .slice(0, 5)
          .map(row => ({
            id: row.id,
            eventType: row.event_type || null,
            status: row.status || null,
            recipientDomain: row.recipient_domain || null,
            attemptCount: Number(row.attempt_count || 0),
            lastErrorCode: row.last_error_code || null,
            lastError: row.last_error_redacted_json || null,
            updatedAt: row.updated_at || row.created_at || null,
          })),
      };
    }),
    section('suppression', async () => {
      const rows = await queryRows(adminClient, 'mail_suppression', query => query
        .select('id, recipient_domain, reason, status, source, expires_at, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(80));
      return {
        sampled: rows.length,
        active: rows.filter(row => row.status === 'active').length,
        countsByReason: countBy(rows.filter(row => row.status === 'active'), 'reason', []),
        latestAt: latestTimestamp(rows),
        domains: [...new Set(rows
          .filter(row => row.status === 'active' && row.recipient_domain)
          .map(row => row.recipient_domain))]
          .slice(0, 12),
      };
    }),
    section('deliveryEvents', async () => {
      const rows = await queryRows(adminClient, 'mail_delivery_events', query => query
        .select('id, provider_key, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(80));
      const inboundEvents = rows.filter(row => String(row.event_type || '').startsWith('inbound_'));
      return {
        sampled: rows.length,
        countsByEventType: countBy(rows, 'event_type', []),
        inboundCount: inboundEvents.length,
        latestAt: latestTimestamp(rows, ['created_at']),
        latestInboundEvents: inboundEvents.slice(0, 6).map(row => ({
          id: row.id,
          providerKey: row.provider_key || null,
          eventType: row.event_type || null,
          createdAt: row.created_at || null,
        })),
        latestEvents: rows.slice(0, 6).map(row => ({
          id: row.id,
          providerKey: row.provider_key || null,
          eventType: row.event_type || null,
          createdAt: row.created_at || null,
        })),
      };
    }),
    section('budgets', () => loadMailBudgetHealth(adminClient, now)),
    section('runtime', () => loadMailRuntimeState(adminClient, env)),
  ]);

  const worker = getMailWorkerConfigFromEnv(env);
  const provider = getMailProviderConfigFromEnv(env);
  const failed = [outboxResult, suppressionResult, eventsResult, budgetResult, runtimeResult].filter(item => !item.ok);
  const runtime = runtimeResult.ok ? runtimeResult.value : null;

  return {
    ok: failed.length === 0,
    config: {
      workerEnabled: Boolean(worker.enabled),
      killSwitch: Boolean(worker.killSwitch),
      dryRun: Boolean(provider.dryRun),
      provider: provider.provider,
      providerKey: provider.providerKey,
      fromDomain: provider.fromAddress?.split('@')[1] || null,
      sendingDomain: provider.sendingDomain || null,
      stalwartSmtpConfigured: Boolean(
        provider.stalwart?.smtpHost
        && provider.stalwart?.smtpUsername
        && provider.stalwart?.smtpPasswordConfigured
      ),
      deliveryFeedbackSecretConfigured: Boolean(
        env.MAIL_DELIVERY_WEBHOOK_SECRET
        || env.STALWART_WEBHOOK_SECRET
        || env.POSTAL_WEBHOOK_SECRET
      ),
      inboundWebhookSecretConfigured: Boolean(getMailInboundWebhookSecret(env)),
      runtimeKillSwitch: runtime?.controls?.runtimeKillSwitch || 'inherit',
      effectiveKillSwitch: Boolean(runtime?.controls?.killSwitch ?? worker.killSwitch),
      events: runtime?.events || {},
    },
    runtime,
    outbox: outboxResult.ok ? outboxResult.value : null,
    suppression: suppressionResult.ok ? suppressionResult.value : null,
    deliveryEvents: eventsResult.ok ? eventsResult.value : null,
    budgets: budgetResult.ok ? budgetResult.value : null,
    warnings: failed.map(item => `${item.name}: ${item.error}`),
  };
}

async function loadQueueHealth(adminClient) {
  const [recoveryResult, apiClientsResult, ticketsResult] = await Promise.all([
    section('accountRecovery', async () => {
      const rows = await queryRows(adminClient, 'account_recovery_requests', query => query
        .select('id, request_type, status, delivery_channel, next_step, temporary_password_force_change, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(80));
      return {
        sampled: rows.length,
        pending: rows.filter(row => ['pending', 'processing', 'verified'].includes(row.status)).length,
        countsByStatus: countBy(rows, 'status', ['pending', 'processing', 'verified', 'rejected', 'closed']),
        countsByNextStep: countBy(rows, 'next_step', []),
        forcePasswordChange: rows.filter(row => row.temporary_password_force_change === true).length,
        latestAt: latestTimestamp(rows),
      };
    }),
    section('developerApi', async () => {
      const rows = await queryRows(adminClient, 'api_clients', query => query
        .select('id, client_type, provider, status, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(80));
      return {
        sampled: rows.length,
        pending: rows.filter(row => row.client_type === 'developer' && row.status === 'pending').length,
        officialBotActive: rows.filter(row => row.client_type === 'official_bot' && row.status === 'active').length,
        countsByStatus: countBy(rows, 'status', ['pending', 'active', 'rejected', 'revoked']),
        latestAt: latestTimestamp(rows),
      };
    }),
    section('tickets', async () => {
      const rows = await queryRows(adminClient, 'tickets', query => query
        .select('id, target_role, type, status, priority, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(120));
      return {
        sampled: rows.length,
        open: rows.filter(row => ['pending', 'processing'].includes(row.status)).length,
        urgentOpen: rows.filter(row => ['pending', 'processing'].includes(row.status) && row.priority === 'urgent').length,
        countsByStatus: countBy(rows, 'status', ['pending', 'processing', 'resolved', 'rejected', 'closed']),
        countsByPriority: countBy(rows, 'priority', ['urgent', 'high', 'medium', 'low']),
        latestAt: latestTimestamp(rows),
      };
    }),
  ]);

  const failed = [recoveryResult, apiClientsResult, ticketsResult].filter(item => !item.ok);
  return {
    ok: failed.length === 0,
    accountRecovery: recoveryResult.ok ? recoveryResult.value : null,
    developerApi: apiClientsResult.ok ? apiClientsResult.value : null,
    tickets: ticketsResult.ok ? ticketsResult.value : null,
    warnings: failed.map(item => `${item.name}: ${item.error}`),
  };
}

function summarizeManualPlaceholders({ characters = [], pools = [] } = {}) {
  const characterPlaceholders = normalizeRows(characters)
    .filter(row => classifyCharacterIdSource(row?.id) === 'manual_placeholder')
    .map(row => ({
      id: row.id,
      name: row.name || row.id || '',
      type: row.type === 'weapon' ? 'weapon' : 'character',
      rarity: row.rarity || null,
      updatedAt: row.updated_at || row.created_at || null,
    }));

  const poolPlaceholders = normalizeRows(pools)
    .filter(row => classifyPoolIdSource(row?.pool_id) === 'manual_placeholder')
    .map(row => ({
      id: row.pool_id,
      name: row.name || row.pool_id || '',
      type: row.type || null,
      startTime: row.start_time || null,
      endTime: row.end_time || null,
      updatedAt: row.updated_at || row.created_at || null,
    }));

  const characterCount = characterPlaceholders.filter(row => row.type !== 'weapon').length;
  const weaponCount = characterPlaceholders.filter(row => row.type === 'weapon').length;
  const poolCount = poolPlaceholders.length;
  const total = characterCount + weaponCount + poolCount;

  return {
    sampledCharacters: normalizeRows(characters).length,
    sampledPools: normalizeRows(pools).length,
    characterCount,
    weaponCount,
    poolCount,
    total,
    status: total > 0 ? 'needs_official_id' : 'ok',
    latestAt: latestTimestamp([
      ...characterPlaceholders.map(row => ({ updated_at: row.updatedAt })),
      ...poolPlaceholders.map(row => ({ updated_at: row.updatedAt })),
    ]),
    samples: {
      characters: characterPlaceholders.slice(0, 6),
      pools: poolPlaceholders.slice(0, 6),
    },
  };
}

async function loadDataReadinessHealth(adminClient) {
  const [characters, pools] = await Promise.all([
    queryRows(adminClient, 'characters', query => query
      .select('id, name, type, rarity, updated_at, created_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(500)),
    queryRows(adminClient, 'pools', query => query
      .select('pool_id, name, type, start_time, end_time, updated_at, created_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(500)),
  ]);
  const officialId = summarizeManualPlaceholders({ characters, pools });

  return {
    ok: true,
    officialId,
    latestAt: officialId.latestAt,
    warnings: officialId.total > 0
      ? [`officialId: ${officialId.total} 个手动占位 ID 仍待官方 ID 或人工映射`]
      : [],
  };
}

function deriveOverallStatus(parts) {
  const warnings = parts.flatMap(part => part?.warnings || []);
  const hasFailures = parts.some(part => part?.ok === false);
  const mail = parts.find(part => part?.kind === 'mail');
  const queue = parts.find(part => part?.kind === 'queues');
  const ops = parts.find(part => part?.kind === 'ops');
  const dataReadiness = parts.find(part => part?.kind === 'dataReadiness');

  const dueMail = Number(mail?.outbox?.dueQueued || 0);
  const failedMail = Number(mail?.outbox?.countsByStatus?.failed || 0);
  const mailBudgetPressure = Number(mail?.budgets?.countsByRisk?.warning || 0)
    + Number(mail?.budgets?.countsByRisk?.exceeded || 0);
  const openTickets = Number(queue?.tickets?.open || 0);
  const urgentTickets = Number(queue?.tickets?.urgentOpen || 0);
  const pendingRecovery = Number(queue?.accountRecovery?.pending || 0);
  const pendingDevApi = Number(queue?.developerApi?.pending || 0);
  const opsFailures = Number(ops?.countsByStatus?.failure || 0);
  const opsMissedSchedules = Number(ops?.cron?.missedCount || 0);
  const officialIdBacklog = Number(dataReadiness?.officialId?.total || 0);
  const publicCache = parts.find(part => part?.kind === 'publicCache');
  const publicAnalyticsAttention = ['notice', 'warning'].includes(publicCache?.analytics?.level)
    ? 1
    : 0;

  const attentionCount = dueMail
    + failedMail
    + mailBudgetPressure
    + urgentTickets
    + pendingRecovery
    + pendingDevApi
    + opsFailures
    + opsMissedSchedules
    + officialIdBacklog
    + publicAnalyticsAttention;

  if (hasFailures || warnings.length > 0) {
    return {
      level: 'warning',
      label: '部分检查不可用',
      attentionCount,
    };
  }

  if (attentionCount > 0 || openTickets > 0) {
    return {
      level: urgentTickets > 0
        || failedMail > 0
        || mailBudgetPressure > 0
        || opsFailures > 0
        || opsMissedSchedules > 0
        ? 'warning'
        : 'notice',
      label: '有待处理事项',
      attentionCount,
    };
  }

  return {
    level: 'ok',
    label: '运行正常',
    attentionCount: 0,
  };
}

const WORKBENCH_SEVERITY_RANK = {
  danger: 0,
  warning: 1,
  notice: 2,
};

function getHealthSection(parts, kind) {
  return parts.find(part => part?.kind === kind) || {};
}

function pushWorkbenchAction(actions, action) {
  const count = Number(action?.count || 0);
  if (!Number.isFinite(count) || count <= 0) return;
  actions.push({
    id: action.id,
    severity: action.severity || 'notice',
    title: action.title,
    description: action.description,
    count,
    target: action.target || 'siteHealth',
    reason: action.reason || null,
    updatedAt: action.updatedAt || null,
  });
}

function buildWorkbenchActions(parts, generatedAt) {
  const content = getHealthSection(parts, 'content');
  const publicCache = getHealthSection(parts, 'publicCache');
  const ops = getHealthSection(parts, 'ops');
  const mail = getHealthSection(parts, 'mail');
  const queues = getHealthSection(parts, 'queues');
  const dataReadiness = getHealthSection(parts, 'dataReadiness');
  const actions = [];

  const contentFailures = normalizeRows(content.items).filter(item => item?.ok === false).length;
  pushWorkbenchAction(actions, {
    id: 'content-read-failures',
    severity: 'warning',
    title: '内容检查有读取失败',
    description: '部分内容表无法读取，先确认表结构、字段名或后台权限是否变化。',
    count: contentFailures,
    target: 'siteHealth',
    reason: 'content_table_read_failed',
    updatedAt: content.latestAt,
  });

  const publicAnalytics = publicCache.analytics || {};
  if (['notice', 'warning'].includes(publicAnalytics.level)) {
    pushWorkbenchAction(actions, {
      id: 'public-analytics-stale',
      severity: publicAnalytics.level === 'warning' ? 'warning' : 'notice',
      title: publicAnalytics.level === 'warning' ? '公共统计需要刷新或检查' : '公共统计可能不是最新',
      description: normalizeRows(publicAnalytics.warnings).slice(0, 2).join(' / ')
        || '全服统计缓存、趋势或聚合样本需要复核。',
      count: 1,
      target: 'siteHealth',
      reason: 'public_analytics_attention',
      updatedAt: publicAnalytics.latestAt,
    });
  }

  const opsFailures = Number(ops.countsByStatus?.failure || 0);
  const missedSchedules = Number(ops.cron?.missedCount || 0);
  const consecutiveFailures = Number(ops.health?.maxConsecutiveFailures || 0);
  pushWorkbenchAction(actions, {
    id: 'ops-automation-failures',
    severity: 'warning',
    title: '运营自动化需要处理',
    description: missedSchedules > 0
      ? `有 ${missedSchedules} 项定时任务错过预期时间。`
      : `${ops.health?.worstJobLabel || ops.health?.worstJobId || '自动化任务'} 连续失败 ${consecutiveFailures} 次。`,
    count: opsFailures + missedSchedules + Math.max(0, consecutiveFailures > 0 && opsFailures === 0 ? 1 : 0),
    target: 'automation',
    reason: 'ops_automation_attention',
    updatedAt: ops.health?.latestFailureAt || ops.health?.latestSuccessAt,
  });

  const failedMail = Number(mail.outbox?.countsByStatus?.failed || 0);
  pushWorkbenchAction(actions, {
    id: 'mail-failed-outbox',
    severity: 'warning',
    title: '邮件发送失败待处理',
    description: '邮件队列存在失败记录，检查失败原因、域名暂停和服务端发信状态。',
    count: failedMail,
    target: 'mailStatus',
    reason: 'mail_outbox_failed',
    updatedAt: mail.outbox?.latestAt,
  });

  const dueMail = Number(mail.outbox?.dueQueued || 0);
  pushWorkbenchAction(actions, {
    id: 'mail-due-outbox',
    severity: 'notice',
    title: '邮件队列有到期任务',
    description: '有邮件已经到达可发送时间，确认队列处理器是否正常执行。',
    count: dueMail,
    target: 'mailStatus',
    reason: 'mail_outbox_due',
    updatedAt: mail.outbox?.latestAt,
  });

  const budgetWarning = Number(mail.budgets?.countsByRisk?.warning || 0);
  const budgetExceeded = Number(mail.budgets?.countsByRisk?.exceeded || 0);
  pushWorkbenchAction(actions, {
    id: 'mail-budget-pressure',
    severity: budgetExceeded > 0 ? 'warning' : 'notice',
    title: budgetExceeded > 0 ? '邮件额度已超过阈值' : '邮件额度接近阈值',
    description: '检查发送额度、暂停域名和异常注册 / 重置请求，避免继续消耗发信资源。',
    count: budgetWarning + budgetExceeded,
    target: 'mailStatus',
    reason: 'mail_budget_pressure',
    updatedAt: mail.budgets?.latestAt,
  });

  pushWorkbenchAction(actions, {
    id: 'mail-suppression-active',
    severity: 'warning',
    title: '邮件域名暂停仍在生效',
    description: '存在活跃的退信或域名暂停记录，需要确认是否解除或继续保留。',
    count: Number(mail.suppression?.active || 0),
    target: 'mailStatus',
    reason: 'mail_suppression_active',
    updatedAt: mail.suppression?.latestAt,
  });

  const openTickets = Number(queues.tickets?.open || 0);
  const urgentTickets = Number(queues.tickets?.urgentOpen || 0);
  pushWorkbenchAction(actions, {
    id: 'tickets-open',
    severity: urgentTickets > 0 ? 'danger' : 'notice',
    title: urgentTickets > 0 ? '紧急工单待处理' : '工单待处理',
    description: urgentTickets > 0
      ? `有 ${urgentTickets} 个紧急工单，优先查看用户反馈和异常数据。`
      : '有未关闭工单，查看是否需要回复、转状态或关闭。',
    count: openTickets,
    target: 'tickets',
    reason: 'tickets_need_staff_attention',
    updatedAt: queues.tickets?.latestAt,
  });

  pushWorkbenchAction(actions, {
    id: 'account-recovery-pending',
    severity: 'notice',
    title: '账号恢复申请待核验',
    description: '处理邮件不可达、人工恢复和临时密码强制改密相关申请。',
    count: Number(queues.accountRecovery?.pending || 0),
    target: 'accountRecovery',
    reason: 'account_recovery_pending',
    updatedAt: queues.accountRecovery?.latestAt,
  });

  pushWorkbenchAction(actions, {
    id: 'developer-api-pending',
    severity: 'notice',
    title: '开发者 API 申请待审核',
    description: '查看申请用途、风险提示和审核备注，决定通过或拒绝。',
    count: Number(queues.developerApi?.pending || 0),
    target: 'developerApi',
    reason: 'developer_api_pending',
    updatedAt: queues.developerApi?.latestAt,
  });

  const officialId = dataReadiness.officialId || {};
  pushWorkbenchAction(actions, {
    id: 'official-id-backlog',
    severity: 'warning',
    title: '官方 ID / 占位数据待收口',
    description: `角色 ${officialId.characterCount || 0} / 武器 ${officialId.weaponCount || 0} / 卡池 ${officialId.poolCount || 0} 仍待官方 ID 或人工映射。`,
    count: Number(officialId.total || 0),
    target: Number(officialId.poolCount || 0) > 0 ? 'pools' : 'characters',
    reason: 'official_id_backlog',
    updatedAt: officialId.latestAt,
  });

  const sectionWarnings = parts.flatMap(part => normalizeRows(part?.warnings)
    .map(warning => ({ kind: part?.kind || 'unknown', warning })));
  pushWorkbenchAction(actions, {
    id: 'site-health-warnings',
    severity: 'warning',
    title: '站点健康检查有告警',
    description: sectionWarnings.slice(0, 2).map(item => `${item.kind}: ${item.warning}`).join(' / '),
    count: sectionWarnings.length,
    target: 'siteHealth',
    reason: 'site_health_warnings',
    updatedAt: generatedAt,
  });

  const sortedActions = actions.sort((left, right) => {
    const rankDelta = (WORKBENCH_SEVERITY_RANK[left.severity] ?? 9)
      - (WORKBENCH_SEVERITY_RANK[right.severity] ?? 9);
    if (rankDelta !== 0) return rankDelta;
    return String(left.id).localeCompare(String(right.id));
  });
  const countsBySeverity = sortedActions.reduce((counts, action) => {
    counts[action.severity] = (counts[action.severity] || 0) + 1;
    return counts;
  }, { danger: 0, warning: 0, notice: 0 });
  const highestSeverity = sortedActions[0]?.severity || 'ok';

  return {
    actions: sortedActions,
    countsBySeverity,
    highestSeverity,
    generatedAt,
  };
}

export async function buildAdminSiteHealth({
  adminClient,
  env = readEnvironment(),
  now = new Date(),
} = {}) {
  if (!adminClient?.from) {
    return {
      ok: false,
      generatedAt: toIsoTimestamp(now),
      error: 'Supabase admin client is not configured',
    };
  }

  const [
    contentResult,
    publicCacheResult,
    opsResult,
    mailResult,
    queuesResult,
    dataReadinessResult,
  ] = await Promise.all([
    section('content', () => loadContentHealth(adminClient)),
    section('publicCache', () => loadPublicCacheHealth(adminClient, now)),
    section('ops', () => loadOpsHealth(adminClient, now)),
    section('mail', () => loadMailHealth(adminClient, env, now)),
    section('queues', () => loadQueueHealth(adminClient)),
    section('dataReadiness', () => loadDataReadinessHealth(adminClient)),
  ]);

  const sections = [
    {
      kind: 'content',
      ...(contentResult.ok ? contentResult.value : { ok: false, warnings: [contentResult.error] }),
    },
    {
      kind: 'publicCache',
      ...(publicCacheResult.ok ? publicCacheResult.value : { ok: false, warnings: [publicCacheResult.error] }),
    },
    {
      kind: 'ops',
      ...(opsResult.ok ? opsResult.value : { ok: false, warnings: [opsResult.error] }),
    },
    {
      kind: 'mail',
      ...(mailResult.ok ? mailResult.value : { ok: false, warnings: [mailResult.error] }),
    },
    {
      kind: 'queues',
      ...(queuesResult.ok ? queuesResult.value : { ok: false, warnings: [queuesResult.error] }),
    },
    {
      kind: 'dataReadiness',
      ...(dataReadinessResult.ok ? dataReadinessResult.value : { ok: false, warnings: [dataReadinessResult.error] }),
    },
  ];
  const overall = deriveOverallStatus(sections);
  const generatedAt = toIsoTimestamp(now);
  const workbench = buildWorkbenchActions(sections, generatedAt);

  return {
    ok: sections.every(item => item.ok !== false),
    generatedAt,
    overall,
    workbench,
    content: sections.find(item => item.kind === 'content'),
    publicCache: sections.find(item => item.kind === 'publicCache'),
    ops: sections.find(item => item.kind === 'ops'),
    mail: sections.find(item => item.kind === 'mail'),
    queues: sections.find(item => item.kind === 'queues'),
    dataReadiness: sections.find(item => item.kind === 'dataReadiness'),
    warnings: sections.flatMap(item => item.warnings || []),
  };
}

export const __internal = {
  buildWorkbenchActions,
  buildOpsCronHealth,
  buildOpsRunHealth,
  countBy,
  deriveOverallStatus,
  loadDataReadinessHealth,
  loadMailBudgetHealth,
  latestTimestamp,
  normalizeOpsRunDurationMs,
  percentileNumber,
  summarizeManualPlaceholders,
};
