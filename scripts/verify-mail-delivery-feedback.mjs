import assert from 'node:assert/strict';

import {
  recordMailDeliveryFeedback,
  recordMailDeliveryFeedbackBatch,
  verifyMailDeliveryFeedbackSecret,
} from '../api/_lib/mailDeliveryFeedback.js';
import { buildRecipientFingerprint } from '../api/_lib/mailAbuseGuards.js';

const HASH_SALT = 'verify-mail-delivery-feedback';
const NOW = new Date('2026-06-07T08:09:10.000Z');
const RAW_EMAIL = 'Bounce.User+Mail@Example.COM';
const NORMALIZED_EMAIL = 'bounce.user+mail@example.com';
const RECIPIENT = buildRecipientFingerprint(RAW_EMAIL, { salt: HASH_SALT });
const OUTBOX_ID = '11111111-1111-4111-8111-111111111111';

function assertNoSensitiveValue(value, label = 'serialized output') {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('Bounce.User'), false, `${label} must not include raw local part`);
  assert.equal(serialized.includes('bounce.user'), false, `${label} must not include normalized local part`);
  assert.equal(serialized.includes(RAW_EMAIL), false, `${label} must not include raw recipient email`);
  assert.equal(serialized.includes(NORMALIZED_EMAIL), false, `${label} must not include normalized recipient email`);
  assert.equal(serialized.includes('provider-message-raw-id'), false, `${label} must not include raw provider message id`);
  assert.equal(serialized.includes('stalwart-delivered-raw-id'), false, `${label} must not include raw Stalwart event id`);
  assert.equal(serialized.includes('stalwart-temp-fail-raw-id'), false, `${label} must not include raw Stalwart event id`);
  assert.equal(serialized.includes('stalwart-perm-fail-raw-id'), false, `${label} must not include raw Stalwart event id`);
  assert.equal(serialized.includes('stalwart-ok-raw-id'), false, `${label} must not include raw Stalwart event id`);
  assert.equal(serialized.includes('stalwart-missing-recipient-raw-id'), false, `${label} must not include raw Stalwart event id`);
  assert.equal(serialized.includes('queue-delivered-raw-id'), false, `${label} must not include raw Stalwart queue id`);
  assert.equal(serialized.includes('queue-temp-raw-id'), false, `${label} must not include raw Stalwart queue id`);
  assert.equal(serialized.includes('reset-token-secret'), false, `${label} must not include reset token`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = 'select';
    this.patch = null;
    this.insertPayload = null;
    this.filters = [];
    this.limitValue = null;
  }

  select() {
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.insertPayload = payload;
    return this;
  }

  update(patch) {
    this.operation = 'update';
    this.patch = patch;
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
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

function rowMatches(query, row) {
  return query.filters.every((filter) => row?.[filter.field] === filter.value);
}

function createFakeAdminClient({
  suppressionRows = [],
  outboxRows = [],
} = {}) {
  const state = {
    suppressionRows: suppressionRows.map(clone),
    outboxRows: outboxRows.map(clone),
    deliveryEvents: [],
    calls: [],
  };

  const client = {
    state,
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

      if (query.table === 'mail_delivery_events') {
        if (query.operation !== 'insert') {
          throw new Error(`Unexpected mail_delivery_events operation: ${query.operation}`);
        }
        state.deliveryEvents.push(clone(query.insertPayload));
        return { data: query.insertPayload, error: null };
      }

      if (query.table === 'mail_suppression') {
        if (query.operation === 'insert') {
          const row = {
            id: `suppression-${state.suppressionRows.length + 1}`,
            ...query.insertPayload,
          };
          state.suppressionRows.push(row);
          return { data: maybeSingle ? row : [row], error: null };
        }

        if (query.operation === 'update') {
          const updatedRows = [];
          state.suppressionRows = state.suppressionRows.map((row) => {
            if (!rowMatches(query, row)) {
              return row;
            }

            const updated = { ...row, ...query.patch };
            updatedRows.push(updated);
            return updated;
          });
          return { data: maybeSingle ? updatedRows[0] || null : updatedRows, error: null };
        }

        const rows = state.suppressionRows
          .filter((row) => rowMatches(query, row))
          .slice(0, query.limitValue || state.suppressionRows.length);
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'mail_outbox') {
        if (query.operation !== 'update') {
          throw new Error(`Unexpected mail_outbox operation: ${query.operation}`);
        }

        const updatedRows = [];
        state.outboxRows = state.outboxRows.map((row) => {
          if (!rowMatches(query, row)) {
            return row;
          }

          const updated = { ...row, ...query.patch };
          updatedRows.push(updated);
          return updated;
        });
        return { data: updatedRows, error: null };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
  };

  return client;
}

function createBaseInput(overrides = {}) {
  return {
    eventType: 'hard_bounce',
    providerKey: 'stalwart',
    providerMessageId: 'provider-message-raw-id',
    recipientEmail: RAW_EMAIL,
    outboxId: OUTBOX_ID,
    diagnostics: {
      smtpStatus: '550 5.1.1 user unknown',
      originalEmail: RAW_EMAIL,
      token: 'reset-token-secret',
    },
    ...overrides,
  };
}

async function verifyHardBounceCreatesSuppression() {
  const adminClient = createFakeAdminClient({
    outboxRows: [
      {
        id: OUTBOX_ID,
        status: 'sent',
      },
    ],
  });
  const result = await recordMailDeliveryFeedback({
    adminClient,
    input: createBaseInput(),
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'mail_feedback_suppression_recorded');
  assert.equal(result.suppression.action, 'inserted');
  assert.equal(adminClient.state.suppressionRows.length, 1);
  assert.equal(adminClient.state.suppressionRows[0].recipient_email_hash, RECIPIENT.emailHash);
  assert.equal(adminClient.state.suppressionRows[0].recipient_domain, null);
  assert.equal(adminClient.state.suppressionRows[0].reason, 'hard_bounce');
  assert.equal(adminClient.state.deliveryEvents.length, 1);
  assert.equal(adminClient.state.deliveryEvents[0].provider_message_id_hash.length, 64);
  assert.equal(adminClient.state.outboxRows[0].status, 'suppressed');
  assert.equal(adminClient.state.outboxRows[0].last_error_code, 'hard_bounce');
  assertNoSensitiveValue(result, 'hard bounce result');
  assertNoSensitiveValue(adminClient.state, 'hard bounce state');
}

async function verifyComplaintUpdatesExistingSuppression() {
  const adminClient = createFakeAdminClient({
    suppressionRows: [
      {
        id: 'suppression-existing',
        recipient_email_hash: RECIPIENT.emailHash,
        recipient_domain: null,
        reason: 'hard_bounce',
        status: 'active',
        notes_redacted_json: {
          first: true,
        },
      },
    ],
  });
  const result = await recordMailDeliveryFeedback({
    adminClient,
    input: createBaseInput({
      eventType: 'complaint',
      outboxId: '',
    }),
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.suppression.action, 'updated');
  assert.equal(adminClient.state.suppressionRows.length, 1);
  assert.equal(adminClient.state.suppressionRows[0].reason, 'complaint');
  assert.equal(adminClient.state.suppressionRows[0].notes_redacted_json.first, true);
  assert.equal(adminClient.state.suppressionRows[0].notes_redacted_json.latest.reason, 'complaint');
  assertNoSensitiveValue(result, 'complaint result');
  assertNoSensitiveValue(adminClient.state, 'complaint state');
}

async function verifyDomainPauseCreatesDomainSuppression() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailDeliveryFeedback({
    adminClient,
    input: createBaseInput({
      eventType: 'domain_pause',
      recipientEmail: '',
      recipientEmailHash: '',
      recipientDomain: 'Example.COM',
      suppressDomain: true,
      outboxId: '',
    }),
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.suppression.action, 'inserted');
  assert.equal(adminClient.state.suppressionRows[0].recipient_email_hash, null);
  assert.equal(adminClient.state.suppressionRows[0].recipient_domain, 'example.com');
  assert.equal(adminClient.state.suppressionRows[0].reason, 'domain_pause');
  assertNoSensitiveValue(result, 'domain pause result');
}

async function verifySoftEventOnlyRecordsDeliveryEvent() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailDeliveryFeedback({
    adminClient,
    input: createBaseInput({
      eventType: 'delivered',
      reason: '',
    }),
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'mail_feedback_recorded');
  assert.equal(result.suppression.action, 'none');
  assert.equal(adminClient.state.deliveryEvents.length, 1);
  assert.equal(adminClient.state.suppressionRows.length, 0);
  assertNoSensitiveValue(result, 'soft event result');
  assertNoSensitiveValue(adminClient.state, 'soft event state');
}

async function verifyMissingSuppressionTargetIsRejected() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailDeliveryFeedback({
    adminClient,
    input: createBaseInput({
      recipientEmail: '',
      recipientEmailHash: '',
      recipientDomain: '',
      outboxId: '',
    }),
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'mail_feedback_suppression_target_missing');
  assert.equal(adminClient.state.deliveryEvents.length, 0);
  assert.equal(adminClient.state.suppressionRows.length, 0);
}

async function verifyStalwartWebhookBatchMapping() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailDeliveryFeedbackBatch({
    adminClient,
    input: {
      events: [
        {
          id: 'stalwart-delivered-raw-id',
          createdAt: '2026-06-07T08:00:00.000Z',
          type: 'delivery.delivered',
          data: {
            rcptTo: RAW_EMAIL,
            queueId: 'queue-delivered-raw-id',
            status: '250 2.0.0 ok',
            token: 'reset-token-secret',
          },
        },
        {
          id: 'stalwart-temp-fail-raw-id',
          createdAt: '2026-06-07T08:01:00.000Z',
          type: 'delivery.dsn-temp-fail',
          data: {
            recipient: RAW_EMAIL,
            queueId: 'queue-temp-raw-id',
            status: '451 4.7.1 try again later',
          },
        },
        {
          id: 'stalwart-perm-fail-raw-id',
          createdAt: '2026-06-07T08:02:00.000Z',
          type: 'delivery.dsn-perm-fail',
          data: {
            envelope: {
              rcptTo: RAW_EMAIL,
            },
            messageId: 'provider-message-raw-id',
            status: '550 5.1.1 user unknown',
            originalEmail: RAW_EMAIL,
          },
        },
      ],
    },
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'mail_feedback_batch_recorded');
  assert.equal(result.received, 3);
  assert.equal(result.recorded, 3);
  assert.equal(result.failed, 0);
  assert.equal(adminClient.state.deliveryEvents.length, 3);
  assert.equal(adminClient.state.deliveryEvents[0].event_type, 'delivered');
  assert.equal(adminClient.state.deliveryEvents[1].event_type, 'delivery_temp_fail');
  assert.equal(adminClient.state.deliveryEvents[2].event_type, 'hard_bounce');
  assert.equal(adminClient.state.deliveryEvents[0].event_payload_redacted_json.diagnostics.stalwartEventIdHash.length, 64);
  assert.equal(adminClient.state.deliveryEvents[0].event_payload_redacted_json.diagnostics.queueIdHash.length, 64);
  assert.equal(adminClient.state.deliveryEvents[1].event_payload_redacted_json.diagnostics.stalwartEventIdHash.length, 64);
  assert.equal(adminClient.state.deliveryEvents[1].event_payload_redacted_json.diagnostics.queueIdHash.length, 64);
  assert.equal(adminClient.state.deliveryEvents[2].event_payload_redacted_json.diagnostics.stalwartEventIdHash.length, 64);
  assert.equal(adminClient.state.suppressionRows.length, 1);
  assert.equal(adminClient.state.suppressionRows[0].reason, 'hard_bounce');
  assert.equal(adminClient.state.suppressionRows[0].recipient_email_hash, RECIPIENT.emailHash);
  assert.equal(result.results[2].suppressionAction, 'inserted');
  assertNoSensitiveValue(result, 'stalwart webhook result');
  assertNoSensitiveValue(adminClient.state, 'stalwart webhook state');
}

async function verifyStalwartWebhookBatchPartialFailure() {
  const adminClient = createFakeAdminClient();
  const result = await recordMailDeliveryFeedbackBatch({
    adminClient,
    input: {
      events: [
        {
          id: 'stalwart-ok-raw-id',
          createdAt: '2026-06-07T08:03:00.000Z',
          type: 'delivery.delivered',
          data: {
            rcptTo: RAW_EMAIL,
          },
        },
        {
          id: 'stalwart-missing-recipient-raw-id',
          createdAt: '2026-06-07T08:04:00.000Z',
          type: 'delivery.dsn-perm-fail',
          data: {
            status: '550 5.1.1 user unknown',
          },
        },
      ],
    },
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.partial, true);
  assert.equal(result.code, 'mail_feedback_batch_partial');
  assert.equal(result.received, 2);
  assert.equal(result.recorded, 1);
  assert.equal(result.failed, 1);
  assert.equal(adminClient.state.deliveryEvents.length, 1);
  assert.equal(adminClient.state.suppressionRows.length, 0);
  assertNoSensitiveValue(result, 'stalwart partial webhook result');
}

function verifySecretGuards() {
  const env = { MAIL_DELIVERY_WEBHOOK_SECRET: 'feedback-secret' };
  assert.deepEqual(
    verifyMailDeliveryFeedbackSecret({ headers: {} }, {}),
    { ok: false, status: 503, code: 'mail_feedback_secret_not_configured' }
  );
  assert.deepEqual(
    verifyMailDeliveryFeedbackSecret({ headers: { authorization: 'Bearer wrong' } }, env),
    { ok: false, status: 401, code: 'mail_feedback_unauthorized' }
  );
  assert.equal(
    verifyMailDeliveryFeedbackSecret({ headers: { authorization: 'Bearer feedback-secret' } }, env).ok,
    true
  );
  assert.equal(
    verifyMailDeliveryFeedbackSecret({ headers: { 'x-mail-webhook-secret': 'feedback-secret' } }, env).ok,
    true
  );
}

await verifyHardBounceCreatesSuppression();
await verifyComplaintUpdatesExistingSuppression();
await verifyDomainPauseCreatesDomainSuppression();
await verifySoftEventOnlyRecordsDeliveryEvent();
await verifyMissingSuppressionTargetIsRejected();
await verifyStalwartWebhookBatchMapping();
await verifyStalwartWebhookBatchPartialFailure();
verifySecretGuards();

console.log('MAIL-DELIVERABILITY-001 mail delivery feedback verification passed');
