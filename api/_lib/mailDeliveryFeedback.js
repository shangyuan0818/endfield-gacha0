import { timingSafeEqual } from 'node:crypto';

import {
  buildRecipientFingerprint,
  hashMailIdentifier,
  sanitizeMailPayload,
} from './mailAbuseGuards.js';

const SUPPRESSION_REASONS = new Set([
  'hard_bounce',
  'complaint',
  'invalid_recipient',
  'domain_pause',
]);

const EVENT_REASON_MAP = Object.freeze({
  bounce: 'hard_bounce',
  hard_bounce: 'hard_bounce',
  complaint: 'complaint',
  spam_complaint: 'complaint',
  invalid_recipient: 'invalid_recipient',
  invalid: 'invalid_recipient',
  domain_pause: 'domain_pause',
});

const STALWART_EVENT_MAP = Object.freeze({
  'delivery.delivered': { eventType: 'delivered', reason: '' },
  'delivery.dsn-success': { eventType: 'delivered', reason: '' },
  'delivery.dsn-temp-fail': { eventType: 'delivery_temp_fail', reason: '' },
  'delivery.dsn-perm-fail': { eventType: 'hard_bounce', reason: 'hard_bounce' },
  'delivery.double-bounce': { eventType: 'hard_bounce', reason: 'hard_bounce' },
  'delivery.rate-limit-exceeded': { eventType: 'delivery_rate_limited', reason: '' },
  'queue.rate-limit-exceeded': { eventType: 'queue_rate_limited', reason: '' },
});

function readEnvironment() {
  return globalThis.process?.env || {};
}

function normalizeString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function safeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''));
  const rightBuffer = Buffer.from(String(right ?? ''));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function toIsoTimestamp(value = new Date()) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeDomain(value) {
  const normalized = normalizeString(value, '').toLowerCase().replace(/\.$/, '');
  return normalized && normalized.includes('.') ? normalized : '';
}

