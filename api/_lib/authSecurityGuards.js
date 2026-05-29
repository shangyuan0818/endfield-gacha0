import { createHmac } from 'node:crypto';
import { domainToASCII } from 'node:url';
import { verifyPowPayload } from './powChallenge.js';

export const AUTH_SECURITY_ACTIONS = Object.freeze({
  LOGIN: 'login',
  REGISTER: 'register',
  CHANGE_PASSWORD: 'change_password',
  PASSWORD_RESET: 'password_reset',
  RESEND_VERIFICATION: 'resend_verification',
  ACCOUNT_RECOVERY: 'account_recovery',
});

const EMAIL_LIKE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SENSITIVE_KEY_PATTERN = /(token|password|secret|api[_-]?key|authorization|cookie|email|user[_-]?id|game[_-]?uid|platform[_-]?id|record[_-]?id|history|captcha)/i;
const DEFAULT_CAPTCHA_ACTIONS = new Set([
  AUTH_SECURITY_ACTIONS.REGISTER,
  AUTH_SECURITY_ACTIONS.PASSWORD_RESET,
  AUTH_SECURITY_ACTIONS.ACCOUNT_RECOVERY,
]);

function readEnvironment() {
  return globalThis.process?.env || {};
}

function splitList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeSet(rawValue) {
  return new Set(splitList(rawValue).map((value) => value.toLowerCase()));
}

function getHashSalt(env = readEnvironment()) {
  return (
    env.AUTH_SECURITY_HASH_SECRET ||
    env.MAIL_ABUSE_HASH_SECRET ||
    env.MAIL_HASH_SECRET ||
    env.SUPABASE_JWT_SECRET ||
    'local-development-auth-security-salt'
  );
}

export function hashAuthSecurityIdentifier(value, {
  salt = getHashSalt(),
  prefix = 'auth_security',
} = {}) {
  return createHmac('sha256', String(salt || ''))
    .update(`${prefix}:${String(value || '')}`)
    .digest('hex');
}

export function normalizeAuthEmail(rawEmail) {
  const normalized = String(rawEmail || '')
    .trim()
    .replace(/^mailto:/i, '')
    .toLowerCase();

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return {
      ok: false,
      reason: normalized ? 'invalid_email' : 'missing_email',
      domain: '',
      redacted: normalized ? 'invalid-email' : '',
      emailHash: '',
      domainHash: '',
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
      domain: '',
      redacted: 'invalid-email',
      emailHash: '',
      domainHash: '',
    };
  }

  const email = `${localPart}@${asciiDomain}`;
  return {
    ok: true,
    reason: '',
    domain: asciiDomain,
    redacted: redactAuthEmail(email),
    emailHash: hashAuthSecurityIdentifier(email, { prefix: 'auth_email' }),
    domainHash: hashAuthSecurityIdentifier(asciiDomain, { prefix: 'auth_email_domain' }),
  };
}

export function redactAuthEmail(rawEmail) {
  const normalized = String(rawEmail || '').trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return normalized ? 'invalid-email' : '';
  }

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const [domainHead, ...domainRest] = domain.split('.');
  const redactSegment = (segment) => {
    if (!segment) return '*';
    if (segment.length <= 2) return `${segment[0] || '*'}*`;
    return `${segment[0]}***${segment[segment.length - 1]}`;
  };

  return `${redactSegment(localPart)}@${redactSegment(domainHead)}${domainRest.length ? `.${domainRest.join('.')}` : ''}`;
}

export function sanitizeAuthAuditValue(value, {
  maxDepth = 5,
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
    return value.map((item) => sanitizeAuthAuditValue(item, {
      maxDepth,
      currentDepth: currentDepth + 1,
    }));
  }

  const sanitized = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[redacted]';
      continue;
    }

    sanitized[key] = sanitizeAuthAuditValue(nestedValue, {
      maxDepth,
      currentDepth: currentDepth + 1,
    });
  }

  return sanitized;
}

export function getRequesterIp(req) {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  const realIp = req?.headers?.['x-real-ip'];
  return typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : realIp || req?.socket?.remoteAddress || 'unknown';
}

function getOrigin(req) {
  return String(req?.headers?.origin || 'no-origin').trim() || 'no-origin';
}

function getUserAgent(req) {
  return String(req?.headers?.['user-agent'] || '').trim();
}

