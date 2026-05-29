import assert from 'node:assert/strict';
import {
  DEFAULT_MAIL_BUDGETS,
  MAIL_EVENT_TYPES,
  buildMailBudgetBuckets,
  buildMailIdempotencyKey,
  buildRecipientFingerprint,
  evaluateMailAbuseGuards,
  redactMailAddress,
  sanitizeMailPayload,
  serializeMailDecisionForStorage,
} from '../api/_lib/mailAbuseGuards.js';

const HASH_SALT = 'verify-mail-abuse-guards';
const NOW = new Date('2026-06-01T12:34:56.000Z');
const EMAIL = 'Test.User+reset@Example.COM';

function assertNoRawRecipient(value) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('Test.User'), false, 'serialized output must not include raw local part');
  assert.equal(serialized.includes('test.user'), false, 'serialized output must not include normalized local part');
  assert.equal(serialized.includes('Test.User+reset@Example.COM'), false, 'serialized output must not include raw email');
  assert.equal(serialized.includes('test.user+reset@example.com'), false, 'serialized output must not include normalized email');
}

function verifyRecipientFingerprint() {
  const fingerprint = buildRecipientFingerprint(EMAIL, { salt: HASH_SALT });

  assert.equal(fingerprint.ok, true);
  assert.equal(fingerprint.domain, 'example.com');
  assert.match(fingerprint.emailHash, /^[a-f0-9]{64}$/);
  assert.match(fingerprint.domainHash, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint.redacted, 't***t@e***e.com');
  assert.equal(redactMailAddress('bad-address'), 'invalid-recipient');
  assertNoRawRecipient(fingerprint);
}

