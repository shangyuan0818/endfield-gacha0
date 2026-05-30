import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_APP_URL = 'https://ef-gacha.mogujun.icu';
const STATE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;

function readEnvironment() {
  return globalThis.process?.env || {};
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function hmacSha256(value, secret) {
  return createHmac('sha256', secret).update(String(value || ''), 'utf8').digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getOAuthStateSecret(env = readEnvironment()) {
  return String(
    env.OAUTH_STATE_SECRET
    || env.AUTH_SECURITY_HASH_SECRET
    || env.MAIL_ABUSE_HASH_SECRET
    || env.SUPABASE_JWT_SECRET
    || ''
  ).trim();
}

export function getAppUrl(env = readEnvironment(), req = null) {
  const configured = String(env.APP_URL || env.VITE_APP_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    return configured;
  }

  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  if (host) {
    return `${forwardedProto || 'https'}://${host}`.replace(/\/$/, '');
  }

  return DEFAULT_APP_URL;
}

export function normalizeOAuthReturnTo(value, env = readEnvironment(), req = null) {
  const appUrl = getAppUrl(env, req);
  const raw = String(value || '').trim();
  if (!raw) {
    return '/';
  }

  try {
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      const url = new URL(raw, `${appUrl}/`);
      if (url.pathname.startsWith('/api/')) {
        return '/';
      }
      return `${url.pathname}${url.search}${url.hash}` || '/';
    }

    const parsed = new URL(raw);
    const appOrigin = new URL(appUrl).origin;
    if (parsed.origin !== appOrigin || parsed.pathname.startsWith('/api/')) {
      return '/';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return '/';
  }
}

export function appendOAuthResultParams(returnTo, params = {}, env = readEnvironment(), req = null) {
  const appUrl = getAppUrl(env, req);
  const url = new URL(normalizeOAuthReturnTo(returnTo, env, req), `${appUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue) {
      url.searchParams.set(key, normalizedValue.slice(0, 120));
    }
  });
  return url.toString();
}

export function createOAuthState({
  provider,
  returnTo = '/',
  intent = 'login',
  now = Date.now(),
  ttlMs = STATE_TTL_MS,
} = {}, {
  env = readEnvironment(),
  req = null,
  secret = getOAuthStateSecret(env),
} = {}) {
  if (!secret) {
    throw new Error('oauth_state_secret_missing');
  }

  const payload = {
    provider: String(provider || '').trim().toLowerCase(),
    intent: String(intent || 'login').trim().toLowerCase(),
    returnTo: normalizeOAuthReturnTo(returnTo, env, req),
    nonce: randomBytes(16).toString('base64url'),
    createdAt: Number(now),
    expiresAt: Number(now) + ttlMs,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = hmacSha256(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state, {
  expectedProvider = '',
  env = readEnvironment(),
  secret = getOAuthStateSecret(env),
  now = Date.now(),
} = {}) {
  if (!secret) {
    return { ok: false, code: 'oauth_state_secret_missing' };
  }

  const [encodedPayload, signature, extra] = String(state || '').split('.');
  if (!encodedPayload || !signature || extra) {
    return { ok: false, code: 'oauth_state_malformed' };
  }

  const expectedSignature = hmacSha256(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return { ok: false, code: 'oauth_state_invalid_signature' };
  }

  let payload = null;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return { ok: false, code: 'oauth_state_invalid_payload' };
  }

  if (expectedProvider && payload?.provider !== expectedProvider) {
    return { ok: false, code: 'oauth_state_provider_mismatch' };
  }

  if (!Number.isFinite(Number(payload?.expiresAt)) || Number(payload.expiresAt) <= Number(now)) {
    return { ok: false, code: 'oauth_state_expired' };
  }

  return {
    ok: true,
    payload: {
      ...payload,
      returnTo: normalizeOAuthReturnTo(payload.returnTo, env),
    },
  };
}

export function createSignedOAuthCookie(payload, {
  env = readEnvironment(),
  secret = getOAuthStateSecret(env),
  now = Date.now(),
  ttlMs = PENDING_TTL_MS,
} = {}) {
  if (!secret) {
    throw new Error('oauth_state_secret_missing');
  }

  const safePayload = {
    provider: String(payload?.provider || '').trim().toLowerCase(),
    displayName: String(payload?.displayName || '').trim().slice(0, 80),
    avatarUrl: String(payload?.avatarUrl || '').trim().slice(0, 500),
    subjectHash: String(payload?.subjectHash || '').trim(),
    profileHash: String(payload?.profileHash || '').trim(),
    createdAt: Number(now),
    expiresAt: Number(now) + ttlMs,
  };
  const encodedPayload = toBase64Url(JSON.stringify(safePayload));
  return `${encodedPayload}.${hmacSha256(encodedPayload, secret)}`;
}

export function serializeOAuthPendingCookie(value, {
  secure = true,
  maxAgeSeconds = Math.ceil(PENDING_TTL_MS / 1000),
} = {}) {
  const parts = [
    `ef_oauth_pending=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
