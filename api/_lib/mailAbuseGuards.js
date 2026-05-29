import { createHash, createHmac } from 'node:crypto';
import { domainToASCII } from 'node:url';

export const MAIL_EVENT_TYPES = Object.freeze({
  REGISTER_CONFIRMATION: 'register_confirmation',
  EMAIL_LOGIN: 'email_login',
  EMAIL_VERIFICATION: 'email_verification',
  EMAIL_CHANGE: 'email_change',
  PASSWORD_RESET: 'password_reset',
  TICKET_REPLY: 'ticket_reply',
  DEVELOPER_API_REVIEW: 'developer_api_review',
  ADMIN_ALERT: 'admin_alert',
});

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export const DEFAULT_MAIL_BUDGETS = Object.freeze({
  global: { windowMs: ONE_DAY_MS, max: 500 },
  events: {
    [MAIL_EVENT_TYPES.REGISTER_CONFIRMATION]: {
      eventDaily: 120,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 2 },
      domainDaily: 40,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 5 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 4 },
    },
    [MAIL_EVENT_TYPES.PASSWORD_RESET]: {
      eventDaily: 100,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 3 },
      domainDaily: 30,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 5 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 3 },
    },
    [MAIL_EVENT_TYPES.EMAIL_LOGIN]: {
      eventDaily: 100,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 3 },
      domainDaily: 30,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 5 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 3 },
    },
    [MAIL_EVENT_TYPES.EMAIL_VERIFICATION]: {
      eventDaily: 120,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 3 },
      domainDaily: 40,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 5 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 3 },
    },
    [MAIL_EVENT_TYPES.EMAIL_CHANGE]: {
      eventDaily: 80,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 3 },
      domainDaily: 30,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 5 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 3 },
    },
    [MAIL_EVENT_TYPES.TICKET_REPLY]: {
      eventDaily: 200,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 10 },
      domainDaily: 80,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 20 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 12 },
      relatedWindow: { windowMs: ONE_HOUR_MS, max: 10 },
    },
    [MAIL_EVENT_TYPES.DEVELOPER_API_REVIEW]: {
      eventDaily: 50,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 5 },
      domainDaily: 20,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 10 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 6 },
    },
    [MAIL_EVENT_TYPES.ADMIN_ALERT]: {
      eventDaily: 50,
      recipientWindow: { windowMs: ONE_HOUR_MS, max: 10 },
      domainDaily: 20,
      ipWindow: { windowMs: ONE_HOUR_MS, max: 20 },
      userWindow: { windowMs: ONE_HOUR_MS, max: 20 },
      relatedWindow: { windowMs: ONE_HOUR_MS, max: 6 },
    },
  },
});

