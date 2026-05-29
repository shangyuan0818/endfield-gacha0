import assert from 'node:assert/strict';

import { sendMailSmokeTest } from '../api/_lib/mailSmokeTest.js';
import { __internal as mailOutboxWorkerRoute } from '../api/_routes/root/mail-outbox-worker.js';

const NOW = new Date('2026-06-10T02:03:04.000Z');
const RAW_EMAIL = 'Smoke.User+Mail@Example.COM';
const NORMALIZED_EMAIL = 'smoke.user+mail@example.com';

function assertNoSensitiveValue(value, label = 'serialized output') {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('Smoke.User'), false, `${label} must not include raw local part`);
  assert.equal(serialized.includes('smoke.user'), false, `${label} must not include normalized local part`);
  assert.equal(serialized.includes(RAW_EMAIL), false, `${label} must not include raw recipient email`);
  assert.equal(serialized.includes(NORMALIZED_EMAIL), false, `${label} must not include normalized recipient email`);
  assert.equal(serialized.includes('provider-message-raw-id'), false, `${label} must not include raw provider message id`);
  assert.equal(serialized.includes('smtp-password'), false, `${label} must not include SMTP password`);
  assert.equal(serialized.includes('reset-token-secret'), false, `${label} must not include token-like values`);
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.insertPayload = null;
  }

  insert(payload) {
    this.insertPayload = payload;
    return Promise.resolve(this.client.executeQuery(this));
  }
}

function createFakeAdminClient() {
  const state = {
    deliveryEvents: [],
  };

  const client = {
    state,
    from(table) {
      return new QueryBuilder(client, table);
    },
    executeQuery(query) {
      if (query.table !== 'mail_delivery_events') {
        throw new Error(`Unexpected table: ${query.table}`);
      }

      state.deliveryEvents.push(query.insertPayload);
      return { data: query.insertPayload, error: null };
    },
  };

  return client;
}

function createAdapter({
  dryRun = false,
  ok = true,
} = {}) {
  const sentMessages = [];
  return {
    sentMessages,
    config: {
      dryRun,
      provider: 'stalwart',
      providerKey: dryRun ? 'stalwart:dry-run' : 'stalwart',
      fromAddress: 'no-reply@leevident.com',
      fromName: '终末地抽卡分析器',
      sendingDomain: 'mail.leevident.com',
    },
    async send(message) {
      sentMessages.push(message);
      return {
        ok,
        accepted: ok,
        dryRun,
        retryable: !ok,
        providerKey: dryRun ? 'stalwart:dry-run' : 'stalwart',
        providerMessageId: ok ? 'provider-message-raw-id' : '',
        code: ok ? (dryRun ? 'mail_provider_dry_run' : 'stalwart_smtp_accepted') : 'stalwart_smtp_failed',
        reason: ok ? 'accepted' : 'failed',
        diagnostics: {
          rawRecipient: NORMALIZED_EMAIL,
          token: 'reset-token-secret',
          password: 'smtp-password',
        },
      };
    },
  };
}

