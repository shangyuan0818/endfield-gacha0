import assert from 'node:assert/strict';
import net from 'node:net';

import { createMailProviderAdapter } from '../api/_lib/mailProviderAdapter.js';
import { runMailOutboxWorker } from '../api/_lib/mailOutboxWorker.js';
import { buildRecipientFingerprint } from '../api/_lib/mailAbuseGuards.js';

const HASH_SALT = 'verify-mail-outbox-worker';
const NOW = new Date('2026-06-06T04:05:06.000Z');
const RAW_EMAIL = 'Recover.User+worker@Example.COM';
const NORMALIZED_EMAIL = 'recover.user+worker@example.com';
const RECIPIENT = buildRecipientFingerprint(RAW_EMAIL, { salt: HASH_SALT });
const DEVELOPER_EMAIL = 'developer.review@example.com';
const DEVELOPER_RECIPIENT = buildRecipientFingerprint(DEVELOPER_EMAIL, { salt: HASH_SALT });
const TICKET_OWNER_EMAIL = 'ticket.owner@example.com';
const TICKET_OWNER_RECIPIENT = buildRecipientFingerprint(TICKET_OWNER_EMAIL, { salt: HASH_SALT });
const ADMIN_EMAIL = 'ops.alert@example.com';
const ADMIN_RECIPIENT = buildRecipientFingerprint(ADMIN_EMAIL, { salt: HASH_SALT });

