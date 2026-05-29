import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enqueueMailOutboxEvent,
  getMailOutboxControlsFromEnv,
} from '../api/_lib/mailOutbox.js';
import { MAIL_EVENT_TYPES } from '../api/_lib/mailAbuseGuards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const HASH_SALT = 'verify-mail-outbox-enqueue';
const NOW = new Date('2026-06-02T03:04:05.000Z');
const RECIPIENT = 'Recover.User+mail@Example.COM';

function assertNoSensitiveValue(value) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('Recover.User'), false, 'raw recipient local part must not be serialized');
  assert.equal(serialized.includes('recover.user'), false, 'normalized recipient local part must not be serialized');
  assert.equal(serialized.includes('Recover.User+mail@Example.COM'), false, 'raw recipient email must not be serialized');
  assert.equal(serialized.includes('recover.user+mail@example.com'), false, 'normalized recipient email must not be serialized');
  assert.equal(serialized.includes('reset-token-secret'), false, 'raw token must not be serialized');
  assert.equal(serialized.includes('game-uid-123'), false, 'raw game uid must not be serialized');
  assert.equal(serialized.includes('user-uuid-secret'), false, 'raw user id payload must not be serialized');
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.inFilter = null;
    this.limitValue = null;
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  in(field, values) {
    this.inFilter = { field, values };
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.client.executeQuery(this, { maybeSingle: true }));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.executeQuery(this)).then(resolve, reject);
  }
}