async function verifySmokeTestSendsRedactedEvent() {
  const adminClient = createFakeAdminClient();
  const adapter = createAdapter();
  const result = await sendMailSmokeTest({
    adminClient,
    adapter,
    recipientEmail: RAW_EMAIL,
    locale: 'zh-CN',
    actorUserId: '11111111-1111-4111-8111-111111111111',
    now: NOW,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'false',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'stalwart_smtp_accepted');
  assert.equal(result.recipient.domain, 'example.com');
  assert.equal(result.recipient.redacted.includes('@'), true);
  assert.equal(adapter.sentMessages.length, 1);
  assert.equal(adapter.sentMessages[0].to, RAW_EMAIL);
  assert.equal(adapter.sentMessages[0].templateKey, 'admin.mail-smoke-test');
  assert.equal(typeof adapter.sentMessages[0].html, 'string');
  assert.match(adapter.sentMessages[0].html, /<!doctype html>/i);
  assert.match(adapter.sentMessages[0].html, /Endfield Gacha/);
  assert.equal(adminClient.state.deliveryEvents.length, 1);
  assert.equal(adminClient.state.deliveryEvents[0].event_type, 'smoke_test_accepted');
  assert.equal(adminClient.state.deliveryEvents[0].provider_message_id_hash.length, 64);
  assertNoSensitiveValue(result, 'smoke test result');
  assertNoSensitiveValue(adminClient.state.deliveryEvents, 'smoke test delivery events');
}

async function verifyDryRunSmokeTestIgnoresKillSwitch() {
  const adminClient = createFakeAdminClient();
  const adapter = createAdapter({ dryRun: true });
  const result = await sendMailSmokeTest({
    adminClient,
    adapter,
    recipientEmail: RAW_EMAIL,
    now: NOW,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'true',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.code, 'mail_provider_dry_run');
  assert.equal(adminClient.state.deliveryEvents[0].event_type, 'smoke_test_dry_run');
  assertNoSensitiveValue(result, 'dry-run smoke result');
}

async function verifyLiveSmokeTestRespectsKillSwitch() {
  const adminClient = createFakeAdminClient();
  const adapter = createAdapter();
  const result = await sendMailSmokeTest({
    adminClient,
    adapter,
    recipientEmail: RAW_EMAIL,
    now: NOW,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
      MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'true',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.code, 'mail_worker_kill_switch_enabled');
  assert.equal(adapter.sentMessages.length, 0);
  assert.equal(adminClient.state.deliveryEvents.length, 0);
  assertNoSensitiveValue(result, 'kill switch smoke result');
}

async function verifyDisabledWorkerSkipsSmokeTest() {
  const adminClient = createFakeAdminClient();
  const adapter = createAdapter({ dryRun: true });
  const result = await sendMailSmokeTest({
    adminClient,
    adapter,
    recipientEmail: RAW_EMAIL,
    now: NOW,
    env: {
      MAIL_OUTBOX_WORKER_ENABLED: 'false',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.code, 'mail_worker_disabled');
  assert.deepEqual(result.requiredEnv, [
    {
      name: 'MAIL_OUTBOX_WORKER_ENABLED',
      expected: 'true',
    },
  ]);
  assert.equal(result.diagnostics?.workerEnabled, false);
  assert.equal(adapter.sentMessages.length, 0);
  assert.equal(adminClient.state.deliveryEvents.length, 0);
  assertNoSensitiveValue(result, 'disabled smoke result');
}

function verifyWorkerEndpointSecretGuards() {
  assert.equal(
    mailOutboxWorkerRoute.getMailWorkerSecret({
      MAIL_OUTBOX_WORKER_SECRET: 'worker-secret',
      CRON_SECRET: 'cron-secret',
    }),
    'worker-secret'
  );
  assert.equal(
    mailOutboxWorkerRoute.getMailWorkerSecret({
      CRON_SECRET: 'cron-secret',
    }),
    'cron-secret'
  );
  assert.deepEqual(
    mailOutboxWorkerRoute.getMailWorkerAcceptedSecrets({
      MAIL_OUTBOX_WORKER_SECRET: 'worker-secret',
      CRON_SECRET: 'cron-secret',
    }),
    ['worker-secret', 'cron-secret']
  );
  assert.deepEqual(
    mailOutboxWorkerRoute.authorizeMailOutboxWorkerRequest({ headers: {} }, {}),
    { ok: false, status: 503, error: 'Mail outbox worker secret is not configured' }
  );
  assert.deepEqual(
    mailOutboxWorkerRoute.authorizeMailOutboxWorkerRequest(
      { headers: { authorization: 'Bearer wrong' } },
      { MAIL_OUTBOX_WORKER_SECRET: 'worker-secret' }
    ),
    { ok: false, status: 401, error: 'Unauthorized' }
  );
  assert.equal(
    mailOutboxWorkerRoute.authorizeMailOutboxWorkerRequest(
      { headers: { authorization: 'Bearer worker-secret' } },
      { MAIL_OUTBOX_WORKER_SECRET: 'worker-secret' }
    ).ok,
    true
  );
  assert.equal(
    mailOutboxWorkerRoute.authorizeMailOutboxWorkerRequest(
      { headers: { authorization: 'Bearer cron-secret' } },
      {
        MAIL_OUTBOX_WORKER_SECRET: 'worker-secret',
        CRON_SECRET: 'cron-secret',
      }
    ).ok,
    true
  );
  assert.equal(
    mailOutboxWorkerRoute.authorizeMailOutboxWorkerRequest(
      { headers: { 'x-mail-outbox-worker-secret': 'worker-secret' } },
      { MAIL_OUTBOX_WORKER_SECRET: 'worker-secret' }
    ).ok,
    true
  );
}

await verifySmokeTestSendsRedactedEvent();
await verifyDryRunSmokeTestIgnoresKillSwitch();
await verifyLiveSmokeTestRespectsKillSwitch();
await verifyDisabledWorkerSkipsSmokeTest();
verifyWorkerEndpointSecretGuards();

console.log('MAIL-SELFHOST-001 mail service entrypoints verification passed');
