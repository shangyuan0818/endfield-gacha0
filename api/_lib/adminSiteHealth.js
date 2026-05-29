import { getMailProviderConfigFromEnv } from './mailProviderAdapter.js';
import { getMailInboundWebhookSecret } from './mailInboundEvents.js';
import { getMailWorkerConfigFromEnv } from './mailOutboxWorker.js';
import { loadMailRuntimeState } from './mailRuntimeConfig.js';
import { PUBLIC_CACHE_EPOCH_KEY, normalizeCacheVersion } from './publicCache.js';

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

async function loadPublicCacheHealth(adminClient) {
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
    section('poolAnalytics', () => loadLatestContent(adminClient, {
      table: 'public_pool_analytics_cache',
      fields: 'pool_id, pool_type, total_pulls, source_version, last_pull_at, updated_at',
      label: '公共卡池聚合',
      mapRow: row => ({
        poolId: row.pool_id,
        poolType: row.pool_type || null,
        totalPulls: Number(row.total_pulls || 0),
        sourceVersion: row.source_version || null,
        lastPullAt: row.last_pull_at || null,
        updatedAt: row.updated_at || null,
      }),
    })),
    section('poolTrends', () => loadLatestContent(adminClient, {
      table: 'public_pool_trend_cache',
      fields: 'metric, granularity, period_start, pool_type, pool_id, value, source_version, updated_at',
      label: '公共趋势聚合',
      mapRow: row => ({
        metric: row.metric || null,
        granularity: row.granularity || null,
        periodStart: row.period_start || null,
        poolType: row.pool_type || null,
        poolId: row.pool_id || null,
        value: Number(row.value || 0),
        sourceVersion: row.source_version || null,
        updatedAt: row.updated_at || null,
      }),
    })),
  ]);

  const failed = checks.filter(item => !item.ok);
  const byName = new Map(checks.map(item => [item.name, item]));

  return {
    ok: failed.length === 0,
    epoch: byName.get('epoch')?.ok ? byName.get('epoch').value : null,
    aggregates: checks
      .filter(item => item.name !== 'epoch')
      .map(item => (item.ok ? item.value : {
        key: item.name,
        ok: false,
        error: item.error,
      })),
    warnings: failed.map(item => `${item.name}: ${item.error}`),
  };
}

async function loadOpsHealth(adminClient) {
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

  return {
    ok: true,
    totalSampled: rows.length,
    countsByStatus: countBy(rows, 'status', ['success', 'failure', 'skipped']),
    latestAt: latestTimestamp(rows),
    latestRuns: [...latestByJob.values()].slice(0, 8).map(row => ({
      id: row.id,
      jobId: row.job_id,
      jobLabel: row.job_label || row.job_id,
      triggerType: row.trigger_type || null,
      status: row.status || null,
      presentationStatus: row.summary?.ops?.presentationStatus || row.status || null,
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

function deriveOverallStatus(parts) {
  const warnings = parts.flatMap(part => part?.warnings || []);
  const hasFailures = parts.some(part => part?.ok === false);
  const mail = parts.find(part => part?.kind === 'mail');
  const queue = parts.find(part => part?.kind === 'queues');
  const ops = parts.find(part => part?.kind === 'ops');

  const dueMail = Number(mail?.outbox?.dueQueued || 0);
  const failedMail = Number(mail?.outbox?.countsByStatus?.failed || 0);
  const mailBudgetPressure = Number(mail?.budgets?.countsByRisk?.warning || 0)
    + Number(mail?.budgets?.countsByRisk?.exceeded || 0);
  const openTickets = Number(queue?.tickets?.open || 0);
  const urgentTickets = Number(queue?.tickets?.urgentOpen || 0);
  const pendingRecovery = Number(queue?.accountRecovery?.pending || 0);
  const pendingDevApi = Number(queue?.developerApi?.pending || 0);
  const opsFailures = Number(ops?.countsByStatus?.failure || 0);

  const attentionCount = dueMail + failedMail + mailBudgetPressure + urgentTickets + pendingRecovery + pendingDevApi + opsFailures;

  if (hasFailures || warnings.length > 0) {
    return {
      level: 'warning',
      label: '部分检查不可用',
      attentionCount,
    };
  }

  if (attentionCount > 0 || openTickets > 0) {
    return {
      level: urgentTickets > 0 || failedMail > 0 || mailBudgetPressure > 0 || opsFailures > 0 ? 'warning' : 'notice',
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
  ] = await Promise.all([
    section('content', () => loadContentHealth(adminClient)),
    section('publicCache', () => loadPublicCacheHealth(adminClient)),
    section('ops', () => loadOpsHealth(adminClient)),
    section('mail', () => loadMailHealth(adminClient, env, now)),
    section('queues', () => loadQueueHealth(adminClient)),
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
  ];
  const overall = deriveOverallStatus(sections);

  return {
    ok: sections.every(item => item.ok !== false),
    generatedAt: toIsoTimestamp(now),
    overall,
    content: sections.find(item => item.kind === 'content'),
    publicCache: sections.find(item => item.kind === 'publicCache'),
    ops: sections.find(item => item.kind === 'ops'),
    mail: sections.find(item => item.kind === 'mail'),
    queues: sections.find(item => item.kind === 'queues'),
    warnings: sections.flatMap(item => item.warnings || []),
  };
}

export const __internal = {
  countBy,
  deriveOverallStatus,
  loadMailBudgetHealth,
  latestTimestamp,
};
