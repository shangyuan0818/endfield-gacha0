import assert from 'node:assert/strict';

import { buildAdminSiteHealth } from '../api/_lib/adminSiteHealth.js';

const NOW = new Date('2026-06-08T04:05:06.000Z');

const TABLE_COLUMNS = {
  announcements: new Set([
    'id',
    'title',
    'announcement_type',
    'severity',
    'is_active',
    'source_id',
    'published_at',
    'updated_at',
    'created_at',
  ]),
  pools: new Set([
    'pool_id',
    'name',
    'type',
    'start_time',
    'end_time',
    'updated_at',
    'created_at',
  ]),
  characters: new Set([
    'id',
    'name',
    'type',
    'rarity',
    'updated_at',
    'created_at',
  ]),
  site_config: new Set([
    'key',
    'value',
    'label',
    'category',
    'updated_at',
    'updated_by',
  ]),
  public_pool_analytics_cache: new Set([
    'pool_id',
    'pool_type',
    'total_pulls',
    'source_version',
    'last_pull_at',
    'updated_at',
  ]),
  public_pool_trend_cache: new Set([
    'metric',
    'granularity',
    'period_start',
    'pool_type',
    'pool_id',
    'value',
    'source_version',
    'updated_at',
  ]),
  ops_automation_runs: new Set([
    'id',
    'job_id',
    'job_label',
    'trigger_type',
    'status',
    'summary',
    'error_message',
    'started_at',
    'finished_at',
    'created_at',
    'updated_at',
  ]),
  mail_outbox: new Set([
    'id',
    'event_type',
    'recipient_domain',
    'status',
    'attempt_count',
    'next_attempt_at',
    'last_error_code',
    'last_error_redacted_json',
    'provider_key',
    'created_at',
    'updated_at',
  ]),
  mail_suppression: new Set([
    'id',
    'recipient_domain',
    'reason',
    'status',
    'source',
    'expires_at',
    'created_at',
    'updated_at',
  ]),
  mail_delivery_events: new Set([
    'id',
    'provider_key',
    'event_type',
    'created_at',
  ]),
  mail_abuse_budget_config: new Set([
    'scope',
    'event_type',
    'window_seconds',
    'max_attempts',
    'enabled',
    'updated_at',
  ]),
  mail_abuse_budget_counters: new Set([
    'scope',
    'event_type',
    'window_reset_at',
    'used_count',
    'updated_at',
  ]),
  account_recovery_requests: new Set([
    'id',
    'request_type',
    'status',
    'delivery_channel',
    'next_step',
    'temporary_password_force_change',
    'created_at',
    'updated_at',
  ]),
  api_clients: new Set([
    'id',
    'client_type',
    'provider',
    'status',
    'created_at',
    'updated_at',
  ]),
  tickets: new Set([
    'id',
    'target_role',
    'type',
    'status',
    'priority',
    'created_at',
    'updated_at',
  ]),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoSensitiveValue(value, label = 'serialized output') {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('raw.user@example.com'), false, `${label} must not include raw recipient email`);
  assert.equal(serialized.includes('smtp-password-secret'), false, `${label} must not include SMTP password`);
  assert.equal(serialized.includes('feedback-secret-value'), false, `${label} must not include webhook secret`);
  assert.equal(serialized.includes('reset-token-secret'), false, `${label} must not include reset token`);
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.ordering = [];
    this.limitValue = null;
    this.selectedFields = [];
  }

  select(fields = '') {
    this.selectedFields = String(fields)
      .split(',')
      .map(field => field.trim())
      .filter(Boolean)
      .map((field) => {
        const aliasParts = field.split(':');
        const source = aliasParts.length > 1 ? aliasParts[1] : aliasParts[0];
        return source.split(/[!(]/)[0].trim();
      })
      .filter(field => field && field !== '*');
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  order(field, options = {}) {
    this.ordering.push({ field, ascending: options.ascending !== false });
    return this;
  }

  limit(value) {
    this.limitValue = Number(value) || null;
    return Promise.resolve(this.client.executeQuery(this));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.executeQuery(this)).then(resolve, reject);
  }
}

function rowMatches(query, row) {
  return query.filters.every(filter => row?.[filter.field] === filter.value);
}

function compareNullableDates(left, right, ascending) {
  const leftMs = new Date(left || 0).getTime();
  const rightMs = new Date(right || 0).getTime();
  const safeLeft = Number.isFinite(leftMs) ? leftMs : 0;
  const safeRight = Number.isFinite(rightMs) ? rightMs : 0;
  return ascending ? safeLeft - safeRight : safeRight - safeLeft;
}

