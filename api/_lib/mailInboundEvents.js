import { timingSafeEqual } from 'node:crypto';

import {
  hashMailIdentifier,
  normalizeMailRecipient,
  sanitizeMailPayload,
} from './mailAbuseGuards.js';

const EMAIL_LIKE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

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

function extractEmails(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(item => extractEmails(item));
  }

  if (typeof value === 'object') {
    return extractEmails(
      value.email
      || value.address
      || value.mail
      || value.value
      || value.addr
      || ''
    );
  }

  const raw = String(value);
  const matches = raw.match(EMAIL_LIKE_PATTERN);
  if (matches?.length) {
    return matches;
  }

  return raw.includes('@') ? [raw] : [];
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeEmailList(values, {
  hashSalt,
  hashPrefix,
} = {}) {
  const normalized = values
    .flatMap(value => extractEmails(value))
    .map((email) => {
      const recipient = normalizeMailRecipient(email);
      if (!recipient.ok) return null;
      return {
        emailHash: hashMailIdentifier(recipient.email, {
          salt: hashSalt,
          prefix: hashPrefix,
        }),
        domain: recipient.domain,
      };
    })
    .filter(Boolean);

  return {
    count: normalized.length,
    hashes: uniqueItems(normalized.map(item => item.emailHash)).slice(0, 8),
    domains: uniqueItems(normalized.map(item => item.domain)).slice(0, 12),
  };
}

function pickFirst(input, keys) {
  for (const key of keys) {
    if (input?.[key] !== undefined && input?.[key] !== null && input?.[key] !== '') {
      return input[key];
    }
  }
  return '';
}

function normalizeInboundPayload(input = {}, {
  now = new Date(),
  hashSalt,
} = {}) {
  const eventType = normalizeString(input.eventType || input.event_type, 'inbound_received').toLowerCase();
  const providerKey = normalizeString(input.providerKey || input.provider_key, 'stalwart');
  const messageId = normalizeString(
    input.messageId
    || input.message_id
    || input.queueId
    || input.queue_id
    || input.sessionId
    || input.session_id,
    ''
  );
  const subject = normalizeString(input.subject, '');
  const sender = normalizeEmailList([
    pickFirst(input, ['from', 'mailFrom', 'mail_from', 'envelopeFrom', 'envelope_from', 'sender', 'returnPath', 'return_path']),
  ], {
    hashSalt,
    hashPrefix: 'inbound_sender',
  });
  const recipients = normalizeEmailList([
    pickFirst(input, ['to', 'recipients', 'rcptTo', 'rcpt_to', 'envelopeTo', 'envelope_to', 'deliveredTo', 'delivered_to']),
  ], {
    hashSalt,
    hashPrefix: 'inbound_recipient',
  });
  const attachments = Array.isArray(input.attachments)
    ? input.attachments.length
    : Number.parseInt(input.attachmentCount || input.attachment_count || 0, 10);
  const sizeBytes = Number.parseInt(input.sizeBytes || input.size_bytes || input.size || input.messageSize || 0, 10);
  const occurredAt = toIsoTimestamp(input.occurredAt || input.occurred_at || input.timestamp || now);
  const subjectHash = subject
    ? hashMailIdentifier(subject, { salt: hashSalt, prefix: 'inbound_subject' })
    : null;
  const providerMessageIdHash = messageId
    ? hashMailIdentifier(messageId, { salt: hashSalt, prefix: 'provider_message_id' })
    : null;
  const hasEnvelope = sender.count > 0 || recipients.count > 0 || Boolean(messageId);

  return {
    ok: hasEnvelope,
    eventType,
    providerKey,
    providerMessageIdHash,
    occurredAt,
    payload: sanitizeMailPayload({
      source: normalizeString(input.source, 'mail_inbound'),
      eventType,
      providerKey,
      providerMessageIdHash,
      sender: {
        count: sender.count,
        domains: sender.domains,
        hashes: sender.hashes,
      },
      recipients: {
        count: recipients.count,
        domains: recipients.domains,
        hashes: recipients.hashes,
      },
      subjectHash,
      sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : null,
      attachmentCount: Number.isFinite(attachments) && attachments > 0 ? attachments : 0,
      route: normalizeString(input.route || input.mailbox || input.recipientRole || input.recipient_role, '').slice(0, 80),
      diagnostics: input.diagnostics || input.payload || {},
      occurredAt,
    }),
  };
}

export function getMailInboundWebhookSecret(env = readEnvironment()) {
  return normalizeString(
    env.MAIL_INBOUND_WEBHOOK_SECRET
      || env.STALWART_INBOUND_WEBHOOK_SECRET
      || env.MAIL_DELIVERY_WEBHOOK_SECRET
      || env.STALWART_WEBHOOK_SECRET,
    ''
  );
}

export function verifyMailInboundWebhookSecret(req, env = readEnvironment()) {
  const expectedSecret = getMailInboundWebhookSecret(env);
  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      code: 'mail_inbound_secret_not_configured',
    };
  }

  const authorization = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const provided = normalizeString(
    bearer
      || req?.headers?.['x-mail-inbound-secret']
      || req?.headers?.['x-stalwart-inbound-secret']
      || req?.headers?.['x-mail-webhook-secret']
      || req?.headers?.['x-webhook-secret'],
    ''
  );

  if (!provided || !safeStringEqual(provided, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      code: 'mail_inbound_unauthorized',
    };
  }

  return { ok: true };
}

export async function recordMailInboundEvent({
  adminClient,
  input,
  now = new Date(),
  hashSalt,
} = {}) {
  if (!adminClient?.from) {
    return {
      ok: false,
      code: 'admin_client_unavailable',
      reason: 'Mail inbound events require a service-role Supabase client.',
    };
  }

  const inbound = normalizeInboundPayload(input, { now, hashSalt });
  if (!inbound.ok) {
    return {
      ok: false,
      code: 'mail_inbound_envelope_missing',
      reason: 'Inbound mail event requires at least a sender, recipient, or message id.',
    };
  }

  const { error } = await adminClient
    .from('mail_delivery_events')
    .insert({
      outbox_id: null,
      provider_key: inbound.providerKey,
      provider_message_id_hash: inbound.providerMessageIdHash,
      event_type: inbound.eventType,
      event_payload_redacted_json: inbound.payload,
      created_at: inbound.occurredAt,
    });

  if (error) {
    throw error;
  }

  return {
    ok: true,
    code: 'mail_inbound_recorded',
    eventType: inbound.eventType,
    providerKey: inbound.providerKey,
    deliveryEventRecorded: true,
  };
}

export const __internal = {
  extractEmails,
  normalizeEmailList,
  normalizeInboundPayload,
};