export function getAuthCaptchaPolicy({
  action,
  env = readEnvironment(),
} = {}) {
  const rawMode = String(
    env.AUTH_CAPTCHA_MODE ||
    (String(env.AUTH_CAPTCHA_ENABLED || '').toLowerCase() === 'true' ? 'enforce' : 'off')
  ).trim().toLowerCase();
  const mode = ['off', 'monitor', 'enforce'].includes(rawMode) ? rawMode : 'off';
  const provider = String(env.AUTH_CAPTCHA_PROVIDER || 'turnstile').trim().toLowerCase();
  const requiredActionValues = splitList(env.AUTH_CAPTCHA_REQUIRED_ACTIONS);
  const requiredActions = requiredActionValues.length > 0
    ? new Set(requiredActionValues.map((value) => value.toLowerCase()))
    : DEFAULT_CAPTCHA_ACTIONS;
  const secretKey = (
    env.AUTH_CAPTCHA_SECRET_KEY ||
    env.TURNSTILE_SECRET_KEY ||
    env.HCAPTCHA_SECRET_KEY ||
    env.H_CAPTCHA_SECRET_KEY ||
    ''
  ).trim();
  const normalizedAction = String(action || '').trim().toLowerCase();
  const actionCovered = requiredActions.has(normalizedAction);

  return {
    mode,
    provider,
    required: mode === 'enforce' && actionCovered,
    monitoring: mode === 'monitor' && actionCovered,
    configured: provider === 'pow' ? true : Boolean(secretKey),
    secretKey,
    actionCovered,
  };
}

function getCaptchaVerifyUrl(provider) {
  if (provider === 'hcaptcha') {
    return 'https://hcaptcha.com/siteverify';
  }

  return 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
}

function normalizeCaptchaResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      errorCodes: ['invalid_response'],
      hostname: '',
      challengeTs: '',
    };
  }

  return {
    success: payload.success === true,
    errorCodes: Array.isArray(payload['error-codes']) ? payload['error-codes'] : [],
    hostname: String(payload.hostname || ''),
    challengeTs: String(payload.challenge_ts || payload.challengeTs || ''),
  };
}

