import { createHmac, randomBytes } from 'node:crypto';
import { resolveSupabaseUrl } from './supabaseEnv.js';

const DEFAULT_SESSION_COOKIE = '__Host-eg_session';
const DEFAULT_REFRESH_COOKIE = '__Host-eg_refresh';
const LOCAL_SESSION_COOKIE = 'eg_session';
const LOCAL_REFRESH_COOKIE = 'eg_refresh';
const DEFAULT_SESSION_TTL_SECONDS = 2 * 60 * 60;
const DEFAULT_IDLE_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_COMPAT_JWT_TTL_SECONDS = 60 * 60;
const SYNTHETIC_EMAIL_DOMAIN = 'oauth.local.invalid';
const PROFILE_FIELDS = 'id, username, email, role, created_at, updated_at, last_seen_at';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function normalizeString(value, maxLength = 512) {
  return String(value || '').trim().slice(0, maxLength);
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function hmacHex(value, secret) {
  return createHmac('sha256', secret).update(String(value || ''), 'utf8').digest('hex');
}

function hmacBase64Url(value, secret) {
  return createHmac('sha256', secret).update(String(value || ''), 'utf8').digest('base64url');
}

export function getSiteSessionSecret(env = readEnvironment()) {
  return normalizeString(
    env.APP_SESSION_SECRET
    || env.OAUTH_STATE_SECRET
    || env.AUTH_SECURITY_HASH_SECRET
    || env.SUPABASE_JWT_SECRET
    || '',
    4096
  );
}

export function getSiteSessionConfig(env = readEnvironment(), {
  secure = true,
} = {}) {
  const defaultSessionCookie = secure ? DEFAULT_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
  const defaultRefreshCookie = secure ? DEFAULT_REFRESH_COOKIE : LOCAL_REFRESH_COOKIE;
  return {
    secret: getSiteSessionSecret(env),
    sessionCookieName: normalizeString(env.APP_SESSION_COOKIE_NAME || defaultSessionCookie, 80),
    refreshCookieName: normalizeString(env.APP_REFRESH_COOKIE_NAME || defaultRefreshCookie, 80),
    sessionTtlSeconds: parseInteger(env.APP_SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS),
    idleTtlSeconds: parseInteger(env.APP_SESSION_IDLE_TTL_SECONDS, DEFAULT_IDLE_TTL_SECONDS),
    absoluteTtlSeconds: parseInteger(env.APP_SESSION_ABSOLUTE_TTL_SECONDS, DEFAULT_ABSOLUTE_TTL_SECONDS),
    compatJwtTtlSeconds: parseInteger(env.APP_SESSION_COMPAT_JWT_TTL_SECONDS, DEFAULT_COMPAT_JWT_TTL_SECONDS),
  };
}

export function isSecureRequest(req, env = readEnvironment()) {
  const appUrl = normalizeString(env.APP_URL || env.VITE_APP_URL || '');
  if (appUrl.startsWith('https://')) {
    return true;
  }
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

export function parseCookieHeader(headerValue) {
  const cookies = {};
  String(headerValue || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }
      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    });
  return cookies;
}