function verifyAllowedDecision() {
  const decision = evaluateMailAbuseGuards({
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmail: EMAIL,
    requesterIp: '203.0.113.10',
    userId: 'user-123',
    templateKey: 'auth.password-reset',
    locale: 'zh-CN',
    relatedEntityType: 'account_recovery',
    relatedEntityId: 'recovery-123',
    purposeKey: 'request-123',
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.shouldEnqueue, true);
  assert.equal(decision.action, 'queue');
  assert.equal(decision.code, 'mail_queue_allowed');
  assert.match(decision.idempotencyKey, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    decision.buckets.map((bucket) => bucket.scope),
    ['global', 'event', 'recipient', 'domain', 'ip', 'user']
  );
  assert.equal(decision.buckets.every((bucket) => bucket.remaining > 0), true);
  assertNoRawRecipient(decision);
}

function verifyBlockers() {
  const base = {
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmail: EMAIL,
    now: NOW,
    hashSalt: HASH_SALT,
  };

  assert.equal(evaluateMailAbuseGuards({ ...base, killSwitch: true }).code, 'mail_kill_switch_enabled');
  assert.equal(
    evaluateMailAbuseGuards({
      ...base,
      disabledEvents: [MAIL_EVENT_TYPES.PASSWORD_RESET],
    }).code,
    'mail_event_disabled'
  );
  assert.equal(
    evaluateMailAbuseGuards({
      ...base,
      pausedDomains: ['example.com'],
    }).code,
    'mail_domain_paused'
  );

  const fingerprint = buildRecipientFingerprint(EMAIL, { salt: HASH_SALT });
  assert.equal(
    evaluateMailAbuseGuards({
      ...base,
      suppressionList: [{ recipientEmailHash: fingerprint.emailHash, status: 'active' }],
    }).code,
    'mail_recipient_suppressed'
  );
  assert.equal(evaluateMailAbuseGuards({ ...base, recipientEmail: 'not-an-email' }).code, 'invalid_email');
  assert.equal(evaluateMailAbuseGuards({ ...base, eventType: 'marketing' }).code, 'invalid_event_type');
}

function verifyIdempotency() {
  const fingerprint = buildRecipientFingerprint(EMAIL, { salt: HASH_SALT });
  const keyA = buildMailIdempotencyKey({
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmailHash: fingerprint.emailHash,
    templateKey: 'auth.password-reset',
    locale: 'zh-CN',
    relatedEntityType: 'account_recovery',
    relatedEntityId: 'recovery-123',
    purposeKey: 'same-request',
  });
  const keyB = buildMailIdempotencyKey({
    purposeKey: 'same-request',
    relatedEntityId: 'recovery-123',
    relatedEntityType: 'account_recovery',
    locale: 'zh-CN',
    templateKey: 'auth.password-reset',
    recipientEmailHash: fingerprint.emailHash,
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
  });
  const keyC = buildMailIdempotencyKey({
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmailHash: fingerprint.emailHash,
    templateKey: 'auth.password-reset',
    locale: 'zh-CN',
    relatedEntityType: 'account_recovery',
    relatedEntityId: 'recovery-123',
    purposeKey: 'different-request',
  });

  assert.equal(keyA, keyB, 'idempotency key must be stable independent of object construction order');
  assert.notEqual(keyA, keyC, 'purpose key must separate genuinely different events');

  const decision = evaluateMailAbuseGuards({
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmail: EMAIL,
    existingIdempotency: true,
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.shouldEnqueue, false);
  assert.equal(decision.action, 'dedupe');
  assert.equal(decision.code, 'mail_idempotency_hit');
  assertNoRawRecipient(decision);
}

function verifyBudgetExceeded() {
  const fingerprint = buildRecipientFingerprint(EMAIL, { salt: HASH_SALT });
  const buckets = buildMailBudgetBuckets({
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmailHash: fingerprint.emailHash,
    recipientDomain: fingerprint.domain,
    requesterIp: '203.0.113.10',
    userId: 'user-123',
    now: NOW,
    hashSalt: HASH_SALT,
  });
  const recipientBucket = buckets.find((bucket) => bucket.scope === 'recipient');
  const counters = new Map([[recipientBucket.bucketKeyHash, recipientBucket.max]]);
  const decision = evaluateMailAbuseGuards({
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    recipientEmail: EMAIL,
    requesterIp: '203.0.113.10',
    userId: 'user-123',
    counters,
    now: NOW,
    hashSalt: HASH_SALT,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.shouldEnqueue, false);
  assert.equal(decision.action, 'block');
  assert.equal(decision.code, 'mail_budget_exceeded:recipient');
  assert.equal(decision.exceededBucket.scope, 'recipient');
  assertNoRawRecipient(serializeMailDecisionForStorage(decision));
}

function verifyPayloadSanitization() {
  const sanitized = sanitizeMailPayload({
    subject: 'Reset requested for Test.User+reset@Example.COM',
    email: EMAIL,
    nested: {
      token: 'reset-token',
      apiKey: 'ef_live_secret',
      user_id: 'user-123',
      safeCount: 3,
      message: '请查看 user@example.com 的工单',
    },
    list: [
      { platformId: 'telegram-123', note: 'visible' },
    ],
  });

  assert.equal(sanitized.subject, 'Reset requested for [redacted-email]');
  assert.equal(sanitized.email, '[redacted]');
  assert.equal(sanitized.nested.token, '[redacted]');
  assert.equal(sanitized.nested.apiKey, '[redacted]');
  assert.equal(sanitized.nested.user_id, '[redacted]');
  assert.equal(sanitized.nested.safeCount, 3);
  assert.equal(sanitized.nested.message, '请查看 [redacted-email] 的工单');
  assert.equal(sanitized.list[0].platformId, '[redacted]');
  assert.equal(sanitized.list[0].note, 'visible');
  assertNoRawRecipient(sanitized);
}

function verifyBudgetDefaults() {
  assert.equal(DEFAULT_MAIL_BUDGETS.global.max > 0, true);
  for (const eventType of Object.values(MAIL_EVENT_TYPES)) {
    assert.ok(DEFAULT_MAIL_BUDGETS.events[eventType], `${eventType} must have a default budget`);
  }
}

verifyRecipientFingerprint();
verifyAllowedDecision();
verifyBlockers();
verifyIdempotency();
verifyBudgetExceeded();
verifyPayloadSanitization();
verifyBudgetDefaults();

console.log('MAIL-ABUSE-001 mail abuse guard verification passed');