function validateSelectedFields(query) {
  const knownColumns = TABLE_COLUMNS[query.table];
  if (!knownColumns || query.selectedFields.length === 0) {
    return null;
  }

  const unknownFields = query.selectedFields.filter(field => !knownColumns.has(field));
  if (unknownFields.length === 0) {
    return null;
  }

  return new Error(`${query.table}: unknown selected columns: ${unknownFields.join(', ')}`);
}

function createFakeAdminClient(fixtures = {}) {
  const rowsByTable = new Map(
    Object.entries(fixtures).map(([table, rows]) => [table, rows.map(clone)])
  );

  return {
    from(table) {
      return new QueryBuilder(this, table);
    },
    executeQuery(query) {
      const columnError = validateSelectedFields(query);
      if (columnError) {
        return {
          data: null,
          error: columnError,
        };
      }

      let rows = rowsByTable.get(query.table);
      if (!rows) {
        return {
          data: null,
          error: new Error(`missing fixture table: ${query.table}`),
        };
      }

      rows = rows.filter(row => rowMatches(query, row));
      query.ordering.forEach(({ field, ascending }) => {
        rows = [...rows].sort((left, right) => compareNullableDates(left?.[field], right?.[field], ascending));
      });
      if (query.limitValue != null) {
        rows = rows.slice(0, query.limitValue);
      }

      return { data: clone(rows), error: null };
    },
  };
}