function createFakeAdminClient({
  existingOutbox = null,
  suppressionRows = [],
  counterRows = [],
  rpcResult = null,
  rpcError = null,
} = {}) {
  const calls = {
    from: [],
    rpc: [],
  };

  const client = {
    calls,
    from(table) {
      calls.from.push(table);
      return new QueryBuilder(client, table);
    },
    async rpc(name, params) {
      calls.rpc.push({ name, params });
      if (rpcError) {
        return { data: null, error: rpcError };
      }

      return {
        data: rpcResult || {
          action: 'queue',
          code: 'mail_outbox_queued',
          outbox_id: 'outbox-queued',
          idempotency_key: params.p_idempotency_key,
        },
        error: null,
      };
    },
    executeQuery(query, { maybeSingle = false } = {}) {
      if (query.table === 'mail_outbox') {
        return {
          data: maybeSingle ? existingOutbox : (existingOutbox ? [existingOutbox] : []),
          error: null,
        };
      }

      if (query.table === 'mail_suppression') {
        return {
          data: suppressionRows.slice(0, query.limitValue || suppressionRows.length),
          error: null,
        };
      }

      if (query.table === 'mail_abuse_budget_counters') {
        const selectedKeys = new Set(query.inFilter?.values || []);
        return {
          data: counterRows.filter((row) => selectedKeys.has(row.bucket_key_hash)),
          error: null,
        };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
  };

  return client;
}

function createMailEvent(overrides = {}) {
  return {
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmail: RECIPIENT,
    requesterIp: '203.0.113.9',
    userId: '11111111-1111-4111-8111-111111111111',
    templateKey: 'auth.password-reset',
    locale: 'zh-CN',
    relatedEntityType: 'account_recovery',
    relatedEntityId: 'recovery-123',
    purposeKey: 'request-123',
    payload: {
      subject: 'Reset for Recover.User+mail@Example.COM',
      token: 'reset-token-secret',
      game_uid: 'game-uid-123',
      user_id: 'user-uuid-secret',
      safe: {
        requestType: 'password_reset',
      },
    },
    priority: 2,
    now: NOW,
    hashSalt: HASH_SALT,
    ...overrides,
  };
}

async function verifyQueuePath() {
  const adminClient = createFakeAdminClient();
  const result = await enqueueMailOutboxEvent({
    adminClient,
    ...createMailEvent(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.queued, true);
  assert.equal(result.action, 'queue');
  assert.equal(result.outboxId, 'outbox-queued');
  assert.match(result.idempotencyKey, /^[a-f0-9]{64}$/);
  assert.equal(adminClient.calls.rpc.length, 1);
  assert.equal(adminClient.calls.rpc[0].name, 'enqueue_mail_outbox_event');

  const rpcParams = adminClient.calls.rpc[0].params;
  assert.equal(rpcParams.p_event_type, MAIL_EVENT_TYPES.PASSWORD_RESET);
  assert.equal(rpcParams.p_recipient_domain, 'example.com');
  assert.match(rpcParams.p_recipient_email_hash, /^[a-f0-9]{64}$/);
  assert.equal(rpcParams.p_template_key, 'auth.password-reset');
  assert.equal(rpcParams.p_locale, 'zh-CN');
  assert.equal(rpcParams.p_priority, 2);
  assert.equal(rpcParams.p_created_by_user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(Array.isArray(rpcParams.p_budget_buckets), true);
  assert.equal(rpcParams.p_budget_buckets.length > 0, true);
  assert.equal(rpcParams.p_payload_redacted_json.safe.requestType, 'password_reset');
  assert.equal(rpcParams.p_payload_redacted_json.token, '[redacted]');
  assert.equal(rpcParams.p_payload_redacted_json.game_uid, '[redacted]');
  assert.equal(rpcParams.p_payload_redacted_json.user_id, '[redacted]');
  assertNoSensitiveValue(result);
  assertNoSensitiveValue(rpcParams);
}

async function verifyDedupePath() {
  const adminClient = createFakeAdminClient({
    existingOutbox: {
      id: 'outbox-existing',
      status: 'queued',
      idempotency_key: 'existing-key',
      created_at: NOW.toISOString(),
    },
  });
  const result = await enqueueMailOutboxEvent({
    adminClient,
    ...createMailEvent(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.queued, false);
  assert.equal(result.deduped, true);
  assert.equal(result.action, 'dedupe');
  assert.equal(result.outboxId, 'outbox-existing');
  assert.equal(adminClient.calls.rpc.length, 0);
  assertNoSensitiveValue(result);
}

async function verifySuppressionPath() {
  const adminClient = createFakeAdminClient({
    suppressionRows: [
      {
        recipient_email_hash: null,
        recipient_domain: 'example.com',
        reason: 'manual',
        status: 'active',
        expires_at: null,
      },
    ],
  });
  const result = await enqueueMailOutboxEvent({
    adminClient,
    ...createMailEvent(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.queued, false);
  assert.equal(result.action, 'block');
  assert.equal(result.code, 'mail_recipient_suppressed');
  assert.equal(adminClient.calls.rpc.length, 0);
  assertNoSensitiveValue(result);
}

async function verifyEnvironmentControls() {
  const controls = getMailOutboxControlsFromEnv({
    MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'true',
    MAIL_OUTBOX_DISABLED_EVENTS: 'password_reset, ticket_reply',
    MAIL_OUTBOX_PAUSED_DOMAINS: 'Example.COM, blocked.example',
  });

  assert.equal(controls.killSwitch, true);
  assert.deepEqual(controls.disabledEvents, ['password_reset', 'ticket_reply']);
  assert.deepEqual(controls.pausedDomains, ['example.com', 'blocked.example']);

  const adminClient = createFakeAdminClient();
  const previousKillSwitch = process.env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH;
  process.env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH = 'true';

  try {
    const result = await enqueueMailOutboxEvent({
      adminClient,
      ...createMailEvent(),
    });

    assert.equal(result.ok, false);
    assert.equal(result.queued, false);
    assert.equal(result.code, 'mail_kill_switch_enabled');
    assert.equal(adminClient.calls.rpc.length, 0);
    assertNoSensitiveValue(result);
  } finally {
    if (previousKillSwitch === undefined) {
      delete process.env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH;
    } else {
      process.env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH = previousKillSwitch;
    }
  }
}

async function verifyNonUuidUserIdIsNotPersisted() {
  const adminClient = createFakeAdminClient();
  const result = await enqueueMailOutboxEvent({
    adminClient,
    ...createMailEvent({
      userId: 'external-user-id',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.queued, true);
  assert.equal(adminClient.calls.rpc.length, 1);
  assert.equal(adminClient.calls.rpc[0].params.p_created_by_user_id, null);
  assertNoSensitiveValue(result);
  assertNoSensitiveValue(adminClient.calls.rpc[0].params);
}

async function verifyBudgetExceededPath() {
  const probeClient = createFakeAdminClient();
  const probe = await enqueueMailOutboxEvent({
    adminClient: probeClient,
    ...createMailEvent(),
  });
  const firstBucket = probe.decision.buckets[0];
  const adminClient = createFakeAdminClient({
    counterRows: [
      {
        bucket_key_hash: firstBucket.bucketKeyHash,
        used_count: firstBucket.max,
      },
    ],
  });
  const result = await enqueueMailOutboxEvent({
    adminClient,
    ...createMailEvent(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.queued, false);
  assert.equal(result.action, 'block');
  assert.equal(result.code, `mail_budget_exceeded:${firstBucket.scope}`);
  assert.equal(adminClient.calls.rpc.length, 0);
  assertNoSensitiveValue(result);
}

async function verifyInputGuards() {
  const noClient = await enqueueMailOutboxEvent(createMailEvent({ adminClient: null }));
  assert.equal(noClient.code, 'admin_client_unavailable');

  const missingTemplate = await enqueueMailOutboxEvent({
    adminClient: createFakeAdminClient(),
    ...createMailEvent({ templateKey: '' }),
  });
  assert.equal(missingTemplate.code, 'missing_template_key');
}

async function verifyMigrationContract() {
  const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '120_add_mail_outbox_enqueue_rpc.sql');
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enqueue_mail_outbox_event/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /mail_missing_budget_buckets/);
  assert.match(migration, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.enqueue_mail_outbox_event[\s\S]+TO service_role/);
  assert.match(migration, /Does not send mail/);
  assert.equal(/GRANT EXECUTE[\s\S]+TO anon/.test(migration), false);
  assert.equal(/GRANT EXECUTE[\s\S]+TO authenticated/.test(migration), false);
}

await verifyQueuePath();
await verifyDedupePath();
await verifySuppressionPath();
await verifyEnvironmentControls();
await verifyNonUuidUserIdIsNotPersisted();
await verifyBudgetExceededPath();
await verifyInputGuards();
await verifyMigrationContract();

console.log('MAIL-ABUSE-001 mail outbox enqueue verification passed');
