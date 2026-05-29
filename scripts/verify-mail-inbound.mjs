import assert from 'node:assert/strict';

import {
  recordMailInboundEvent,
  verifyMailInboundWebhookSecret,
} from '../api/_lib/mailInboundEvents.js';

const NOW = new Date('2026-06-09T01:02:03.000Z');

function assertNoSensitiveValue(value, label = 'serialized output') {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('sender.person'), false, `${label} must not include raw sender local part`);
  assert.equal(serialized.includes('support.user'), false, `${label} must not include raw recipient local part`);
  assert.equal(serialized.includes('sender.person@example.com'), false, `${label} must not include raw sender email`);
  assert.equal(serialized.includes('support.user@leevident.com'), false, `${label} must not include raw recipient email`);
  assert.equal(serialized.includes('reset-token-secret'), false, `${label} must not include token-like values`);
  assert.equal(serialized.includes('Raw subject with email'), false, `${label} must not include raw subject`);
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

async function verifyInboundEventRecordsRedactedPayload() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailInboundEvent({
    adminClient,
    now: NOW,
    hashSalt: 'verify-mail-inbound',
    input: {
      eventType: 'inbound_received',
      providerKey: 'stalwart',
      messageId: '<raw-provider-message-id@example.com>',
      from: 'Sender Person <sender.person@example.com>',
      to: ['Support User <support.user@leevident.com>'],
      subject: 'Raw subject with email sender.person@example.com',
      sizeBytes: 4096,
      attachments: [{ name: 'debug.txt' }],
      diagnostics: {
        rawRecipient: 'support.user@leevident.com',
        token: 'reset-token-secret',
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'mail_inbound_recorded');
  assert.equal(adminClient.state.deliveryEvents.length, 1);
  assert.equal(adminClient.state.deliveryEvents[0].event_type, 'inbound_received');
  assert.equal(adminClient.state.deliveryEvents[0].provider_key, 'stalwart');
  assert.equal(adminClient.state.deliveryEvents[0].provider_message_id_hash.length, 64);
  assert.equal(adminClient.state.deliveryEvents[0].created_at, NOW.toISOString());
  assert.equal(adminClient.state.deliveryEvents[0].event_payload_redacted_json.sender.count, 1);
  assert.equal(adminClient.state.deliveryEvents[0].event_payload_redacted_json.recipients.count, 1);
  assert.equal(adminClient.state.deliveryEvents[0].event_payload_redacted_json.attachmentCount, 1);
  assertNoSensitiveValue(result, 'inbound result');
  assertNoSensitiveValue(adminClient.state, 'inbound state');
}

async function verifyMissingEnvelopeRejected() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailInboundEvent({
    adminClient,
    now: NOW,
    input: {
      eventType: 'inbound_received',
      subject: 'No envelope only',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'mail_inbound_envelope_missing');
  assert.equal(adminClient.state.deliveryEvents.length, 0);
}

function verifySecretGuards() {
  const env = { MAIL_INBOUND_WEBHOOK_SECRET: 'inbound-secret' };
  assert.deepEqual(
    verifyMailInboundWebhookSecret({ headers: {} }, {}),
    { ok: false, status: 503, code: 'mail_inbound_secret_not_configured' }
  );
  assert.deepEqual(
    verifyMailInboundWebhookSecret({ headers: { authorization: 'Bearer wrong' } }, env),
    { ok: false, status: 401, code: 'mail_inbound_unauthorized' }
  );
  assert.equal(
    verifyMailInboundWebhookSecret({ headers: { authorization: 'Bearer inbound-secret' } }, env).ok,
    true
  );
  assert.equal(
    verifyMailInboundWebhookSecret({ headers: { 'x-mail-inbound-secret': 'inbound-secret' } }, env).ok,
    true
  );
}

await verifyInboundEventRecordsRedactedPayload();
await verifyMissingEnvelopeRejected();
verifySecretGuards();

console.log('MAIL-SELFHOST-001 mail inbound verification passed');