const adminClient = createFakeAdminClient({
  announcements: [
    {
      id: 'announcement-1',
      title: '寻遗散记版本更新',
      announcement_type: 'update',
      severity: 'info',
      is_active: true,
      source_id: 'official-1',
      published_at: '2026-06-07T12:00:00.000Z',
      updated_at: '2026-06-07T12:30:00.000Z',
      created_at: '2026-06-07T12:20:00.000Z',
    },
  ],
  pools: [
    {
      pool_id: 'limited_pool_20260605',
      name: '拳出无悔',
      type: 'limited',
      start_time: '2026-06-05T04:00:00.000Z',
      end_time: '2026-06-26T03:59:59.000Z',
      updated_at: '2026-06-07T11:00:00.000Z',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  characters: [
    {
      id: 'char_official_001',
      name: '弭弗',
      type: 'character',
      rarity: 6,
      updated_at: '2026-06-07T10:00:00.000Z',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  site_config: [
    {
      key: 'public_cache_epoch',
      value: JSON.stringify({
        version: '1780000000000',
        scope: 'stats',
        reason: 'admin:test',
        updatedAt: '2026-06-07T12:40:00.000Z',
      }),
      label: '公共缓存版本',
      category: 'system',
      updated_at: '2026-06-07T12:40:00.000Z',
    },
    {
      key: 'home_roadmap_items',
      label: '首页路线图',
      category: 'content',
      updated_at: '2026-06-07T09:00:00.000Z',
    },
    {
      key: 'mail_runtime_config',
      value: JSON.stringify({
        version: 1,
        note: 'test runtime controls',
        events: {
          authMailActions: null,
          accountRecoveryOutbox: true,
          developerApiReview: null,
          ticketReply: null,
          adminAlert: false,
        },
        controls: {
          killSwitch: null,
          disabledEvents: ['email_login'],
          pausedDomains: ['paused.example'],
        },
      }),
      label: '邮件运行期开关',
      category: 'system',
      updated_at: '2026-06-07T12:50:00.000Z',
      updated_by: 'admin-user-id',
    },
  ],
  public_pool_analytics_cache: [
    {
      pool_id: 'limited_pool_20260605',
      pool_type: 'limited',
      total_pulls: 1200,
      source_version: 'analytics-v1',
      last_pull_at: '2026-06-07T12:20:00.000Z',
      updated_at: '2026-06-07T12:41:00.000Z',
    },
  ],
  public_pool_trend_cache: [
    {
      metric: 'pulls',
      granularity: 'day',
      period_start: '2026-06-07',
      pool_type: 'all',
      pool_id: 'all',
      value: 820,
      source_version: 'trend-v1',
      updated_at: '2026-06-07T12:42:00.000Z',
    },
  ],
  ops_automation_runs: [
    {
      id: 'ops-1',
      job_id: 'official-announcements',
      job_label: '官方公告同步',
      trigger_type: 'cron',
      status: 'success',
      summary: { ops: { presentationStatus: 'success' } },
      error_message: '',
      started_at: '2026-06-07T12:00:00.000Z',
      finished_at: '2026-06-07T12:01:00.000Z',
      created_at: '2026-06-07T12:00:00.000Z',
      updated_at: '2026-06-07T12:01:00.000Z',
    },
    {
      id: 'ops-2',
      job_id: 'pool-schedule',
      job_label: '卡池轮换同步',
      trigger_type: 'manual',
      status: 'failure',
      summary: { ops: { presentationStatus: 'failure' } },
      error_message: 'source unavailable',
      started_at: '2026-06-07T10:00:00.000Z',
      finished_at: '2026-06-07T10:01:00.000Z',
      created_at: '2026-06-07T10:00:00.000Z',
      updated_at: '2026-06-07T10:01:00.000Z',
    },
  ],
  mail_outbox: [
    {
      id: 'mail-1',
      event_type: 'password_reset',
      recipient_domain: 'outlook.com',
      status: 'queued',
      attempt_count: 1,
      next_attempt_at: '2026-06-08T04:00:00.000Z',
      last_error_code: null,
      provider_key: 'stalwart',
      created_at: '2026-06-08T03:50:00.000Z',
      updated_at: '2026-06-08T03:51:00.000Z',
    },
    {
      id: 'mail-2',
      event_type: 'password_reset',
      recipient_domain: 'example.com',
      status: 'failed',
      attempt_count: 3,
      next_attempt_at: '2026-06-08T05:00:00.000Z',
      last_error_code: 'smtp_rejected',
      last_error_redacted_json: {
        reason: 'smtp_rejected',
        safeMessage: 'SMTP rejected by remote server',
        diagnostics: {
          responseCode: 550,
          phase: 'send',
        },
      },
      provider_key: 'stalwart',
      created_at: '2026-06-08T02:00:00.000Z',
      updated_at: '2026-06-08T02:10:00.000Z',
    },
  ],
  mail_suppression: [
    {
      id: 'suppression-1',
      recipient_domain: 'example.com',
      reason: 'hard_bounce',
      status: 'active',
      source: 'provider_feedback',
      expires_at: null,
      created_at: '2026-06-07T00:00:00.000Z',
      updated_at: '2026-06-07T00:00:00.000Z',
    },
  ],
  mail_delivery_events: [
    {
      id: 'event-1',
      provider_key: 'stalwart',
      event_type: 'hard_bounce',
      created_at: '2026-06-07T00:00:00.000Z',
    },
    {
      id: 'event-2',
      provider_key: 'stalwart',
      event_type: 'inbound_received',
      created_at: '2026-06-08T01:00:00.000Z',
    },
  ],
  mail_abuse_budget_config: [
    {
      scope: 'global',
      event_type: '*',
      window_seconds: 86400,
      max_attempts: 500,
      enabled: true,
      updated_at: '2026-06-08T03:00:00.000Z',
    },
    {
      scope: 'event',
      event_type: 'password_reset',
      window_seconds: 86400,
      max_attempts: 100,
      enabled: true,
      updated_at: '2026-06-08T03:00:00.000Z',
    },
    {
      scope: 'domain',
      event_type: 'password_reset',
      window_seconds: 86400,
      max_attempts: 30,
      enabled: true,
      updated_at: '2026-06-08T03:00:00.000Z',
    },
    {
      scope: 'event',
      event_type: 'admin_alert',
      window_seconds: 86400,
      max_attempts: 50,
      enabled: false,
      updated_at: '2026-06-08T03:00:00.000Z',
    },
  ],
  mail_abuse_budget_counters: [
    {
      scope: 'global',
      event_type: '*',
      window_reset_at: '2026-06-09T00:00:00.000Z',
      used_count: 20,
      updated_at: '2026-06-08T03:30:00.000Z',
    },
    {
      scope: 'event',
      event_type: 'password_reset',
      window_reset_at: '2026-06-09T00:00:00.000Z',
      used_count: 85,
      updated_at: '2026-06-08T03:31:00.000Z',
    },
    {
      scope: 'domain',
      event_type: 'password_reset',
      window_reset_at: '2026-06-09T00:00:00.000Z',
      used_count: 10,
      updated_at: '2026-06-08T03:32:00.000Z',
    },
    {
      scope: 'event',
      event_type: 'password_reset',
      window_reset_at: '2026-06-08T00:00:00.000Z',
      used_count: 99,
      updated_at: '2026-06-07T20:00:00.000Z',
    },
  ],
  account_recovery_requests: [
    {
      id: 'recovery-1',
      request_type: 'password_reset',
      status: 'pending',
      delivery_channel: 'mail_outbox',
      next_step: 'mail_reset_queued',
      temporary_password_force_change: false,
      created_at: '2026-06-07T08:00:00.000Z',
      updated_at: '2026-06-07T08:00:00.000Z',
    },
  ],
  api_clients: [
    {
      id: 'client-1',
      client_type: 'developer',
      provider: null,
      status: 'pending',
      created_at: '2026-06-07T06:00:00.000Z',
      updated_at: '2026-06-07T06:00:00.000Z',
    },
    {
      id: 'client-2',
      client_type: 'official_bot',
      provider: 'telegram',
      status: 'active',
      created_at: '2026-06-07T05:00:00.000Z',
      updated_at: '2026-06-07T05:00:00.000Z',
    },
  ],
  tickets: [
    {
      id: 'ticket-1',
      target_role: 'super_admin',
      type: 'bug',
      status: 'pending',
      priority: 'urgent',
      created_at: '2026-06-07T07:00:00.000Z',
      updated_at: '2026-06-07T07:00:00.000Z',
    },
  ],
});

const health = await buildAdminSiteHealth({
  adminClient,
  env: {
    MAIL_PROVIDER: 'stalwart',
    MAIL_FROM_ADDRESS: 'no-reply@mail.example.com',
    MAIL_WORKER_DRY_RUN: 'false',
    MAIL_OUTBOX_WORKER_ENABLED: 'true',
    MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'false',
    STALWART_SMTP_HOST: 'mail.example.com',
    STALWART_SMTP_USERNAME: 'no-reply@mail.example.com',
    STALWART_SMTP_PASSWORD: 'smtp-password-secret',
    MAIL_DELIVERY_WEBHOOK_SECRET: 'feedback-secret-value',
    MAIL_INBOUND_WEBHOOK_SECRET: 'inbound-secret-value',
    MAIL_SENDING_DOMAIN: 'mail.example.com',
  },
  now: NOW,
});

assert.equal(health.ok, true);
assert.equal(health.generatedAt, NOW.toISOString());
assert.equal(health.content.items.length, 4);
assert.equal(health.publicCache.epoch.cacheVersion, '1780000000000');
assert.equal(health.publicCache.aggregates.length, 2);
assert.equal(health.ops.countsByStatus.failure, 1);
assert.equal(health.mail.config.stalwartSmtpConfigured, true);
assert.equal(health.mail.config.deliveryFeedbackSecretConfigured, true);
assert.equal(health.mail.config.inboundWebhookSecretConfigured, true);
assert.equal(health.mail.config.effectiveKillSwitch, false);
assert.equal(health.mail.runtime.config.note, 'test runtime controls');
assert.equal(health.mail.runtime.events.accountRecoveryOutbox.effective, false);
assert.equal(health.mail.runtime.events.accountRecoveryOutbox.runtime, 'enabled');
assert.equal(health.mail.runtime.events.adminAlert.effective, false);
assert.equal(health.mail.runtime.events.adminAlert.runtime, 'disabled');
assert.equal(health.mail.runtime.controls.disabledEvents.includes('email_login'), true);
assert.equal(health.mail.runtime.controls.pausedDomains.includes('paused.example'), true);
assert.equal(health.mail.outbox.countsByStatus.queued, 1);
assert.equal(health.mail.outbox.dueQueued, 1);
assert.equal(health.mail.outbox.countsByStatus.failed, 1);
assert.equal(health.mail.outbox.latestFailures[0].lastError.safeMessage, 'SMTP rejected by remote server');
assert.equal(health.mail.outbox.latestFailures[0].lastError.diagnostics.phase, 'send');
assert.equal(health.mail.deliveryEvents.inboundCount, 1);
assert.equal(health.mail.deliveryEvents.latestInboundEvents[0].eventType, 'inbound_received');
assert.equal(health.mail.suppression.active, 1);
assert.equal(health.mail.budgets.sampledConfig, 4);
assert.equal(health.mail.budgets.activeCounters, 3);
assert.equal(health.mail.budgets.countsByRisk.warning, 1);
assert.equal(health.mail.budgets.countsByRisk.disabled, 1);
assert.equal(health.mail.budgets.highWaterCount, 1);
assert.equal(health.mail.budgets.topItems[0].eventType, 'password_reset');
assert.equal(health.mail.budgets.topItems[0].risk, 'warning');
assert.equal(Object.hasOwn(health.mail.budgets.topItems[0], 'bucketKeyHash'), false);
assert.equal(health.queues.accountRecovery.pending, 1);
assert.equal(health.queues.developerApi.pending, 1);
assert.equal(health.queues.tickets.urgentOpen, 1);
assert.equal(health.overall.level, 'warning');
assert.equal(health.overall.attentionCount, 7);
assertNoSensitiveValue(health, 'site health');

const partialHealth = await buildAdminSiteHealth({
  adminClient: createFakeAdminClient({
    announcements: [],
    pools: [],
    characters: [],
    site_config: [],
  }),
  env: {},
  now: NOW,
});

assert.equal(partialHealth.ok, false);
assert.equal(partialHealth.overall.level, 'warning');
assert.ok(partialHealth.warnings.some(item => item.includes('mail_outbox') || item.includes('ops_automation_runs')));
assertNoSensitiveValue(partialHealth, 'partial site health');

console.log('ADMIN-HEALTH site health verification passed');