const SENSITIVE_KEY_PATTERN = /(token|password|secret|api[_-]?key|authorization|cookie|email|user[_-]?id|game[_-]?uid|platform[_-]?id|record[_-]?id|history)/i;
const EMAIL_LIKE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function getDefaultHashSalt() {
  return (
    process.env.MAIL_ABUSE_HASH_SECRET ||
    process.env.MAIL_HASH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    'local-development-mail-abuse-salt'
  );
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(',')}}`;
}

function toHashInput(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return stableJson(value);
}

export function hashMailIdentifier(value, {
  salt = getDefaultHashSalt(),
  prefix = 'mail',
} = {}) {
  return createHmac('sha256', String(salt || ''))
    .update(`${prefix}:${toHashInput(value)}`)
    .digest('hex');
}

export function normalizeMailRecipient(rawEmail) {
  const normalized = String(rawEmail || '')
    .trim()
    .replace(/^mailto:/i, '')
    .toLowerCase();

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return {
      ok: false,
      reason: 'invalid_email',
      email: '',
      domain: '',
    };
  }

  const localPart = normalized.slice(0, atIndex);
  const rawDomain = normalized.slice(atIndex + 1).replace(/\.$/, '');
  const asciiDomain = domainToASCII(rawDomain);

  if (
    !localPart ||
    !asciiDomain ||
    localPart.length > 128 ||
    asciiDomain.length > 253 ||
    asciiDomain.includes('..') ||
    !asciiDomain.includes('.')
  ) {
    return {
      ok: false,
      reason: 'invalid_email',
      email: '',
      domain: '',
    };
  }

  return {
    ok: true,
    reason: '',
    email: `${localPart}@${asciiDomain}`,
    domain: asciiDomain,
  };
}

export function redactMailAddress(rawEmail) {
  const recipient = normalizeMailRecipient(rawEmail);
  if (!recipient.ok) {
    return 'invalid-recipient';
  }

  const [localPart, domain] = recipient.email.split('@');
  const [domainHead, ...domainRest] = domain.split('.');
  const redactSegment = (segment) => {
    if (!segment) return '*';
    if (segment.length <= 2) return `${segment[0] || '*'}*`;
    return `${segment[0]}***${segment[segment.length - 1]}`;
  };

  return `${redactSegment(localPart)}@${redactSegment(domainHead)}${domainRest.length ? `.${domainRest.join('.')}` : ''}`;
}

export function buildRecipientFingerprint(rawEmail, options = {}) {
  const recipient = normalizeMailRecipient(rawEmail);
  if (!recipient.ok) {
    return {
      ok: false,
      reason: recipient.reason,
      emailHash: '',
      domain: '',
      domainHash: '',
      redacted: 'invalid-recipient',
    };
  }

  return {
    ok: true,
    reason: '',
    emailHash: hashMailIdentifier(recipient.email, { ...options, prefix: 'recipient_email' }),
    domain: recipient.domain,
    domainHash: hashMailIdentifier(recipient.domain, { ...options, prefix: 'recipient_domain' }),
    redacted: redactMailAddress(recipient.email),
  };
}

export function buildMailIdempotencyKey({
  eventType,
  recipientEmailHash,
  templateKey = '',
  locale = '',
  relatedEntityType = '',
  relatedEntityId = '',
  purposeKey = '',
} = {}) {
  return createHash('sha256')
    .update(stableJson({
      eventType: String(eventType || ''),
      recipientEmailHash: String(recipientEmailHash || ''),
      templateKey: String(templateKey || ''),
      locale: String(locale || ''),
      relatedEntityType: String(relatedEntityType || ''),
      relatedEntityId: String(relatedEntityId || ''),
      purposeKey: String(purposeKey || ''),
    }))
    .digest('hex');
}

function windowBucket(nowMs, windowMs) {
  return Math.floor(nowMs / windowMs);
}

function createBudgetBucket({
  scope,
  eventType,
  identity,
  windowMs,
  max,
  now,
  hashSalt,
}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const keyMaterial = `${scope}:${eventType}:${identity}:${windowBucket(safeNowMs, windowMs)}`;
  const keyHash = hashMailIdentifier(keyMaterial, {
    salt: hashSalt,
    prefix: 'mail_budget_bucket',
  });

  return {
    scope,
    eventType,
    bucketKeyHash: keyHash,
    windowMs,
    max,
    resetAt: new Date((windowBucket(safeNowMs, windowMs) + 1) * windowMs).toISOString(),
  };
}

function getEventBudget(eventType, budgets) {
  return budgets?.events?.[eventType] || null;
}

export function buildMailBudgetBuckets({
  eventType,
  recipientEmailHash,
  recipientDomain,
  requesterIp,
  userId,
  relatedEntityType,
  relatedEntityId,
  budgets = DEFAULT_MAIL_BUDGETS,
  now = new Date(),
  hashSalt,
} = {}) {
  const eventBudget = getEventBudget(eventType, budgets);
  if (!eventBudget) {
    return [];
  }

  const buckets = [];
  const globalBudget = budgets.global || { windowMs: ONE_DAY_MS, max: 500 };

  buckets.push(createBudgetBucket({
    scope: 'global',
    eventType: '*',
    identity: 'all',
    windowMs: globalBudget.windowMs,
    max: globalBudget.max,
    now,
    hashSalt,
  }));

  buckets.push(createBudgetBucket({
    scope: 'event',
    eventType,
    identity: eventType,
    windowMs: ONE_DAY_MS,
    max: eventBudget.eventDaily,
    now,
    hashSalt,
  }));

  if (recipientEmailHash && eventBudget.recipientWindow) {
    buckets.push(createBudgetBucket({
      scope: 'recipient',
      eventType,
      identity: recipientEmailHash,
      windowMs: eventBudget.recipientWindow.windowMs,
      max: eventBudget.recipientWindow.max,
      now,
      hashSalt,
    }));
  }

  if (recipientDomain && eventBudget.domainDaily) {
    buckets.push(createBudgetBucket({
      scope: 'domain',
      eventType,
      identity: recipientDomain,
      windowMs: ONE_DAY_MS,
      max: eventBudget.domainDaily,
      now,
      hashSalt,
    }));
  }

  if (requesterIp && eventBudget.ipWindow) {
    buckets.push(createBudgetBucket({
      scope: 'ip',
      eventType,
      identity: hashMailIdentifier(requesterIp, { salt: hashSalt, prefix: 'requester_ip' }),
      windowMs: eventBudget.ipWindow.windowMs,
      max: eventBudget.ipWindow.max,
      now,
      hashSalt,
    }));
  }

  if (userId && eventBudget.userWindow) {
    buckets.push(createBudgetBucket({
      scope: 'user',
      eventType,
      identity: hashMailIdentifier(userId, { salt: hashSalt, prefix: 'user_id' }),
      windowMs: eventBudget.userWindow.windowMs,
      max: eventBudget.userWindow.max,
      now,
      hashSalt,
    }));
  }

  if ((relatedEntityType || relatedEntityId) && eventBudget.relatedWindow) {
    buckets.push(createBudgetBucket({
      scope: 'related',
      eventType,
      identity: hashMailIdentifier(`${relatedEntityType || ''}:${relatedEntityId || ''}`, {
        salt: hashSalt,
        prefix: 'related_entity',
      }),
      windowMs: eventBudget.relatedWindow.windowMs,
      max: eventBudget.relatedWindow.max,
      now,
      hashSalt,
    }));
  }

  return buckets;
}

function normalizeStringSet(values) {
  if (!values) {
    return new Set();
  }

  if (values instanceof Set) {
    return new Set([...values].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  }

  if (Array.isArray(values)) {
    return new Set(values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  }

  return new Set([String(values || '').trim().toLowerCase()].filter(Boolean));
}

function getCounterValue(counters, bucketKeyHash) {
  if (!counters) {
    return 0;
  }

  if (counters instanceof Map) {
    return Number(counters.get(bucketKeyHash) || 0);
  }

  return Number(counters[bucketKeyHash] || 0);
}

function buildBlockedDecision({
  code,
  reason,
  eventType,
  recipient,
  idempotencyKey = '',
  buckets = [],
  exceededBucket = null,
}) {
  return {
    allowed: false,
    shouldEnqueue: false,
    action: 'block',
    code,
    reason,
    eventType,
    recipient,
    idempotencyKey,
    buckets,
    exceededBucket,
  };
}

export function evaluateMailAbuseGuards({
  eventType,
  recipientEmail,
  requesterIp = '',
  userId = '',
  templateKey = '',
  locale = '',
  relatedEntityType = '',
  relatedEntityId = '',
  purposeKey = '',
  killSwitch = false,
  disabledEvents = [],
  pausedDomains = [],
  suppressionList = [],
  existingIdempotency = false,
  counters = {},
  budgets = DEFAULT_MAIL_BUDGETS,
  now = new Date(),
  hashSalt,
} = {}) {
  if (!Object.values(MAIL_EVENT_TYPES).includes(eventType)) {
    return buildBlockedDecision({
      code: 'invalid_event_type',
      reason: 'Unsupported mail event type.',
      eventType: String(eventType || ''),
      recipient: { ok: false, emailHash: '', domain: '', redacted: 'invalid-recipient' },
    });
  }

  const recipient = buildRecipientFingerprint(recipientEmail, { salt: hashSalt });
  if (!recipient.ok) {
    return buildBlockedDecision({
      code: recipient.reason,
      reason: 'Recipient email is invalid.',
      eventType,
      recipient,
    });
  }

  const idempotencyKey = buildMailIdempotencyKey({
    eventType,
    recipientEmailHash: recipient.emailHash,
    templateKey,
    locale,
    relatedEntityType,
    relatedEntityId,
    purposeKey,
  });

  if (killSwitch) {
    return buildBlockedDecision({
      code: 'mail_kill_switch_enabled',
      reason: 'Global mail sending is paused.',
      eventType,
      recipient,
      idempotencyKey,
    });
  }

  if (normalizeStringSet(disabledEvents).has(eventType)) {
    return buildBlockedDecision({
      code: 'mail_event_disabled',
      reason: 'This mail event type is disabled.',
      eventType,
      recipient,
      idempotencyKey,
    });
  }

  if (normalizeStringSet(pausedDomains).has(recipient.domain)) {
    return buildBlockedDecision({
      code: 'mail_domain_paused',
      reason: 'Recipient domain is paused.',
      eventType,
      recipient,
      idempotencyKey,
    });
  }

  const suppressionMatch = suppressionList.find((item) => {
    if (!item || item.status === 'revoked') {
      return false;
    }

    const emailHash = item.recipientEmailHash || item.recipient_email_hash || '';
    const domain = String(item.domain || item.recipientDomain || item.recipient_domain || '').toLowerCase();

    return emailHash === recipient.emailHash || domain === recipient.domain;
  });

  if (suppressionMatch) {
    return buildBlockedDecision({
      code: 'mail_recipient_suppressed',
      reason: 'Recipient is on the suppression list.',
      eventType,
      recipient,
      idempotencyKey,
    });
  }

  if (existingIdempotency) {
    return {
      allowed: true,
      shouldEnqueue: false,
      action: 'dedupe',
      code: 'mail_idempotency_hit',
      reason: 'Existing mail outbox item already covers this event.',
      eventType,
      recipient,
      idempotencyKey,
      buckets: [],
      exceededBucket: null,
    };
  }

  const buckets = buildMailBudgetBuckets({
    eventType,
    recipientEmailHash: recipient.emailHash,
    recipientDomain: recipient.domain,
    requesterIp,
    userId,
    relatedEntityType,
    relatedEntityId,
    budgets,
    now,
    hashSalt,
  }).map((bucket) => {
    const used = getCounterValue(counters, bucket.bucketKeyHash);
    return {
      ...bucket,
      used,
      remaining: Math.max(0, bucket.max - used),
    };
  });

  const exceededBucket = buckets.find((bucket) => bucket.used >= bucket.max);
  if (exceededBucket) {
    return buildBlockedDecision({
      code: `mail_budget_exceeded:${exceededBucket.scope}`,
      reason: 'Mail sending budget exceeded.',
      eventType,
      recipient,
      idempotencyKey,
      buckets,
      exceededBucket,
    });
  }

  return {
    allowed: true,
    shouldEnqueue: true,
    action: 'queue',
    code: 'mail_queue_allowed',
    reason: 'Mail event passed abuse guards.',
    eventType,
    recipient,
    idempotencyKey,
    buckets,
    exceededBucket: null,
  };
}

export function sanitizeMailPayload(value, {
  maxDepth = 6,
  currentDepth = 0,
} = {}) {
  if (currentDepth >= maxDepth) {
    return '[redacted-depth-limit]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.replace(EMAIL_LIKE_PATTERN, '[redacted-email]');
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMailPayload(item, {
      maxDepth,
      currentDepth: currentDepth + 1,
    }));
  }

  const output = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[redacted]';
      continue;
    }

    output[key] = sanitizeMailPayload(nestedValue, {
      maxDepth,
      currentDepth: currentDepth + 1,
    });
  }

  return output;
}

export function serializeMailDecisionForStorage(decision) {
  return {
    allowed: Boolean(decision?.allowed),
    shouldEnqueue: Boolean(decision?.shouldEnqueue),
    action: decision?.action || 'unknown',
    code: decision?.code || 'unknown',
    eventType: decision?.eventType || '',
    recipient: {
      emailHash: decision?.recipient?.emailHash || '',
      domain: decision?.recipient?.domain || '',
      redacted: decision?.recipient?.redacted || '',
    },
    idempotencyKey: decision?.idempotencyKey || '',
    buckets: (decision?.buckets || []).map((bucket) => ({
      scope: bucket.scope,
      eventType: bucket.eventType,
      bucketKeyHash: bucket.bucketKeyHash,
      windowMs: bucket.windowMs,
      max: bucket.max,
      used: bucket.used,
      remaining: bucket.remaining,
      resetAt: bucket.resetAt,
    })),
    exceededBucket: decision?.exceededBucket
      ? {
        scope: decision.exceededBucket.scope,
        bucketKeyHash: decision.exceededBucket.bucketKeyHash,
        max: decision.exceededBucket.max,
        used: decision.exceededBucket.used,
        resetAt: decision.exceededBucket.resetAt,
      }
      : null,
  };
}