export function serializeCookie(name, value, {
  maxAgeSeconds,
  path = '/',
  httpOnly = true,
  secure = true,
  sameSite = 'Lax',
} = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value || '')}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];
  if (Number.isFinite(Number(maxAgeSeconds))) {
    parts.push(`Max-Age=${Math.max(0, Number(maxAgeSeconds))}`);
  }
  if (httpOnly) {
    parts.push('HttpOnly');
  }
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function appendSetCookieHeader(res, cookieValue) {
  const current = res.getHeader?.('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  const next = Array.isArray(current) ? [...current, cookieValue] : [String(current), cookieValue];
  res.setHeader('Set-Cookie', next);
}

export function clearSiteSessionCookies(res, req, env = readEnvironment()) {
  const secure = isSecureRequest(req, env);
  const config = getSiteSessionConfig(env, { secure });
  appendSetCookieHeader(res, serializeCookie(config.sessionCookieName, '', {
    maxAgeSeconds: 0,
    secure,
  }));
  appendSetCookieHeader(res, serializeCookie(config.refreshCookieName, '', {
    maxAgeSeconds: 0,
    secure,
    path: '/api/auth/session',
  }));
}

function createRandomToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(token, secret, purpose = 'session') {
  return hmacHex(`${purpose}:${token}`, secret);
}

function getRequesterIp(req) {
  const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || String(req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || '').trim();
}

function getIpPrefix(ip) {
  const normalized = normalizeString(ip, 128);
  if (!normalized) {
    return '';
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    return normalized.split('.').slice(0, 3).join('.');
  }
  if (normalized.includes(':')) {
    return normalized.split(':').slice(0, 4).join(':');
  }
  return normalized.slice(0, 32);
}

function buildRequesterHash(req, secret) {
  const parts = [
    getIpPrefix(getRequesterIp(req)),
    normalizeString(req?.headers?.origin || '', 200),
  ].join('|');
  return hmacHex(`requester:${parts}`, secret);
}

function buildUserAgentHash(req, secret) {
  const userAgent = normalizeString(req?.headers?.['user-agent'] || '', 500);
  return userAgent ? hmacHex(`ua:${userAgent}`, secret) : null;
}

function buildIpPrefixHash(req, secret) {
  const prefix = getIpPrefix(getRequesterIp(req));
  return prefix ? hmacHex(`ip:${prefix}`, secret) : null;
}

function normalizeUsername(value, fallback) {
  const candidate = normalizeString(value || fallback || '', 80)
    .replace(/[^\dA-Za-z_\-+.\u3040-\u30ff\u3400-\u9fff]/g, '')
    .trim();
  if (candidate.length >= 2) {
    return candidate.slice(0, 50);
  }
  return normalizeString(fallback || 'oauth_user', 50) || 'oauth_user';
}

export function buildSyntheticOAuthEmail(provider, subjectHash) {
  const providerPart = normalizeString(provider, 20).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'oauth';
  const subjectPart = normalizeString(subjectHash, 64).replace(/[^a-f0-9]/gi, '').slice(0, 32) || randomBytes(8).toString('hex');
  return `${providerPart}.${subjectPart}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function isSyntheticEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

function buildPublicUser({
  userId,
  profile = null,
  authUser = null,
  provider = '',
  emailVerified = false,
}) {
  const email = isSyntheticEmail(profile?.email || authUser?.email) ? null : (profile?.email || authUser?.email || null);
  const username = profile?.username || authUser?.user_metadata?.username || authUser?.raw_user_meta_data?.username || 'oauth_user';
  const verifiedAt = email && emailVerified
    ? authUser?.email_confirmed_at || authUser?.confirmed_at || profile?.updated_at || profile?.created_at || null
    : null;
  return {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: verifiedAt,
    confirmed_at: verifiedAt,
    app_metadata: {
      provider: provider || 'site_session',
      providers: [provider || 'site_session'],
    },
    user_metadata: {
      username,
      display_name: username,
      site_session: true,
      email_verified: Boolean(email && emailVerified),
    },
    created_at: profile?.created_at || authUser?.created_at || null,
    updated_at: profile?.updated_at || authUser?.updated_at || null,
    site_session: true,
    profile_role: profile?.role || 'user',
  };
}

async function loadProfile(adminClient, userId) {
  const { data, error } = await adminClient
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

async function loadSessionByTokenHash(adminClient, tokenHash) {
  if (!tokenHash) {
    return null;
  }

  const now = new Date();
  const { data: sessionRow, error } = await adminClient
    .from('app_sessions')
    .select('*')
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now.toISOString())
    .gt('absolute_expires_at', now.toISOString())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return sessionRow || null;
}

async function loadSessionByRefreshTokenHash(adminClient, refreshTokenHash) {
  if (!refreshTokenHash) {
    return null;
  }

  const now = new Date();
  const { data: sessionRow, error } = await adminClient
    .from('app_sessions')
    .select('*')
    .eq('refresh_token_hash', refreshTokenHash)
    .is('revoked_at', null)
    .gt('absolute_expires_at', now.toISOString())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return sessionRow || null;
}

async function rotateSessionTokens(adminClient, {
  sessionRow,
  req,
  res,
  env,
  config,
  reason = 'session_refresh',
}) {
  const now = new Date();
  const secure = isSecureRequest(req, env);
  const expiresAtMs = now.getTime() + config.idleTtlSeconds * 1000;
  const absoluteExpiresAtMs = new Date(sessionRow.absolute_expires_at).getTime();
  const expiresAt = new Date(Math.min(expiresAtMs, absoluteExpiresAtMs));

  const updatePayload = {
    last_seen_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    absolute_expires_at: new Date(absoluteExpiresAtMs).toISOString(),
  };

  let sessionToken = null;
  let refreshToken = null;
  if (res) {
    sessionToken = createRandomToken();
    refreshToken = createRandomToken();
    updatePayload.session_token_hash = hashToken(sessionToken, config.secret, 'session');
    updatePayload.refresh_token_hash = hashToken(refreshToken, config.secret, 'refresh');
  }

  const { error } = await adminClient
    .from('app_sessions')
    .update(updatePayload)
    .eq('id', sessionRow.id)
    .is('revoked_at', null);

  if (error) {
    throw error;
  }

  if (res && sessionToken && refreshToken) {
    appendSetCookieHeader(res, serializeCookie(config.sessionCookieName, sessionToken, {
      maxAgeSeconds: config.absoluteTtlSeconds,
      secure,
    }));
    appendSetCookieHeader(res, serializeCookie(config.refreshCookieName, refreshToken, {
      maxAgeSeconds: config.absoluteTtlSeconds,
      secure,
      path: '/api/auth/session',
    }));
  }

  await persistAuthAudit(adminClient, {
    userId: sessionRow.user_id,
    provider: 'site_session',
    eventType: 'site_session_refreshed',
    outcome: 'success',
    req,
    secret: config.secret,
    metadata: {
      reason,
    },
  });

  return {
    ...sessionRow,
    expires_at: expiresAt.toISOString(),
    last_seen_at: now.toISOString(),
  };
}

async function upsertOAuthProfile(adminClient, {
  userId,
  profile,
}) {
  const username = normalizeUsername(
    profile?.displayName || profile?.username,
    `${profile?.provider || 'oauth'}_${String(userId || '').replace(/-/g, '').slice(0, 8)}`
  );
  const email = profile?.emailVerified === true
    ? normalizeString(profile?.email, 320).toLowerCase() || null
    : null;
  const { data, error } = await adminClient
    .from('profiles')
    .upsert({
      id: userId,
      username,
      email,
      role: 'user',
    }, {
      onConflict: 'id',
    })
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    throw error;
  }
  return data || null;
}

function toClientSiteIdentity(row) {
  if (!row?.provider) {
    return null;
  }
  const displayName = normalizeString(row.display_name, 120);
  return {
    id: row.id,
    provider: row.provider,
    source: 'site_session',
    created_at: row.linked_at || null,
    updated_at: row.last_used_at || row.linked_at || null,
    last_sign_in_at: row.last_used_at || null,
    disabled_at: row.disabled_at || null,
    identity_data: {
      provider: row.provider,
      name: displayName,
      username: displayName,
      full_name: displayName,
      avatar_url: normalizeString(row.avatar_url, 500),
      email_verified: row.email_verified === true,
      site_session: true,
    },
  };
}

export async function loadSiteAuthIdentities(adminClient, {
  userId,
  includeDisabled = false,
} = {}) {
  if (!adminClient?.from || !userId) {
    return [];
  }

  let query = adminClient
    .from('app_auth_identities')
    .select('id, provider, display_name, avatar_url, email_verified, linked_at, last_used_at, disabled_at')
    .eq('user_id', userId);

  if (!includeDisabled) {
    query = query.is('disabled_at', null);
  }

  const { data, error } = await query.order('linked_at', { ascending: true });
  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map(toClientSiteIdentity)
    .filter(Boolean);
}

async function persistAuthAudit(adminClient, {
  userId = null,
  provider = '',
  eventType = 'site_auth',
  outcome = 'unknown',
  req = null,
  metadata = {},
  secret,
}) {
  try {
    await adminClient
      .from('app_auth_audit_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        provider: provider || null,
        outcome,
        requester_hash: secret && req ? buildRequesterHash(req, secret) : null,
        metadata,
      });
  } catch {
    // Audit failure must not block sign-in.
  }
}

async function createOAuthAuthUser(adminClient, {
  profile,
  subjectHash,
}) {
  const provider = normalizeString(profile?.provider, 40) || 'oauth';
  const username = normalizeUsername(profile?.displayName || profile?.username, `${provider}_${subjectHash.slice(0, 8)}`);
  const syntheticEmail = buildSyntheticOAuthEmail(provider, subjectHash);
  const createUser = adminClient?.auth?.admin?.createUser;
  if (typeof createUser !== 'function') {
    throw new Error('auth_create_user_unavailable');
  }

  const { data, error } = await createUser.call(adminClient.auth.admin, {
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: profile?.displayName || username,
      avatar_url: profile?.avatarUrl || '',
      auth_provider: provider,
      synthetic_oauth_email: true,
    },
  });

  if (error) {
    error.code = error.code || 'auth_create_user_failed';
    throw error;
  }

  const user = data?.user || data || null;
  if (!user?.id) {
    throw new Error('auth_create_user_empty');
  }
  return user;
}

function sanitizeIdentityMetadata(profile) {
  const metadata = profile?.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
  return {
    usernamePresent: Boolean(profile?.username),
    emailPresent: Boolean(profile?.email),
    avatarPresent: Boolean(profile?.avatarUrl),
    active: metadata.active === true ? true : metadata.active === false ? false : null,
    trustLevel: Number.isFinite(Number(metadata.trustLevel)) ? Number(metadata.trustLevel) : null,
    profileUrlPresent: Boolean(metadata.profileUrl),
  };
}

async function upsertOAuthIdentity(adminClient, {
  userId,
  profile,
  subjectHash,
  profileHash,
  secret,
}) {
  const email = normalizeString(profile?.email, 320).toLowerCase();
  const { data, error } = await adminClient
    .from('app_auth_identities')
    .upsert({
      user_id: userId,
      provider: profile.provider,
      provider_subject_hash: subjectHash,
      display_name: normalizeString(profile.displayName || profile.username, 120) || null,
      avatar_url: normalizeString(profile.avatarUrl, 500) || null,
      email_hash: email ? hmacHex(`email:${email}`, secret) : null,
      email_verified: profile.emailVerified === true,
      raw_profile_hash: profileHash || null,
      last_used_at: new Date().toISOString(),
      metadata_redacted_json: sanitizeIdentityMetadata(profile),
    }, {
      onConflict: 'provider,provider_subject_hash',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data || null;
}

async function resolveOAuthIdentity(adminClient, {
  provider,
  subjectHash,
}) {
  const { data, error } = await adminClient
    .from('app_auth_identities')
    .select('*')
    .eq('provider', provider)
    .eq('provider_subject_hash', subjectHash)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

export async function createSiteSession(adminClient, {
  userId,
  req,
  res,
  env = readEnvironment(),
  provider = 'site_session',
} = {}) {
  const secure = isSecureRequest(req, env);
  const config = getSiteSessionConfig(env, { secure });
  if (!config.secret) {
    return { ok: false, code: 'site_session_secret_missing' };
  }
  if (!adminClient?.from || !userId) {
    return { ok: false, code: 'site_session_admin_unavailable' };
  }

  const now = new Date();
  const sessionToken = createRandomToken();
  const refreshToken = createRandomToken();
  const expiresAtMs = now.getTime() + config.idleTtlSeconds * 1000;
  const absoluteExpiresAtMs = now.getTime() + config.absoluteTtlSeconds * 1000;
  const expiresAt = new Date(Math.min(expiresAtMs, absoluteExpiresAtMs));
  const absoluteExpiresAt = new Date(absoluteExpiresAtMs);
  const { data, error } = await adminClient
    .from('app_sessions')
    .insert({
      user_id: userId,
      session_token_hash: hashToken(sessionToken, config.secret, 'session'),
      refresh_token_hash: hashToken(refreshToken, config.secret, 'refresh'),
      user_agent_hash: buildUserAgentHash(req, config.secret),
      ip_prefix_hash: buildIpPrefixHash(req, config.secret),
      last_seen_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      absolute_expires_at: absoluteExpiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    return { ok: false, code: error.code || 'site_session_insert_failed', reason: error.message };
  }

  appendSetCookieHeader(res, serializeCookie(config.sessionCookieName, sessionToken, {
    maxAgeSeconds: config.absoluteTtlSeconds,
    secure,
  }));
  appendSetCookieHeader(res, serializeCookie(config.refreshCookieName, refreshToken, {
    maxAgeSeconds: config.absoluteTtlSeconds,
    secure,
    path: '/api/auth/session',
  }));

  await persistAuthAudit(adminClient, {
    userId,
    provider,
    eventType: 'site_session_created',
    outcome: 'success',
    req,
    secret: config.secret,
  });

  return {
    ok: true,
    session: data,
    expiresAt: expiresAt.toISOString(),
    absoluteExpiresAt: absoluteExpiresAt.toISOString(),
  };
}

export async function loadSiteSession(adminClient, {
  req,
  res = null,
  env = readEnvironment(),
  touch = true,
} = {}) {
  const secure = isSecureRequest(req, env);
  const config = getSiteSessionConfig(env, { secure });
  if (!config.secret || !adminClient?.from) {
    return { ok: false, authenticated: false, code: 'site_session_unavailable' };
  }

  const cookies = parseCookieHeader(req?.headers?.cookie || '');
  const token = cookies[config.sessionCookieName];
  const refreshToken = cookies[config.refreshCookieName];

  let sessionRow = null;
  let lookupError = null;
  if (token) {
    try {
      sessionRow = await loadSessionByTokenHash(adminClient, hashToken(token, config.secret, 'session'));
    } catch (error) {
      lookupError = error;
    }
  }

  if (!sessionRow && refreshToken) {
    try {
      const refreshRow = await loadSessionByRefreshTokenHash(adminClient, hashToken(refreshToken, config.secret, 'refresh'));
      if (refreshRow?.id) {
        sessionRow = refreshRow;
        await rotateSessionTokens(adminClient, {
          sessionRow: refreshRow,
          req,
          res,
          env,
          config,
          reason: 'session_refresh',
        });
      }
    } catch (error) {
      lookupError = lookupError || error;
    }
  }

  if (lookupError) {
    return { ok: false, authenticated: false, code: lookupError.code || 'site_session_lookup_failed', reason: lookupError.message };
  }
  if (!sessionRow?.user_id) {
    return { ok: true, authenticated: false, code: 'site_session_missing' };
  }

  const now = new Date();
  const profile = await loadProfile(adminClient, sessionRow.user_id);
  const identities = await loadSiteAuthIdentities(adminClient, {
    userId: sessionRow.user_id,
  });
  const hasVerifiedProviderEmail = identities.some((identity) => (
    identity?.identity_data?.email_verified === true
  ));
  const absoluteExpiresAt = new Date(sessionRow.absolute_expires_at).getTime();
  const nextExpiresAt = new Date(Math.min(now.getTime() + config.idleTtlSeconds * 1000, absoluteExpiresAt));
  if (touch) {
    await adminClient
      .from('app_sessions')
      .update({
        last_seen_at: now.toISOString(),
        expires_at: nextExpiresAt.toISOString(),
      })
      .eq('id', sessionRow.id);

    await adminClient
      .from('profiles')
      .update({ last_seen_at: now.toISOString() })
      .eq('id', sessionRow.user_id);
  }

  return {
    ok: true,
    authenticated: true,
    session: {
      ...sessionRow,
      expires_at: nextExpiresAt.toISOString(),
    },
    profile,
    identities,
    user: buildPublicUser({
      userId: sessionRow.user_id,
      profile,
      provider: 'site_session',
      emailVerified: hasVerifiedProviderEmail,
    }),
    config,
  };
}

export async function revokeSiteSession(adminClient, {
  req,
  res,
  env = readEnvironment(),
  reason = 'user_logout',
} = {}) {
  const secure = isSecureRequest(req, env);
  const config = getSiteSessionConfig(env, { secure });
  const cookies = parseCookieHeader(req?.headers?.cookie || '');
  const token = cookies[config.sessionCookieName];
  if (token && config.secret && adminClient?.from) {
    await adminClient
      .from('app_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq('session_token_hash', hashToken(token, config.secret, 'session'))
      .is('revoked_at', null);
  }

  if (res) {
    clearSiteSessionCookies(res, req, env);
  }

  return { ok: true };
}

export function createSupabaseCompatAccessToken({
  user,
  profile = null,
  sessionId = '',
  env = readEnvironment(),
  ttlSeconds,
} = {}) {
  if (!parseBoolean(env.APP_SESSION_COMPAT_JWT_ENABLED, true)) {
    return null;
  }

  const jwtSecret = normalizeString(env.SUPABASE_JWT_SECRET || '', 4096);
  if (!jwtSecret || !user?.id) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresIn = parseInteger(ttlSeconds, getSiteSessionConfig(env).compatJwtTtlSeconds);
  const email = isSyntheticEmail(user.email) ? '' : normalizeString(user.email, 320).toLowerCase();
  const supabaseUrl = resolveSupabaseUrl(env).replace(/\/$/, '');
  const payload = {
    iss: `${supabaseUrl || 'https://ef-gacha.mogujun.icu'}/auth/v1`,
    sub: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    phone: '',
    app_metadata: {
      provider: 'site_session',
      providers: ['site_session'],
    },
    user_metadata: {
      username: profile?.username || user?.user_metadata?.username || '',
      site_session: true,
    },
    aal: 'aal1',
    session_id: sessionId || '',
    iat: nowSeconds,
    exp: nowSeconds + expiresIn,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const unsigned = `${toBase64UrlJson(header)}.${toBase64UrlJson(payload)}`;
  return {
    accessToken: `${unsigned}.${hmacBase64Url(unsigned, jwtSecret)}`,
    expiresIn,
    expiresAt: nowSeconds + expiresIn,
  };
}

export async function createOrLinkOAuthUserAndSession(adminClient, {
  profile,
  subjectHash,
  profileHash,
  req,
  res,
  env = readEnvironment(),
  secret = getSiteSessionSecret(env),
} = {}) {
  if (!adminClient?.from) {
    return { ok: false, code: 'admin_client_unavailable' };
  }
  if (!secret) {
    return { ok: false, code: 'site_session_secret_missing' };
  }
  if (!profile?.provider || !subjectHash) {
    return { ok: false, code: 'oauth_identity_invalid' };
  }

  let identity = await resolveOAuthIdentity(adminClient, {
    provider: profile.provider,
    subjectHash,
  });
  let authUser = null;
  let created = false;

  if (identity?.disabled_at) {
    await persistAuthAudit(adminClient, {
      userId: identity.user_id,
      provider: profile.provider,
      eventType: 'oauth_callback',
      outcome: 'identity_disabled',
      req,
      secret,
    });
    return { ok: false, code: 'oauth_identity_disabled' };
  }

  if (!identity?.user_id) {
    authUser = await createOAuthAuthUser(adminClient, {
      profile,
      subjectHash,
    });
    created = true;
    identity = await upsertOAuthIdentity(adminClient, {
      userId: authUser.id,
      profile,
      subjectHash,
      profileHash,
      secret,
    });
  } else {
    identity = await upsertOAuthIdentity(adminClient, {
      userId: identity.user_id,
      profile,
      subjectHash,
      profileHash,
      secret,
    });
  }

  const userId = identity?.user_id || authUser?.id;
  const profileRow = created
    ? await upsertOAuthProfile(adminClient, { userId, profile })
    : await loadProfile(adminClient, userId);

  const sessionResult = await createSiteSession(adminClient, {
    userId,
    req,
    res,
    env,
    provider: profile.provider,
  });

  if (!sessionResult.ok) {
    await persistAuthAudit(adminClient, {
      userId,
      provider: profile.provider,
      eventType: 'oauth_callback',
      outcome: sessionResult.code || 'site_session_failed',
      req,
      secret,
    });
    return sessionResult;
  }

  await persistAuthAudit(adminClient, {
    userId,
    provider: profile.provider,
    eventType: 'oauth_callback',
    outcome: created ? 'created_and_signed_in' : 'signed_in',
    req,
    secret,
    metadata: {
      identityId: identity?.id || null,
      created,
    },
  });

  return {
    ok: true,
    user: buildPublicUser({
      userId,
      profile: profileRow,
      authUser,
      provider: profile.provider,
      emailVerified: identity?.email_verified === true,
    }),
    profile: profileRow,
    session: sessionResult.session,
    created,
  };
}

export default {
  appendSetCookieHeader,
  buildSyntheticOAuthEmail,
  clearSiteSessionCookies,
  createOrLinkOAuthUserAndSession,
  createSiteSession,
  createSupabaseCompatAccessToken,
  getSiteSessionConfig,
  getSiteSessionSecret,
  isSecureRequest,
  loadSiteAuthIdentities,
  loadSiteSession,
  parseCookieHeader,
  revokeSiteSession,
  serializeCookie,
};