export async function verifyAuthCaptcha({
  action,
  token,
  provider,
  powPayload,
  requesterIp,
  env = readEnvironment(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const basePolicy = getAuthCaptchaPolicy({ action, env });
  const requestedProvider = String(provider || basePolicy.provider || '').trim().toLowerCase();
  const policy = requestedProvider === 'pow'
    ? { ...basePolicy, provider: 'pow', configured: true }
    : basePolicy;
  const safeBase = {
    provider: policy.provider,
    mode: policy.mode,
    required: policy.required,
    monitoring: policy.monitoring,
  };

  if (policy.mode === 'off' || !policy.actionCovered) {
    return {
      ...safeBase,
      ok: true,
      status: 'disabled',
      code: 'captcha_disabled',
    };
  }

  if (policy.provider === 'pow') {
    const powResult = await verifyPowPayload({
      action,
      payload: powPayload,
      env,
    });

    return {
      ...safeBase,
      ok: powResult.ok || !policy.required,
      status: powResult.status,
      code: powResult.code,
      algorithm: powResult.algorithm,
      challengeId: powResult.challengeId,
      difficulty: powResult.difficulty,
      totalSteps: powResult.totalSteps,
    };
  }

  if (!policy.configured) {
    return {
      ...safeBase,
      ok: !policy.required,
      status: policy.required ? 'not_configured' : 'not_configured_monitor',
      code: policy.required ? 'captcha_not_configured' : 'captcha_not_configured_monitor',
    };
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return {
      ...safeBase,
      ok: !policy.required,
      status: policy.required ? 'missing' : 'missing_monitor',
      code: policy.required ? 'captcha_required' : 'captcha_missing_monitor',
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ...safeBase,
      ok: !policy.required,
      status: 'verify_unavailable',
      code: 'captcha_fetch_unavailable',
    };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), 5000)
    : null;

  try {
    const params = new URLSearchParams();
    params.set('secret', policy.secretKey);
    params.set('response', normalizedToken);
    if (requesterIp && requesterIp !== 'unknown') {
      params.set('remoteip', requesterIp);
    }

    const response = await fetchImpl(getCaptchaVerifyUrl(policy.provider), {
      method: 'POST',
      body: params,
      signal: controller?.signal,
    });
    const payload = normalizeCaptchaResponse(await response.json().catch(() => null));

    return {
      ...safeBase,
      ok: payload.success || !policy.required,
      status: payload.success ? 'verified' : 'failed',
      code: payload.success ? 'captcha_verified' : 'captcha_failed',
      errorCodes: payload.errorCodes.slice(0, 5),
      hostname: payload.hostname,
      challengeTs: payload.challengeTs,
    };
  } catch {
    return {
      ...safeBase,
      ok: !policy.required,
      status: 'verify_error',
      code: 'captcha_verify_error',
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function buildRequesterFingerprint(req) {
  const ip = getRequesterIp(req);
  const origin = getOrigin(req);
  const userAgent = getUserAgent(req);

  return {
    ip,
    ipHash: hashAuthSecurityIdentifier(ip, { prefix: 'auth_request_ip' }),
    originHash: hashAuthSecurityIdentifier(origin, { prefix: 'auth_request_origin' }),
    userAgentHash: userAgent
      ? hashAuthSecurityIdentifier(userAgent, { prefix: 'auth_user_agent' })
      : '',
    hasOrigin: origin !== 'no-origin',
    hasUserAgent: Boolean(userAgent),
  };
}

export function evaluateAuthSecurityRisk({
  action,
  req,
  email,
  rateLimitResult = null,
  captchaResult = null,
  env = readEnvironment(),
} = {}) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  const requester = buildRequesterFingerprint(req);
  const emailIdentity = normalizeAuthEmail(email);
  const reasons = [];
  let bucket = 'low';
  let shouldBlock = false;

  if (rateLimitResult?.allowed === false) {
    bucket = 'blocked';
    shouldBlock = true;
    reasons.push('rate_limit_exceeded');
  }

  if (captchaResult?.ok === false) {
    bucket = 'blocked';
    shouldBlock = true;
    reasons.push(captchaResult.code || 'captcha_failed');
  }

  const blockedDomains = normalizeSet(env.AUTH_RISK_BLOCKED_EMAIL_DOMAINS);
  const highRiskDomains = normalizeSet(env.AUTH_RISK_HIGH_EMAIL_DOMAINS);

  if (emailIdentity.ok && blockedDomains.has(emailIdentity.domain)) {
    bucket = 'blocked';
    shouldBlock = true;
    reasons.push('blocked_email_domain');
  } else if (emailIdentity.ok && highRiskDomains.has(emailIdentity.domain) && bucket !== 'blocked') {
    bucket = 'high';
    reasons.push('high_risk_email_domain');
  }

  if (!requester.hasUserAgent && bucket === 'low') {
    bucket = 'medium';
    reasons.push('missing_user_agent');
  }

  if (!emailIdentity.ok && [
    AUTH_SECURITY_ACTIONS.LOGIN,
    AUTH_SECURITY_ACTIONS.REGISTER,
    AUTH_SECURITY_ACTIONS.PASSWORD_RESET,
    AUTH_SECURITY_ACTIONS.ACCOUNT_RECOVERY,
  ].includes(normalizedAction) && bucket === 'low') {
    bucket = 'medium';
    reasons.push(emailIdentity.reason || 'missing_email');
  }

  if (captchaResult?.status?.endsWith('_monitor') && bucket === 'low') {
    bucket = 'medium';
    reasons.push(captchaResult.code || 'captcha_monitor');
  }

  return {
    action: normalizedAction,
    bucket,
    shouldBlock,
    reasons,
    requester: {
      ipHash: requester.ipHash,
      originHash: requester.originHash,
      userAgentHash: requester.userAgentHash,
      hasOrigin: requester.hasOrigin,
      hasUserAgent: requester.hasUserAgent,
    },
    email: {
      ok: emailIdentity.ok,
      reason: emailIdentity.reason,
      emailHash: emailIdentity.emailHash,
      domainHash: emailIdentity.domainHash,
      redacted: emailIdentity.redacted,
    },
  };
}

export function serializeAuthSecurityAudit({
  risk,
  captcha,
  rateLimit,
} = {}) {
  return {
    version: 1,
    risk: {
      bucket: risk?.bucket || 'unknown',
      reasons: Array.isArray(risk?.reasons) ? risk.reasons.slice(0, 8) : [],
      shouldBlock: Boolean(risk?.shouldBlock),
      requester: risk?.requester || {},
      email: risk?.email || {},
    },
    captcha: captcha
      ? {
        provider: captcha.provider,
        mode: captcha.mode,
        required: Boolean(captcha.required),
        monitoring: Boolean(captcha.monitoring),
        status: captcha.status,
        code: captcha.code,
        errorCodes: Array.isArray(captcha.errorCodes) ? captcha.errorCodes.slice(0, 5) : [],
      }
      : null,
    rateLimit: rateLimit
      ? {
        allowed: rateLimit.allowed !== false,
        retryAfter: Number(rateLimit.retryAfter || rateLimit.retry_after || 0),
        source: rateLimit.source || undefined,
      }
      : null,
  };
}

export async function persistAuthSecurityEvent(adminClient, {
  eventType = 'auth_action',
  action,
  outcome,
  risk,
  captcha,
  rateLimit,
  metadata,
} = {}) {
  if (!adminClient || typeof adminClient.from !== 'function') {
    return {
      ok: false,
      reason: 'admin_client_unavailable',
    };
  }

  try {
    const audit = serializeAuthSecurityAudit({ risk, captcha, rateLimit });
    const { error } = await adminClient
      .from('auth_security_events')
      .insert({
        event_type: eventType,
        action: action || risk?.action || 'unknown',
        outcome: outcome || 'unknown',
        risk_bucket: risk?.bucket || 'unknown',
        risk_reasons: Array.isArray(risk?.reasons) ? risk.reasons.slice(0, 8) : [],
        requester_hash: risk?.requester?.ipHash || '',
        requester_origin_hash: risk?.requester?.originHash || null,
        requester_user_agent_hash: risk?.requester?.userAgentHash || null,
        email_hash: risk?.email?.emailHash || null,
        email_domain_hash: risk?.email?.domainHash || null,
        email_redacted: risk?.email?.redacted || null,
        captcha: audit.captcha || {},
        rate_limit: audit.rateLimit || {},
        metadata: sanitizeAuthAuditValue(metadata || {}),
      });

    if (error) {
      throw error;
    }

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || 'audit_persist_failed',
    };
  }
}