function normalizeUuid(value) {
  const normalized = normalizeString(value, '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function getNestedValue(source, paths = []) {
  if (!source || typeof source !== 'object') return '';

  for (const path of paths) {
    const parts = String(path).split('.');
    let value = source;
    for (const part of parts) {
      if (value == null) break;
      value = value[part];
    }
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }

  return '';
}

function firstArrayValue(value) {
  return Array.isArray(value) ? value.find(item => item != null && String(item).trim()) : '';
}

function normalizeSuppressionReason(eventType, explicitReason = '') {
  const reason = normalizeString(explicitReason, '').toLowerCase();
  if (SUPPRESSION_REASONS.has(reason)) {
    return reason;
  }

  return EVENT_REASON_MAP[normalizeString(eventType, '').toLowerCase()] || '';
}

function normalizeStalwartEventType(type) {
  return normalizeString(type, '').toLowerCase();
}

function extractStalwartRecipient(data = {}) {
  const direct = getNestedValue(data, [
    'recipientEmail',
    'recipient_email',
    'rcptTo',
    'rcpt_to',
    'recipient',
    'to',
    'email',
    'address',
    'envelope.rcptTo',
    'envelope.rcpt_to',
    'envelope.to',
    'envelope.recipient',
    'smtp.rcptTo',
    'smtp.rcpt_to',
    'delivery.recipient',
    'dsn.recipient',
  ]);
  if (direct) return direct;

  return firstArrayValue(data.recipients)
    || firstArrayValue(data.rcptTo)
    || firstArrayValue(data.rcpt_to)
    || firstArrayValue(data.to);
}

function normalizeStalwartWebhookEvent(event = {}, {
  hashSalt,
} = {}) {
  const type = normalizeStalwartEventType(event.type || event.eventType || event.event_type);
  const data = event.data && typeof event.data === 'object' ? event.data : {};
  const mapped = STALWART_EVENT_MAP[type] || {
    eventType: type ? `stalwart_${type.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}` : 'stalwart_event',
    reason: '',
  };
  const providerMessageId = getNestedValue(data, [
    'providerMessageId',
    'provider_message_id',
    'messageId',
    'message_id',
    'queueId',
    'queue_id',
    'deliveryId',
    'delivery_id',
    'id',
  ]) || event.id;
  const recipientEmail = extractStalwartRecipient(data);
  const recipientDomain = getNestedValue(data, [
    'recipientDomain',
    'recipient_domain',
    'domain',
    'envelope.domain',
    'dsn.domain',
  ]);

  const eventId = normalizeString(event.id, '');
  const queueId = normalizeString(data.queueId || data.queue_id, '');

  return {
    eventType: mapped.eventType,
    reason: mapped.reason,
    providerKey: 'stalwart:webhook',
    providerMessageId,
    recipientEmail,
    recipientDomain,
    source: 'stalwart_webhook',
    occurredAt: event.createdAt || event.created_at || data.createdAt || data.created_at || new Date(),
    diagnostics: {
      stalwartEventIdHash: eventId
        ? hashMailIdentifier(eventId, { salt: hashSalt, prefix: 'stalwart_event_id' })
        : '',
      stalwartEventType: type,
      code: data.code || data.status || data.smtpStatus || data.smtp_status || '',
      details: data.details || data.reason || data.message || data.description || '',
      size: data.size || null,
      queueIdHash: queueId
        ? hashMailIdentifier(queueId, { salt: hashSalt, prefix: 'stalwart_queue_id' })
        : '',
    },
  };
}

export function normalizeMailFeedbackInputs(input = {}, {
  hashSalt,
} = {}) {
  if (Array.isArray(input?.events)) {
    return input.events.map(event => normalizeStalwartWebhookEvent(event, { hashSalt }));
  }

  if (Array.isArray(input)) {
    return input.map(item => (
      item?.type && item?.data && !item?.eventType && !item?.event_type
        ? normalizeStalwartWebhookEvent(item, { hashSalt })
        : item
    ));
  }

  if (input?.type && input?.data && !input.eventType && !input.event_type) {
    return [normalizeStalwartWebhookEvent(input, { hashSalt })];
  }

  return [input];
}

function resolveRecipientIdentity({
  recipientEmail,
  recipientEmailHash,
  recipientDomain,
  hashSalt,
} = {}) {
  const explicitHash = normalizeString(recipientEmailHash, '');
  const explicitDomain = normalizeDomain(recipientDomain);

  if (recipientEmail) {
    const fingerprint = buildRecipientFingerprint(recipientEmail, { salt: hashSalt });
    if (fingerprint.ok) {
      return {
        ok: true,
        emailHash: fingerprint.emailHash,
        domain: fingerprint.domain,
        redacted: fingerprint.redacted,
      };
    }
  }

  if (explicitHash || explicitDomain) {
    return {
      ok: true,
      emailHash: explicitHash,
      domain: explicitDomain,
      redacted: explicitHash ? 'hashed-recipient' : explicitDomain,
    };
  }

  return {
    ok: false,
    emailHash: '',
    domain: '',
    redacted: '',
  };
}

function buildProviderMessageIdHash(providerMessageId, hashSalt) {
  const normalized = normalizeString(providerMessageId, '');
  return normalized
    ? hashMailIdentifier(normalized, { salt: hashSalt, prefix: 'provider_message_id' })
    : null;
}

function normalizeFeedbackPayload(input = {}, {
  now = new Date(),
  hashSalt,
} = {}) {
  const eventType = normalizeString(input.eventType || input.event_type, '').toLowerCase();
  const reason = normalizeSuppressionReason(eventType, input.reason);
  const providerMessageId = normalizeString(input.providerMessageId || input.provider_message_id, '');
  const providerMessageIdHash = normalizeString(input.providerMessageIdHash || input.provider_message_id_hash, '')
    || buildProviderMessageIdHash(providerMessageId, hashSalt);
  const recipient = resolveRecipientIdentity({
    recipientEmail: input.recipientEmail || input.recipient_email,
    recipientEmailHash: input.recipientEmailHash || input.recipient_email_hash,
    recipientDomain: input.recipientDomain || input.recipient_domain || input.domain,
    hashSalt,
  });
  const suppressDomain = reason === 'domain_pause' || input.suppressDomain === true || input.suppress_domain === true;
  const shouldSuppress = Boolean(reason);
  const domain = normalizeDomain(input.recipientDomain || input.recipient_domain || input.domain || recipient.domain);

  return {
    eventType: eventType || (reason || 'provider_event'),
    providerKey: normalizeString(input.providerKey || input.provider_key, 'mail'),
    providerMessageIdHash,
    outboxId: normalizeUuid(input.outboxId || input.outbox_id),
    recipient,
    suppressDomain,
    shouldSuppress,
    suppressionReason: reason,
    suppressionTarget: suppressDomain
      ? { recipient_email_hash: null, recipient_domain: domain || recipient.domain || null }
      : { recipient_email_hash: recipient.emailHash || null, recipient_domain: null },
    source: normalizeString(input.source, 'provider_feedback').slice(0, 80),
    expiresAt: input.expiresAt || input.expires_at || null,
    occurredAt: toIsoTimestamp(input.occurredAt || input.occurred_at || now),
    payload: sanitizeMailPayload({
      code: input.code || '',
      eventType,
      reason,
      providerKey: input.providerKey || input.provider_key || '',
      providerMessageIdHash,
      recipient: {
        redacted: recipient.redacted,
        domain: recipient.domain,
      },
      diagnostics: input.diagnostics || input.payload || {},
    }),
  };
}

async function maybeSingle(query) {
  if (typeof query?.maybeSingle === 'function') {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data || null;
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function insertDeliveryEvent(adminClient, feedback, {
  now,
} = {}) {
  const event = {
    outbox_id: feedback.outboxId,
    provider_key: feedback.providerKey,
    provider_message_id_hash: feedback.providerMessageIdHash,
    event_type: feedback.eventType,
    event_payload_redacted_json: feedback.payload,
    created_at: toIsoTimestamp(now),
  };

  const { error } = await adminClient
    .from('mail_delivery_events')
    .insert(event);

  if (error) throw error;
  return event;
}

async function updateOutboxForSuppression(adminClient, feedback, {
  now,
} = {}) {
  if (!feedback.outboxId) {
    return { updated: false };
  }

  const { error } = await adminClient
    .from('mail_outbox')
    .update({
      status: 'suppressed',
      last_error_code: feedback.suppressionReason,
      last_error_redacted_json: feedback.payload,
      updated_at: toIsoTimestamp(now),
    })
    .eq('id', feedback.outboxId);

  if (error) throw error;
  return { updated: true };
}

async function findActiveSuppression(adminClient, feedback) {
  const target = feedback.suppressionTarget || {};
  const emailHash = target.recipient_email_hash || '';
  const domain = target.recipient_domain || '';
  if (!emailHash && !domain) {
    return null;
  }

  const query = adminClient
    .from('mail_suppression')
    .select('id, recipient_email_hash, recipient_domain, status, reason, notes_redacted_json')
    .eq('status', 'active');

  if (emailHash) {
    query.eq('recipient_email_hash', emailHash);
  } else {
    query.eq('recipient_domain', domain);
  }

  return maybeSingle(query);
}

async function upsertSuppression(adminClient, feedback, {
  now,
} = {}) {
  if (!feedback.shouldSuppress) {
    return { action: 'none', row: null };
  }

  const target = feedback.suppressionTarget || {};
  if (!target.recipient_email_hash && !target.recipient_domain) {
    return {
      action: 'invalid',
      row: null,
      error: 'Suppression target is missing.',
    };
  }

  const nowIso = toIsoTimestamp(now);
  const notes = sanitizeMailPayload({
    source: feedback.source,
    eventType: feedback.eventType,
    reason: feedback.suppressionReason,
    providerKey: feedback.providerKey,
    providerMessageIdHash: feedback.providerMessageIdHash,
    occurredAt: feedback.occurredAt,
    payload: feedback.payload,
  });
  const existing = await findActiveSuppression(adminClient, feedback);

  if (existing?.id) {
    const { data, error } = await adminClient
      .from('mail_suppression')
      .update({
        reason: feedback.suppressionReason,
        source: feedback.source,
        notes_redacted_json: {
          ...(existing.notes_redacted_json || {}),
          latest: notes,
        },
        expires_at: feedback.expiresAt || null,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .select('id, recipient_email_hash, recipient_domain, reason, status, source, expires_at')
      .maybeSingle();

    if (error) throw error;
    return { action: 'updated', row: data || existing };
  }

  const { data, error } = await adminClient
    .from('mail_suppression')
    .insert({
      recipient_email_hash: target.recipient_email_hash,
      recipient_domain: target.recipient_domain,
      reason: feedback.suppressionReason,
      status: 'active',
      source: feedback.source,
      notes_redacted_json: notes,
      expires_at: feedback.expiresAt || null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, recipient_email_hash, recipient_domain, reason, status, source, expires_at')
    .maybeSingle();

  if (error) throw error;
  return { action: 'inserted', row: data || null };
}

export function getMailDeliveryFeedbackSecret(env = readEnvironment()) {
  return normalizeString(
    env.MAIL_DELIVERY_WEBHOOK_SECRET
      || env.STALWART_WEBHOOK_SECRET
      || env.POSTAL_WEBHOOK_SECRET,
    ''
  );
}

export function verifyMailDeliveryFeedbackSecret(req, env = readEnvironment()) {
  const expectedSecret = getMailDeliveryFeedbackSecret(env);
  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      code: 'mail_feedback_secret_not_configured',
    };
  }

  const authorization = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const provided = normalizeString(
    bearer
      || req?.headers?.['x-mail-webhook-secret']
      || req?.headers?.['x-stalwart-webhook-secret']
      || req?.headers?.['x-webhook-secret'],
    ''
  );

  if (!provided || !safeStringEqual(provided, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      code: 'mail_feedback_unauthorized',
    };
  }

  return { ok: true };
}

export async function recordMailDeliveryFeedback({
  adminClient,
  input,
  now = new Date(),
  hashSalt,
} = {}) {
  if (!adminClient?.from) {
    return {
      ok: false,
      code: 'admin_client_unavailable',
      reason: 'Mail delivery feedback requires a service-role Supabase client.',
    };
  }

  const feedback = normalizeFeedbackPayload(input, { now, hashSalt });
  if (feedback.shouldSuppress && !feedback.suppressionTarget.recipient_email_hash && !feedback.suppressionTarget.recipient_domain) {
    return {
      ok: false,
      code: 'mail_feedback_suppression_target_missing',
      reason: 'Suppression feedback requires a recipient hash, recipient email, or domain.',
    };
  }

  const deliveryEvent = await insertDeliveryEvent(adminClient, feedback, { now });
  const suppression = await upsertSuppression(adminClient, feedback, { now });
  const outbox = feedback.shouldSuppress
    ? await updateOutboxForSuppression(adminClient, feedback, { now })
    : { updated: false };

  return {
    ok: true,
    code: feedback.shouldSuppress ? 'mail_feedback_suppression_recorded' : 'mail_feedback_recorded',
    eventType: feedback.eventType,
    providerKey: feedback.providerKey,
    deliveryEventRecorded: Boolean(deliveryEvent),
    suppression,
    outbox,
  };
}

export async function recordMailDeliveryFeedbackBatch({
  adminClient,
  input,
  now = new Date(),
  hashSalt,
  maxEvents = 50,
} = {}) {
  const inputs = normalizeMailFeedbackInputs(input, { hashSalt }).slice(0, maxEvents);
  const results = [];

  for (const item of inputs) {
    results.push(await recordMailDeliveryFeedback({
      adminClient,
      input: item,
      now,
      hashSalt,
    }));
  }

  const failed = results.filter(result => result?.ok === false);
  return {
    ok: failed.length === 0,
    partial: failed.length > 0 && failed.length < results.length,
    code: failed.length === 0 ? 'mail_feedback_batch_recorded' : 'mail_feedback_batch_partial',
    received: inputs.length,
    recorded: results.filter(result => result?.ok === true).length,
    failed: failed.length,
    results: results.map(result => ({
      ok: Boolean(result?.ok),
      code: result?.code || 'unknown',
      eventType: result?.eventType || null,
      providerKey: result?.providerKey || null,
      suppressionAction: result?.suppression?.action || 'none',
      outboxUpdated: Boolean(result?.outbox?.updated),
    })),
  };
}

export const __internal = {
  normalizeMailFeedbackInputs,
  normalizeFeedbackPayload,
  normalizeSuppressionReason,
  normalizeStalwartWebhookEvent,
  resolveRecipientIdentity,
};