function assertNoSensitiveValue(value, label = 'serialized output') {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('Recover.User'), false, `${label} must not include raw local part`);
  assert.equal(serialized.includes('recover.user'), false, `${label} must not include normalized local part`);
  assert.equal(serialized.includes(RAW_EMAIL), false, `${label} must not include raw recipient email`);
  assert.equal(serialized.includes(NORMALIZED_EMAIL), false, `${label} must not include normalized recipient email`);
  assert.equal(serialized.includes(DEVELOPER_EMAIL), false, `${label} must not include developer recipient email`);
  assert.equal(serialized.includes('developer.review'), false, `${label} must not include developer recipient local part`);
  assert.equal(serialized.includes(TICKET_OWNER_EMAIL), false, `${label} must not include ticket owner recipient email`);
  assert.equal(serialized.includes('ticket.owner'), false, `${label} must not include ticket owner recipient local part`);
  assert.equal(serialized.includes(ADMIN_EMAIL), false, `${label} must not include admin recipient email`);
  assert.equal(serialized.includes('ops.alert'), false, `${label} must not include admin recipient local part`);
  assert.equal(serialized.includes('reset-token-secret'), false, `${label} must not include reset token`);
  assert.equal(serialized.includes('game-uid-secret'), false, `${label} must not include game uid`);
  assert.equal(serialized.includes('user-id-secret'), false, `${label} must not include raw user id`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createOutboxRow(overrides = {}) {
  return {
    id: 'outbox-1',
    event_type: 'password_reset',
    recipient_email_hash: RECIPIENT.emailHash,
    recipient_domain: RECIPIENT.domain,
    template_key: 'auth.password-reset',
    locale: 'zh-CN',
    payload_redacted_json: {
      requestType: 'password_reset',
      resetLinkMode: 'worker_generate',
      recoveryRequestId: 'recovery-1',
      submittedAt: '2026-06-06T03:00:00.000Z',
      token: '[redacted]',
      game_uid: '[redacted]',
    },
    priority: 3,
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: '2026-06-06T04:00:00.000Z',
    provider_key: null,
    provider_message_id_hash: null,
    related_entity_type: 'account_recovery',
    related_entity_id: 'recovery-1',
    created_at: '2026-06-06T03:00:00.000Z',
    updated_at: '2026-06-06T03:00:00.000Z',
    ...overrides,
  };
}

function createRecoveryRow(overrides = {}) {
  return {
    id: 'recovery-1',
    email: NORMALIZED_EMAIL,
    matched_user_id: '11111111-1111-4111-8111-111111111111',
    request_type: 'password_reset',
    status: 'pending',
    delivery_channel: 'mail_outbox',
    next_step: 'mail_reset_queued',
    recovery_audit: {
      version: 1,
      events: [
        {
          type: 'request_received',
          at: '2026-06-06T03:00:00.000Z',
        },
      ],
    },
    created_at: '2026-06-06T03:00:00.000Z',
    ...overrides,
  };
}

function createDeveloperReviewOutboxRow(overrides = {}) {
  return createOutboxRow({
    id: 'outbox-developer-review-1',
    event_type: 'developer_api_review',
    recipient_email_hash: DEVELOPER_RECIPIENT.emailHash,
    recipient_domain: DEVELOPER_RECIPIENT.domain,
    template_key: 'developer-api.review',
    payload_redacted_json: {
      status: 'active',
      clientName: 'Review Test App',
      clientType: 'developer',
      hasReviewNote: true,
      grantedScopesCount: 1,
      token: '[redacted]',
      user_id: '[redacted]',
    },
    priority: 4,
    related_entity_type: 'api_client',
    related_entity_id: 'api-client-1',
    ...overrides,
  });
}

function createTicketReplyOutboxRow(overrides = {}) {
  return createOutboxRow({
    id: 'outbox-ticket-reply-1',
    event_type: 'ticket_reply',
    recipient_email_hash: TICKET_OWNER_RECIPIENT.emailHash,
    recipient_domain: TICKET_OWNER_RECIPIENT.domain,
    template_key: 'ticket.reply',
    payload_redacted_json: {
      ticketStatus: 'processing',
      targetRole: 'admin',
      actorRole: 'admin',
      replyId: '[redacted]',
      token: '[redacted]',
      user_id: '[redacted]',
    },
    priority: 5,
    related_entity_type: 'ticket',
    related_entity_id: 'ticket-1',
    ...overrides,
  });
}

function createAdminAlertOutboxRow(overrides = {}) {
  return createOutboxRow({
    id: 'outbox-admin-alert-1',
    event_type: 'admin_alert',
    recipient_email_hash: ADMIN_RECIPIENT.emailHash,
    recipient_domain: ADMIN_RECIPIENT.domain,
    template_key: 'admin.alert',
    payload_redacted_json: {
      summary: '邮件状态面板检测到队列异常，请查看后台。',
      secondary: '这是一条受控管理员自告警，不包含原始邮箱、Token 或用户私密字段。',
      source: 'admin-mail-status-panel',
      token: '[redacted]',
      user_id: '[redacted]',
    },
    priority: 3,
    related_entity_type: 'profile',
    related_entity_id: 'admin-user-1',
    ...overrides,
  });
}

function createDeveloperProfileRow(overrides = {}) {
  return {
    id: 'developer-user-1',
    email: DEVELOPER_EMAIL,
    username: 'developer-review-user',
    role: 'user',
    ...overrides,
  };
}

function createAdminProfileRow(overrides = {}) {
  return {
    id: 'admin-user-1',
    email: ADMIN_EMAIL,
    username: 'admin-alert-user',
    role: 'super_admin',
    ...overrides,
  };
}

function createTicketOwnerProfileRow(overrides = {}) {
  return {
    id: 'ticket-owner-user-1',
    email: TICKET_OWNER_EMAIL,
    username: 'ticket-owner-user',
    role: 'user',
    ...overrides,
  };
}

function createApiClientRow(overrides = {}) {
  return {
    id: 'api-client-1',
    owner_user_id: 'developer-user-1',
    client_type: 'developer',
    name: 'Review Test App',
    use_case: 'Read public analytics for a community dashboard.',
    status: 'active',
    review_note: '审核通过，请在设置页查看权限。',
    granted_scopes: ['public.read'],
    updated_at: '2026-06-06T04:01:00.000Z',
    created_at: '2026-06-06T03:01:00.000Z',
    ...overrides,
  };
}

function createTicketRow(overrides = {}) {
  return {
    id: 'ticket-1',
    user_id: 'ticket-owner-user-1',
    title: 'Mail notification ticket',
    status: 'open',
    target_role: 'admin',
    updated_at: '2026-06-06T04:01:00.000Z',
    created_at: '2026-06-06T03:01:00.000Z',
    ...overrides,
  };
}

async function withFakeSmtpServer(handler, callback) {
  const sessions = [];
  const server = net.createServer((socket) => {
    const session = {
      commands: [],
      data: '',
      authenticated: false,
      inData: false,
    };
    sessions.push(session);

    socket.setEncoding('utf8');
    socket.write('220 fake.smtp.local ESMTP\r\n');

    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      let lineEnd = buffer.indexOf('\n');

      while (lineEnd >= 0) {
        const rawLine = buffer.slice(0, lineEnd + 1);
        buffer = buffer.slice(lineEnd + 1);
        const line = rawLine.replace(/\r?\n$/, '');

        if (session.inData) {
          if (line === '.') {
            session.inData = false;
            socket.write('250 2.0.0 accepted\r\n');
          } else {
            session.data += `${line}\n`;
          }
        } else {
          session.commands.push(line.replace(/^AUTH PLAIN .+$/i, 'AUTH PLAIN [redacted]'));
          const upper = line.toUpperCase();

          if (upper.startsWith('EHLO')) {
            socket.write('250-fake.smtp.local\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
          } else if (upper.startsWith('AUTH PLAIN')) {
            session.authenticated = true;
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else if (upper.startsWith('MAIL FROM')) {
            socket.write(session.authenticated ? '250 2.1.0 OK\r\n' : '503 5.5.1 You must authenticate first.\r\n');
          } else if (upper.startsWith('RCPT TO')) {
            socket.write('250 2.1.5 OK\r\n');
          } else if (upper === 'DATA') {
            session.inData = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (upper === 'QUIT') {
            socket.write('221 2.0.0 Bye\r\n');
            socket.end();
          } else {
            socket.write('250 2.0.0 OK\r\n');
          }
        }

        lineEnd = buffer.indexOf('\n');
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  try {
    return await callback({
      host: address.address,
      port: address.port,
      sessions,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await handler?.(sessions);
  }
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = 'select';
    this.patch = null;
    this.insertPayload = null;
    this.filters = [];
    this.lteFilters = [];
    this.ordering = [];
    this.limitValue = null;
  }

  select() {
    return this;
  }

  update(patch) {
    this.operation = 'update';
    this.patch = patch;
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.insertPayload = payload;
    return Promise.resolve(this.client.executeQuery(this));
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  lte(field, value) {
    this.lteFilters.push({ field, value });
    return this;
  }

  order(field, options = {}) {
    this.ordering.push({ field, ascending: options.ascending !== false });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return Promise.resolve(this.client.executeQuery(this));
  }

  maybeSingle() {
    return Promise.resolve(this.client.executeQuery(this, { maybeSingle: true }));
  }

  single() {
    return Promise.resolve(this.client.executeQuery(this, { maybeSingle: true }));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.executeQuery(this)).then(resolve, reject);
  }
}

function normalizeField(row, field) {
  return row?.[field];
}

function rowMatches(query, row) {
  for (const filter of query.filters) {
    if (normalizeField(row, filter.field) !== filter.value) {
      return false;
    }
  }

  for (const filter of query.lteFilters) {
    const left = new Date(normalizeField(row, filter.field)).getTime();
    const right = new Date(filter.value).getTime();
    if (!Number.isFinite(left) || !Number.isFinite(right) || left > right) {
      return false;
    }
  }

  return true;
}

function sortRows(rows, ordering) {
  return [...rows].sort((left, right) => {
    for (const order of ordering) {
      const leftValue = normalizeField(left, order.field);
      const rightValue = normalizeField(right, order.field);
      if (leftValue === rightValue) {
        continue;
      }

      const result = String(leftValue ?? '').localeCompare(String(rightValue ?? ''), undefined, {
        numeric: true,
      });
      return order.ascending ? result : -result;
    }

    return 0;
  });
}

function createFakeAdminClient({
  outboxRows = [createOutboxRow()],
  recoveryRows = [createRecoveryRow()],
  profileRows = [createDeveloperProfileRow(), createTicketOwnerProfileRow(), createAdminProfileRow()],
  apiClientRows = [createApiClientRow()],
  ticketRows = [createTicketRow()],
  siteConfigRows = [],
  generateLinkActionLink = null,
  generateLinkError = null,
} = {}) {
  const state = {
    outboxRows: outboxRows.map(clone),
    recoveryRows: recoveryRows.map(clone),
    profileRows: profileRows.map(clone),
    apiClientRows: apiClientRows.map(clone),
    ticketRows: ticketRows.map(clone),
    siteConfigRows: siteConfigRows.map(clone),
    deliveryEvents: [],
    calls: [],
  };

  const client = {
    state,
    auth: {
      admin: {
        async generateLink({ email }) {
          state.calls.push({ type: 'generateLink', email });
          if (generateLinkError) {
            return { data: null, error: generateLinkError };
          }

          return {
            data: {
              properties: {
                action_link: generateLinkActionLink
                  || `https://example.test/auth/reset-password?token=reset-token-secret&email=${encodeURIComponent(email)}`,
              },
            },
            error: null,
          };
        },
      },
    },
    from(table) {
      state.calls.push({ type: 'from', table });
      return new QueryBuilder(client, table);
    },
    executeQuery(query, { maybeSingle = false } = {}) {
      state.calls.push({
        type: 'query',
        table: query.table,
        operation: query.operation,
        filters: query.filters,
        patch: query.patch,
        insertPayload: query.insertPayload,
      });

      if (query.table === 'mail_outbox') {
        if (query.operation === 'update') {
          const updatedRows = [];
          state.outboxRows = state.outboxRows.map((row) => {
            if (!rowMatches(query, row)) {
              return row;
            }

            const updatedRow = { ...row, ...query.patch };
            updatedRows.push(updatedRow);
            return updatedRow;
          });
          return { data: maybeSingle ? updatedRows[0] || null : updatedRows, error: null };
        }

        const rows = sortRows(
          state.outboxRows.filter((row) => rowMatches(query, row)),
          query.ordering
        ).slice(0, query.limitValue || state.outboxRows.length);
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'account_recovery_requests') {
        if (query.operation === 'update') {
          const updatedRows = [];
          state.recoveryRows = state.recoveryRows.map((row) => {
            if (!rowMatches(query, row)) {
              return row;
            }

            const updatedRow = { ...row, ...query.patch };
            updatedRows.push(updatedRow);
            return updatedRow;
          });
          return { data: maybeSingle ? updatedRows[0] || null : updatedRows, error: null };
        }

        const rows = state.recoveryRows.filter((row) => rowMatches(query, row));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'mail_delivery_events') {
        if (query.operation !== 'insert') {
          throw new Error(`Unexpected mail_delivery_events operation: ${query.operation}`);
        }

        state.deliveryEvents.push(clone(query.insertPayload));
        return { data: query.insertPayload, error: null };
      }

      if (query.table === 'profiles') {
        const rows = state.profileRows.filter((row) => rowMatches(query, row));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'api_clients') {
        const rows = state.apiClientRows.filter((row) => rowMatches(query, row));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'tickets') {
        const rows = state.ticketRows.filter((row) => rowMatches(query, row));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'site_config') {
        const rows = state.siteConfigRows
          .filter((row) => rowMatches(query, row))
          .slice(0, query.limitValue || state.siteConfigRows.length);
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
  };

  return client;
}

async function verifyDisabledWorker() {
  const client = createFakeAdminClient();
  const result = await runMailOutboxWorker({
    adminClient: client,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'false',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.code, 'mail_worker_disabled');
  assert.equal(client.state.outboxRows[0].status, 'queued');
}

async function verifyWorkerKillSwitch() {
  const client = createFakeAdminClient();
  const result = await runMailOutboxWorker({
    adminClient: client,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'true',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.code, 'mail_worker_kill_switch_enabled');
  assert.equal(result.stats.loaded, 0);
  assert.equal(client.state.outboxRows[0].status, 'queued');
}

async function verifyRuntimeKillSwitch() {
  const client = createFakeAdminClient({
    siteConfigRows: [
      {
        key: 'mail_runtime_config',
        value: JSON.stringify({
          version: 1,
          events: {},
          controls: {
            killSwitch: true,
            disabledEvents: [],
            pausedDomains: [],
          },
        }),
        updated_at: '2026-06-12T00:00:00.000Z',
        updated_by: 'admin-user-id',
      },
    ],
  });
  const result = await runMailOutboxWorker({
    adminClient: client,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'false',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.code, 'mail_worker_runtime_kill_switch_enabled');
  assert.equal(result.stats.loaded, 0);
  assert.equal(client.state.outboxRows[0].status, 'queued');
}

async function verifyDryRunWorker() {
  const client = createFakeAdminClient();
  const result = await runMailOutboxWorker({
    adminClient: client,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'true',
      MAIL_PROVIDER: 'stalwart',
      MAIL_WORKER_RETRY_DELAY_SECONDS: '60',
      APP_URL: 'https://ef-gacha.example',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.loaded, 1);
  assert.equal(result.stats.dryRun, 1);
  assert.equal(result.stats.sent, 0);
  assert.equal(result.results[0].status, 'dry_run');
  assert.equal(client.state.outboxRows[0].status, 'queued');
  assert.equal(client.state.outboxRows[0].attempt_count, 1);
  assert.equal(client.state.outboxRows[0].provider_key, 'stalwart:dry-run');
  assert.equal(client.state.outboxRows[0].next_attempt_at, '2026-06-06T04:06:06.000Z');
  assert.equal(client.state.recoveryRows[0].next_step, 'mail_reset_queued');
  assert.equal(client.state.deliveryEvents.length, 1);
  assert.equal(client.state.deliveryEvents[0].event_type, 'dry_run_accepted');
  assert.match(client.state.deliveryEvents[0].provider_message_id_hash, /^[a-f0-9]{64}$/);
  assertNoSensitiveValue(result, 'dry-run result');
  assertNoSensitiveValue(client.state.outboxRows, 'dry-run outbox rows');
  assertNoSensitiveValue(client.state.deliveryEvents, 'dry-run delivery events');
}

async function verifyLiveTransportSuccess() {
  const client = createFakeAdminClient();
  const sentMessages = [];
  const adapter = createMailProviderAdapter({
    env: {
      MAIL_PROVIDER: 'stalwart',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_FROM_ADDRESS: 'no-reply@example.test',
      MAIL_FROM_NAME: 'Endfield Test',
    },
    transport: async ({ message, config }) => {
      sentMessages.push(message);
      assert.equal(config.provider, 'stalwart');
      assert.equal(message.to, NORMALIZED_EMAIL);
      assert.match(message.text, /reset-token-secret/);
      return {
        ok: true,
        accepted: true,
        providerKey: 'stalwart',
        providerMessageId: 'provider-message-123',
        code: 'mail_provider_accepted',
        diagnostics: {
          email: NORMALIZED_EMAIL,
          token: 'reset-token-secret',
        },
      };
    },
  });
  const result = await runMailOutboxWorker({
    adminClient: client,
    adapter,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_WORKER_MAX_ATTEMPTS: '2',
      APP_URL: 'https://ef-gacha.example',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.sent, 1);
  assert.equal(sentMessages.length, 1);
  assert.equal(typeof sentMessages[0].html, 'string');
  assert.match(sentMessages[0].html, /<!doctype html>/i);
  assert.match(sentMessages[0].html, /Reset your password|重置密码/);
  assert.equal(client.state.outboxRows[0].status, 'sent');
  assert.equal(client.state.outboxRows[0].provider_key, 'stalwart');
  assert.match(client.state.outboxRows[0].provider_message_id_hash, /^[a-f0-9]{64}$/);
  assert.equal(client.state.outboxRows[0].provider_message_id_hash.includes('provider-message-123'), false);
  assert.equal(client.state.recoveryRows[0].next_step, 'mail_reset_sent');
  assert.equal(client.state.deliveryEvents[0].event_type, 'accepted');
  assert.equal(client.state.deliveryEvents[0].event_payload_redacted_json.email, undefined);
  assert.equal(client.state.deliveryEvents[0].event_payload_redacted_json.token, undefined);
  assertNoSensitiveValue(result, 'live success result');
  assertNoSensitiveValue(client.state.outboxRows, 'live success outbox rows');
  assertNoSensitiveValue(client.state.recoveryRows[0].recovery_audit, 'live success recovery audit');
  assertNoSensitiveValue(client.state.deliveryEvents, 'live success delivery events');
}

async function verifyMalformedAuthResetLinkRewrite() {
  const client = createFakeAdminClient({
    generateLinkActionLink: 'http://localhost:8000,https:/auth/v1/verify?token=reset-token-secret&type=recovery&redirect_to=https%3A%2F%2Fef-gacha.example%2Freset-password',
  });
  const sentMessages = [];
  const adapter = createMailProviderAdapter({
    env: {
      MAIL_PROVIDER: 'stalwart',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_FROM_ADDRESS: 'no-reply@example.test',
      MAIL_FROM_NAME: 'Endfield Test',
    },
    transport: async ({ message }) => {
      sentMessages.push(message);
      assert.match(
        message.text,
        /https:\/\/db\.example\.test\/auth\/v1\/verify\?token=reset-token-secret&type=recovery/
      );
      assert.equal(message.text.includes('localhost:8000'), false);
      return {
        ok: true,
        accepted: true,
        providerKey: 'stalwart',
        providerMessageId: 'provider-message-rewrite',
        code: 'mail_provider_accepted',
      };
    },
  });

  const result = await runMailOutboxWorker({
    adminClient: client,
    adapter,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_WORKER_MAX_ATTEMPTS: '2',
      APP_URL: 'https://ef-gacha.example',
      SUPABASE_URL: 'https://db.example.test',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.sent, 1);
  assert.equal(sentMessages.length, 1);
}

async function verifyDeveloperApiReviewNotificationSuccess() {
  const client = createFakeAdminClient({
    outboxRows: [createDeveloperReviewOutboxRow()],
  });
  const sentMessages = [];
  const adapter = createMailProviderAdapter({
    env: {
      MAIL_PROVIDER: 'stalwart',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_FROM_ADDRESS: 'no-reply@example.test',
      MAIL_FROM_NAME: 'Endfield Test',
    },
    transport: async ({ message }) => {
      sentMessages.push(message);
      assert.equal(message.to, DEVELOPER_EMAIL);
      assert.equal(message.templateKey, 'developer-api.review');
      assert.equal(message.eventType, 'developer_api_review');
      assert.equal(message.relatedEntityType, 'api_client');
      assert.equal(message.relatedEntityId, 'api-client-1');
      assert.match(message.subject, /开发者 API|Developer API/i);
      assert.match(message.html, /Review Test App/);
      assert.match(message.text, /审核状态已更新|review status/i);
      assert.equal(JSON.stringify(message.payload).includes('developer.review@example.com'), false);
      assert.equal(JSON.stringify(message.payload).includes('user-id-secret'), false);
      return {
        ok: true,
        accepted: true,
        providerKey: 'stalwart',
        providerMessageId: 'provider-message-developer-review',
        code: 'mail_provider_accepted',
        diagnostics: {
          email: DEVELOPER_EMAIL,
        },
      };
    },
  });

  const result = await runMailOutboxWorker({
    adminClient: client,
    adapter,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_WORKER_MAX_ATTEMPTS: '2',
      APP_URL: 'https://ef-gacha.example',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.sent, 1);
  assert.equal(sentMessages.length, 1);
  assert.equal(client.state.outboxRows[0].status, 'sent');
  assert.equal(client.state.deliveryEvents[0].event_type, 'accepted');
  assert.equal(client.state.recoveryRows[0].next_step, 'mail_reset_queued');
  assertNoSensitiveValue(result, 'developer review worker result');
  assertNoSensitiveValue(client.state.outboxRows, 'developer review outbox rows');
  assertNoSensitiveValue(client.state.deliveryEvents, 'developer review delivery events');
}

async function verifyTicketReplyNotificationSuccess() {
  const client = createFakeAdminClient({
    outboxRows: [createTicketReplyOutboxRow()],
  });
  const sentMessages = [];
  const adapter = createMailProviderAdapter({
    env: {
      MAIL_PROVIDER: 'stalwart',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_FROM_ADDRESS: 'no-reply@example.test',
      MAIL_FROM_NAME: 'Endfield Test',
    },
    transport: async ({ message }) => {
      sentMessages.push(message);
      assert.equal(message.to, TICKET_OWNER_EMAIL);
      assert.equal(message.templateKey, 'ticket.reply');
      assert.equal(message.eventType, 'ticket_reply');
      assert.equal(message.relatedEntityType, 'ticket');
      assert.equal(message.relatedEntityId, 'ticket-1');
      assert.match(message.subject, /工单|Ticket/i);
      assert.match(message.html, /Mail notification ticket/);
      assert.match(message.text, /工单|ticket/i);
      assert.equal(JSON.stringify(message.payload).includes(TICKET_OWNER_EMAIL), false);
      assert.equal(JSON.stringify(message.payload).includes('user-id-secret'), false);
      return {
        ok: true,
        accepted: true,
        providerKey: 'stalwart',
        providerMessageId: 'provider-message-ticket-reply',
        code: 'mail_provider_accepted',
        diagnostics: {
          email: TICKET_OWNER_EMAIL,
        },
      };
    },
  });

  const result = await runMailOutboxWorker({
    adminClient: client,
    adapter,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_WORKER_MAX_ATTEMPTS: '2',
      APP_URL: 'https://ef-gacha.example',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.sent, 1);
  assert.equal(sentMessages.length, 1);
  assert.equal(client.state.outboxRows[0].status, 'sent');
  assert.equal(client.state.deliveryEvents[0].event_type, 'accepted');
  assertNoSensitiveValue(result, 'ticket reply worker result');
  assertNoSensitiveValue(client.state.outboxRows, 'ticket reply outbox rows');
  assertNoSensitiveValue(client.state.deliveryEvents, 'ticket reply delivery events');
}

async function verifyAdminAlertNotificationSuccess() {
  const client = createFakeAdminClient({
    outboxRows: [createAdminAlertOutboxRow()],
  });
  const sentMessages = [];
  const adapter = createMailProviderAdapter({
    env: {
      MAIL_PROVIDER: 'stalwart',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_FROM_ADDRESS: 'no-reply@example.test',
      MAIL_FROM_NAME: 'Endfield Test',
    },
    transport: async ({ message }) => {
      sentMessages.push(message);
      assert.equal(message.to, ADMIN_EMAIL);
      assert.equal(message.templateKey, 'admin.alert');
      assert.equal(message.eventType, 'admin_alert');
      assert.equal(message.relatedEntityType, 'profile');
      assert.equal(message.relatedEntityId, 'admin-user-1');
      assert.match(message.subject, /管理员告警|admin alert/i);
      assert.match(message.html, /邮件状态面板检测到队列异常/);
      assert.match(message.text, /管理员告警|admin alert|队列异常/i);
      assert.equal(JSON.stringify(message.payload).includes(ADMIN_EMAIL), false);
      assert.equal(JSON.stringify(message.payload).includes('user-id-secret'), false);
      return {
        ok: true,
        accepted: true,
        providerKey: 'stalwart',
        providerMessageId: 'provider-message-admin-alert',
        code: 'mail_provider_accepted',
        diagnostics: {
          email: ADMIN_EMAIL,
        },
      };
    },
  });

  const result = await runMailOutboxWorker({
    adminClient: client,
    adapter,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_WORKER_MAX_ATTEMPTS: '2',
      APP_URL: 'https://ef-gacha.example',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.sent, 1);
  assert.equal(sentMessages.length, 1);
  assert.equal(client.state.outboxRows[0].status, 'sent');
  assert.equal(client.state.deliveryEvents[0].event_type, 'accepted');
  assertNoSensitiveValue(result, 'admin alert worker result');
  assertNoSensitiveValue(client.state.outboxRows, 'admin alert outbox rows');
  assertNoSensitiveValue(client.state.deliveryEvents, 'admin alert delivery events');
}

async function verifyLiveTransportMissingConfigFailure() {
  const client = createFakeAdminClient({
    outboxRows: [
      createOutboxRow({
        attempt_count: 2,
      }),
    ],
  });
  const result = await runMailOutboxWorker({
    adminClient: client,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'false',
      MAIL_WORKER_MAX_ATTEMPTS: '3',
      APP_URL: 'https://ef-gacha.example',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, false);
  assert.equal(result.stats.failed, 1);
  assert.equal(result.code, 'mail_worker_partial_failure');
  assert.equal(result.results[0].status, 'failed');
  assert.equal(result.results[0].code, 'stalwart_smtp_not_configured');
  assert.equal(client.state.outboxRows[0].status, 'failed');
  assert.equal(client.state.outboxRows[0].last_error_code, 'stalwart_smtp_not_configured');
  assert.equal(client.state.recoveryRows[0].next_step, 'mail_reset_failed');
  assert.equal(client.state.deliveryEvents[0].event_type, 'failed');
  assertNoSensitiveValue(result, 'live missing config result');
  assertNoSensitiveValue(client.state.outboxRows, 'live missing config outbox rows');
  assertNoSensitiveValue(client.state.recoveryRows[0].recovery_audit, 'live missing config recovery audit');
  assertNoSensitiveValue(client.state.deliveryEvents, 'live missing config delivery events');
}

async function verifyBuiltInStalwartSmtpTransportSuccess() {
  await withFakeSmtpServer(null, async ({ host, port, sessions }) => {
    const adapter = createMailProviderAdapter({
      env: {
        MAIL_PROVIDER: 'stalwart',
        MAIL_WORKER_DRY_RUN: 'false',
        MAIL_FROM_ADDRESS: 'no-reply@example.test',
        MAIL_FROM_NAME: 'Endfield Test',
        MAIL_SENDING_DOMAIN: 'example.test',
        STALWART_SMTP_HOST: host,
        STALWART_SMTP_PORT: String(port),
        STALWART_SMTP_USERNAME: 'no-reply@example.test',
        STALWART_SMTP_PASSWORD: 'smtp-secret',
        STALWART_SMTP_STARTTLS: 'false',
        STALWART_SMTP_ALLOW_INSECURE: 'true',
      },
    });

    const result = await adapter.send({
      from: { address: 'no-reply@example.test', name: 'Endfield Test' },
      to: NORMALIZED_EMAIL,
      subject: 'SMTP transport smoke',
      text: 'hello\n.world',
      templateKey: 'auth.password-reset',
      relatedEntityType: 'account_recovery',
      relatedEntityId: 'recovery-1',
    });

    assert.equal(result.ok, true);
    assert.equal(result.code, 'stalwart_smtp_accepted');
    assert.equal(result.providerKey, 'stalwart');
    assert.match(result.providerMessageId, /^<.+@example\.test>$/);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].authenticated, true);
    assert.equal(sessions[0].commands.includes('AUTH PLAIN [redacted]'), true);
    assert.equal(sessions[0].commands.some((line) => line.includes('smtp-secret')), false);
    assert.match(sessions[0].data, /Subject: SMTP transport smoke/);
    assert.match(sessions[0].data, /hello\n\.\.world/);
    assertNoSensitiveValue(result, 'built-in smtp transport result');
  });
}

async function verifyBuiltInSmtpTransportSendsMultipartHtml() {
  await withFakeSmtpServer(null, async ({ host, port, sessions }) => {
    const adapter = createMailProviderAdapter({
      env: {
        MAIL_PROVIDER: 'stalwart',
        MAIL_WORKER_DRY_RUN: 'false',
        MAIL_FROM_ADDRESS: 'no-reply@example.test',
        MAIL_FROM_NAME: 'Endfield Test',
        MAIL_SENDING_DOMAIN: 'example.test',
        STALWART_SMTP_HOST: host,
        STALWART_SMTP_PORT: String(port),
        STALWART_SMTP_USERNAME: 'no-reply@example.test',
        STALWART_SMTP_PASSWORD: 'smtp-secret',
        STALWART_SMTP_STARTTLS: 'false',
        STALWART_SMTP_ALLOW_INSECURE: 'true',
      },
    });

    const result = await adapter.send({
      from: { address: 'no-reply@example.test', name: 'Endfield Test' },
      to: NORMALIZED_EMAIL,
      subject: 'SMTP multipart smoke',
      text: 'Plain fallback',
      html: '<!doctype html><html><body><strong>HTML content</strong></body></html>',
      templateKey: 'auth.email-login',
      relatedEntityType: 'auth_action',
      relatedEntityId: 'email_login',
    });

    assert.equal(result.ok, true);
    assert.match(sessions[0].data, /^Content-Type: multipart\/alternative; boundary="endfield-.+"$/m);
    assert.match(sessions[0].data, /Content-Type: text\/plain; charset=UTF-8/);
    assert.match(sessions[0].data, /Content-Type: text\/html; charset=UTF-8/);
    assert.ok(
      sessions[0].data.includes('<!doctype html><html><body><strong>HTML content</strong></body></html>')
        || /=3C!doctype html=3E=3Chtml=3E=3Cbody=3E=3Cstrong=3EHTML content=3C\/strong=3E/.test(sessions[0].data),
      'multipart HTML body should be present as raw ASCII or quoted-printable encoded content'
    );
    assertNoSensitiveValue(result, 'multipart smtp transport result');
  });
}

async function verifySmtpTransportUsesHostDomainFallback() {
  await withFakeSmtpServer(null, async ({ host, port, sessions }) => {
    const adapter = createMailProviderAdapter({
      env: {
        MAIL_PROVIDER: 'stalwart',
        MAIL_WORKER_DRY_RUN: 'false',
        MAIL_FROM_ADDRESS: 'no-reply@leevident.com',
        MAIL_FROM_NAME: 'Endfield Test',
        STALWART_SMTP_HOST: host,
        STALWART_SMTP_PORT: String(port),
        STALWART_SMTP_USERNAME: 'no-reply@leevident.com',
        STALWART_SMTP_PASSWORD: 'smtp-secret',
        STALWART_SMTP_STARTTLS: 'false',
        STALWART_SMTP_ALLOW_INSECURE: 'true',
      },
    });

    const result = await adapter.send({
      to: NORMALIZED_EMAIL,
      subject: 'SMTP domain fallback smoke',
      text: 'hello',
      templateKey: 'auth.password-reset',
      relatedEntityType: 'account_recovery',
      relatedEntityId: 'recovery-1',
    });

    assert.equal(result.ok, true);
    assert.equal(adapter.config.sendingDomain, host);
    assert.equal(sessions[0].commands.includes(`EHLO ${host}`), true);
    assert.match(result.providerMessageId, new RegExp(`^<.+@${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>$`));
  });
}

async function verifySmtpTransportEncodesNonAsciiHeaders() {
  await withFakeSmtpServer(null, async ({ host, port, sessions }) => {
    const adapter = createMailProviderAdapter({
      env: {
        MAIL_PROVIDER: 'stalwart',
        MAIL_WORKER_DRY_RUN: 'false',
        MAIL_FROM_ADDRESS: 'no-reply@leevident.com',
        MAIL_FROM_NAME: '终末地抽卡分析器',
        STALWART_SMTP_HOST: host,
        STALWART_SMTP_PORT: String(port),
        STALWART_SMTP_USERNAME: 'no-reply@leevident.com',
        STALWART_SMTP_PASSWORD: 'smtp-secret',
        STALWART_SMTP_STARTTLS: 'false',
        STALWART_SMTP_ALLOW_INSECURE: 'true',
      },
    });

    const result = await adapter.send({
      from: { address: 'no-reply@leevident.com', name: '终末地抽卡分析器' },
      to: NORMALIZED_EMAIL,
      subject: '终末地抽卡分析器账号安全通知测试',
      text: 'hello',
      templateKey: 'auth.password-reset',
      relatedEntityType: 'account_recovery',
      relatedEntityId: 'recovery-1',
    });

    assert.equal(result.ok, true);
    assert.match(sessions[0].data, /^From: =\?UTF-8\?B\?.+\?= <no-reply@leevident\.com>$/m);
    assert.match(sessions[0].data, /^Subject: =\?UTF-8\?B\?.+\?=$/m);
    assert.equal(sessions[0].data.includes('Subject: 终末地'), false);
  });
}

async function verifySmtpTransportEncodesNonAsciiBody() {
  await withFakeSmtpServer(null, async ({ host, port, sessions }) => {
    const adapter = createMailProviderAdapter({
      env: {
        MAIL_PROVIDER: 'stalwart',
        MAIL_WORKER_DRY_RUN: 'false',
        MAIL_FROM_ADDRESS: 'no-reply@leevident.com',
        MAIL_FROM_NAME: '终末地抽卡分析器',
        STALWART_SMTP_HOST: host,
        STALWART_SMTP_PORT: String(port),
        STALWART_SMTP_USERNAME: 'no-reply@leevident.com',
        STALWART_SMTP_PASSWORD: 'smtp-secret',
        STALWART_SMTP_STARTTLS: 'false',
        STALWART_SMTP_ALLOW_INSECURE: 'true',
      },
    });

    const result = await adapter.send({
      from: { address: 'no-reply@leevident.com', name: '终末地抽卡分析器' },
      to: NORMALIZED_EMAIL,
      subject: '终末地抽卡分析器账号安全通知测试',
      text: '这是一封账号安全通知测试邮件。\n如果不是你本人操作，可以忽略这封邮件。',
      templateKey: 'auth.password-reset',
      relatedEntityType: 'account_recovery',
      relatedEntityId: 'recovery-1',
    });

    assert.equal(result.ok, true);
    assert.match(sessions[0].data, /^Content-Transfer-Encoding: quoted-printable$/m);
    assert.match(sessions[0].data, /=E8=BF=99=E6=98=AF=E4=B8=80=E5=B0=81/);
    assert.equal(sessions[0].data.includes('这是一封'), false);
    assert.equal(sessions[0].data.includes('è¿™'), false);
  });
}

async function verifyUnsupportedTemplateFailure() {
  const client = createFakeAdminClient({
    outboxRows: [
      createOutboxRow({
        template_key: 'unknown.template',
      }),
    ],
  });
  const result = await runMailOutboxWorker({
    adminClient: client,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_WORKER_DRY_RUN: 'true',
      MAIL_WORKER_MAX_ATTEMPTS: '1',
    },
    now: NOW,
    logger: null,
  });

  assert.equal(result.ok, false);
  assert.equal(result.stats.failed, 1);
  assert.equal(result.results[0].code, 'mail_worker_template_unsupported');
  assert.equal(client.state.outboxRows[0].status, 'failed');
  assert.equal(client.state.deliveryEvents[0].event_type, 'failed');
  assertNoSensitiveValue(result, 'unsupported template result');
  assertNoSensitiveValue(client.state.outboxRows, 'unsupported template outbox rows');
  assertNoSensitiveValue(client.state.deliveryEvents, 'unsupported template delivery events');
}

await verifyDisabledWorker();
await verifyWorkerKillSwitch();
await verifyRuntimeKillSwitch();
await verifyDryRunWorker();
await verifyLiveTransportSuccess();
await verifyMalformedAuthResetLinkRewrite();
await verifyDeveloperApiReviewNotificationSuccess();
await verifyTicketReplyNotificationSuccess();
await verifyAdminAlertNotificationSuccess();
await verifyLiveTransportMissingConfigFailure();
await verifyBuiltInStalwartSmtpTransportSuccess();
await verifyBuiltInSmtpTransportSendsMultipartHtml();
await verifySmtpTransportUsesHostDomainFallback();
await verifySmtpTransportEncodesNonAsciiHeaders();
await verifySmtpTransportEncodesNonAsciiBody();
await verifyUnsupportedTemplateFailure();

console.log('MAIL-SELFHOST-001 mail outbox worker verification passed');
