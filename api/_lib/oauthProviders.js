import { createHash, createHmac } from 'node:crypto';
import { getAppUrl } from './oauthState.js';

export const OAUTH_PROVIDERS = Object.freeze({
  linuxdo: {
    key: 'linuxdo',
    label: 'Linux.do',
    authorizeUrl: 'https://connect.linux.do/oauth2/authorize',
    tokenUrl: 'https://connect.linux.do/oauth2/token',
    userUrl: 'https://connect.linux.do/api/user',
    defaultScope: 'read',
    tokenAuthMethod: 'basic',
  },
  qq: {
    key: 'qq',
    label: 'QQ',
    authorizeUrl: 'https://graph.qq.com/oauth2.0/authorize',
    tokenUrl: 'https://graph.qq.com/oauth2.0/token',
    openIdUrl: 'https://graph.qq.com/oauth2.0/me',
    userUrl: 'https://graph.qq.com/user/get_user_info',
    defaultScope: 'get_user_info',
    tokenAuthMethod: 'query',
  },
  github: {
    key: 'github',
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    emailUrl: 'https://api.github.com/user/emails',
    defaultScope: 'read:user user:email',
    tokenAuthMethod: 'body',
  },
});

const PROVIDER_ALIASES = Object.freeze({
  linux: 'linuxdo',
  'linux.do': 'linuxdo',
});

function readEnvironment() {
  return globalThis.process?.env || {};
}

function parseBoolean(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizeString(value, maxLength = 512) {
  return String(value || '').trim().slice(0, maxLength);
}

function envKey(provider, suffix) {
  return `AUTH_OAUTH_${String(provider || '').toUpperCase()}_${suffix}`;
}

export function normalizeOAuthProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PROVIDER_ALIASES[normalized] || normalized;
}

export function isSupportedOAuthProvider(value) {
  return Boolean(OAUTH_PROVIDERS[normalizeOAuthProvider(value)]);
}

function getProviderEnv(env, provider, suffix, fallback = '') {
  return normalizeString(env[envKey(provider, suffix)] || fallback);
}

export function getOAuthRedirectUri(provider, env = readEnvironment(), req = null) {
  const normalizedProvider = normalizeOAuthProvider(provider);
  const configured = getProviderEnv(env, normalizedProvider, 'REDIRECT_URI');
  if (configured) {
    return configured;
  }
  return `${getAppUrl(env, req)}/api/auth/oauth/${normalizedProvider}/callback`;
}

export function getOAuthProviderConfig(provider, {
  env = readEnvironment(),
  req = null,
} = {}) {
  const normalizedProvider = normalizeOAuthProvider(provider);
  const base = OAUTH_PROVIDERS[normalizedProvider];
  if (!base) {
    return {
      ok: false,
      provider: normalizedProvider,
      code: 'oauth_provider_unsupported',
      reason: 'OAuth provider is not supported.',
    };
  }

  const clientId = getProviderEnv(env, normalizedProvider, 'CLIENT_ID');
  const clientSecret = getProviderEnv(env, normalizedProvider, 'CLIENT_SECRET');
  const enabledDefault = Boolean(clientId && (clientSecret || normalizedProvider === 'github'));
  const enabled = parseBoolean(env[envKey(normalizedProvider, 'ENABLED')], enabledDefault);
  const bridgeEnabled = normalizedProvider === 'github'
    ? parseBoolean(env.AUTH_OAUTH_GITHUB_BRIDGE_ENABLED, enabled)
    : enabled;

  if (!bridgeEnabled) {
    return {
      ok: false,
      provider: normalizedProvider,
      label: base.label,
      code: 'oauth_provider_disabled',
      reason: 'OAuth provider is disabled.',
    };
  }

  if (!clientId) {
    return {
      ok: false,
      provider: normalizedProvider,
      label: base.label,
      code: 'oauth_client_id_missing',
      reason: 'OAuth client id is missing.',
    };
  }

  if (!clientSecret) {
    return {
      ok: false,
      provider: normalizedProvider,
      label: base.label,
      code: 'oauth_client_secret_missing',
      reason: 'OAuth client secret is missing.',
    };
  }

  return {
    ok: true,
    provider: normalizedProvider,
    label: base.label,
    clientId,
    clientSecret,
    authorizeUrl: getProviderEnv(env, normalizedProvider, 'AUTHORIZE_URL', base.authorizeUrl),
    tokenUrl: getProviderEnv(env, normalizedProvider, 'TOKEN_URL', base.tokenUrl),
    openIdUrl: getProviderEnv(env, normalizedProvider, 'OPENID_URL', base.openIdUrl || ''),
    userUrl: getProviderEnv(env, normalizedProvider, 'USER_URL', base.userUrl),
    emailUrl: getProviderEnv(env, normalizedProvider, 'EMAIL_URL', base.emailUrl || ''),
    redirectUri: getOAuthRedirectUri(normalizedProvider, env, req),
    scope: getProviderEnv(env, normalizedProvider, 'SCOPE', base.defaultScope),
    tokenAuthMethod: getProviderEnv(env, normalizedProvider, 'TOKEN_AUTH_METHOD', base.tokenAuthMethod),
  };
}

export function buildOAuthAuthorizationUrl(config, state) {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  if (config.scope) {
    url.searchParams.set('scope', config.scope);
  }
  return url.toString();
}

async function parseOAuthResponse(response) {
  const text = await response.text();
  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
  if (contentType.includes('json')) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    const jsonpMatch = text.match(/^[^{]*(\{[\s\S]*\})[^}]*$/u);
    if (jsonpMatch) {
      try {
        return JSON.parse(jsonpMatch[1]);
      } catch {
        return {};
      }
    }
    return Object.fromEntries(new URLSearchParams(text));
  }
}

function buildTokenHeaders(config) {
  const headers = {
    Accept: 'application/json',
  };

  if (config.tokenAuthMethod === 'basic') {
    const credential = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${credential}`;
  }

  return headers;
}

export async function exchangeOAuthCode(config, code, {
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedCode = normalizeString(code, 2048);
  if (!normalizedCode) {
    return { ok: false, code: 'oauth_code_missing', reason: 'OAuth authorization code is missing.' };
  }

  if (typeof fetchImpl !== 'function') {
    return { ok: false, code: 'fetch_unavailable', reason: 'Server fetch is unavailable.' };
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: normalizedCode,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
  });

  if (config.tokenAuthMethod !== 'basic') {
    params.set('client_secret', config.clientSecret);
  }

  const method = config.tokenAuthMethod === 'query' ? 'GET' : 'POST';
  const url = new URL(config.tokenUrl);
  let body = null;
  const headers = buildTokenHeaders(config);

  if (method === 'GET') {
    params.forEach((value, key) => url.searchParams.set(key, value));
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = params.toString();
  }

  const response = await fetchImpl(url.toString(), {
    method,
    headers,
    body,
  });
  const payload = await parseOAuthResponse(response);
  if (!response.ok || payload?.error) {
    return {
      ok: false,
      code: payload?.error || `oauth_token_http_${response.status}`,
      reason: payload?.error_description || payload?.message || 'OAuth token exchange failed.',
      status: response.status,
    };
  }

  const accessToken = normalizeString(payload.access_token || payload.accessToken, 4096);
  if (!accessToken) {
    return { ok: false, code: 'oauth_access_token_missing', reason: 'OAuth provider returned no access token.' };
  }

  return {
    ok: true,
    accessToken,
    tokenType: normalizeString(payload.token_type || payload.tokenType || 'Bearer', 32),
    scope: normalizeString(payload.scope || ''),
    expiresIn: Number.isFinite(Number(payload.expires_in)) ? Number(payload.expires_in) : null,
  };
}

async function fetchJson(url, {
  fetchImpl = globalThis.fetch,
  headers = {},
} = {}) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });
  const payload = await parseOAuthResponse(response);
  if (!response.ok || payload?.error) {
    return {
      ok: false,
      code: payload?.error || `oauth_profile_http_${response.status}`,
      reason: payload?.error_description || payload?.message || 'OAuth profile request failed.',
      status: response.status,
    };
  }
  return { ok: true, payload };
}

function normalizeAvatarTemplate(value) {
  const raw = normalizeString(value, 500);
  if (!raw) return '';
  if (raw.includes('{size}')) {
    return raw.replace('{size}', '128');
  }
  return raw;
}

async function fetchQqProfile(config, tokenResult, options) {
  const openIdUrl = new URL(config.openIdUrl);
  openIdUrl.searchParams.set('access_token', tokenResult.accessToken);
  const openIdResult = await fetchJson(openIdUrl.toString(), options);
  if (!openIdResult.ok) {
    return openIdResult;
  }

  const openId = normalizeString(openIdResult.payload?.openid, 256);
  if (!openId) {
    return { ok: false, code: 'oauth_profile_subject_missing', reason: 'QQ returned no openid.' };
  }

  const userUrl = new URL(config.userUrl);
  userUrl.searchParams.set('access_token', tokenResult.accessToken);
  userUrl.searchParams.set('oauth_consumer_key', config.clientId);
  userUrl.searchParams.set('openid', openId);
  const profileResult = await fetchJson(userUrl.toString(), options);
  if (!profileResult.ok) {
    return profileResult;
  }

  return {
    ok: true,
    profile: {
      provider: 'qq',
      subject: openId,
      username: normalizeString(profileResult.payload?.nickname || ''),
      displayName: normalizeString(profileResult.payload?.nickname || ''),
      avatarUrl: normalizeString(profileResult.payload?.figureurl_qq_2 || profileResult.payload?.figureurl_qq_1 || profileResult.payload?.figureurl || ''),
      email: '',
      metadata: {
        gender: normalizeString(profileResult.payload?.gender || '', 32),
      },
    },
  };
}

async function fetchGithubProfile(config, tokenResult, options) {
  const profileResult = await fetchJson(config.userUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      'User-Agent': 'endfield-gacha-oauth',
    },
  });
  if (!profileResult.ok) {
    return profileResult;
  }

  let email = normalizeString(profileResult.payload?.email || '', 320);
  let emailVerified = Boolean(email);
  if (!email && config.emailUrl && String(config.scope || '').includes('user:email')) {
    const emailResult = await fetchJson(config.emailUrl, {
      ...options,
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'User-Agent': 'endfield-gacha-oauth',
      },
    });
    if (emailResult.ok && Array.isArray(emailResult.payload)) {
      const primary = emailResult.payload.find((item) => item?.primary && item?.verified) || emailResult.payload.find((item) => item?.verified);
      email = normalizeString(primary?.email || '', 320);
      emailVerified = Boolean(primary?.verified && email);
    }
  }

  return {
    ok: true,
    profile: {
      provider: 'github',
      subject: normalizeString(profileResult.payload?.id, 128),
      username: normalizeString(profileResult.payload?.login || ''),
      displayName: normalizeString(profileResult.payload?.name || profileResult.payload?.login || ''),
      avatarUrl: normalizeString(profileResult.payload?.avatar_url || ''),
      email,
      emailVerified,
      metadata: {
        profileUrl: normalizeString(profileResult.payload?.html_url || '', 500),
      },
    },
  };
}

async function fetchLinuxDoProfile(config, tokenResult, options) {
  const profileResult = await fetchJson(config.userUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
    },
  });
  if (!profileResult.ok) {
    return profileResult;
  }

  const payload = profileResult.payload;
  return {
    ok: true,
    profile: {
      provider: 'linuxdo',
      subject: normalizeString(payload?.id, 128),
      username: normalizeString(payload?.username || payload?.login || ''),
      displayName: normalizeString(payload?.name || payload?.username || payload?.login || ''),
      avatarUrl: normalizeAvatarTemplate(payload?.avatar_template || payload?.avatar_url || ''),
      email: normalizeString(payload?.email || '', 320),
      metadata: {
        active: payload?.active === true,
        trustLevel: Number.isFinite(Number(payload?.trust_level)) ? Number(payload.trust_level) : null,
      },
    },
  };
}

export async function fetchOAuthProfile(config, tokenResult, options = {}) {
  if (config.provider === 'qq') {
    return fetchQqProfile(config, tokenResult, options);
  }
  if (config.provider === 'github') {
    return fetchGithubProfile(config, tokenResult, options);
  }
  return fetchLinuxDoProfile(config, tokenResult, options);
}

export function sanitizeOAuthProfile(profile) {
  return {
    provider: normalizeOAuthProvider(profile?.provider),
    subject: normalizeString(profile?.subject, 256),
    username: normalizeString(profile?.username, 80),
    displayName: normalizeString(profile?.displayName || profile?.username, 80),
    avatarUrl: normalizeString(profile?.avatarUrl, 500),
    email: normalizeString(profile?.email, 320),
    emailVerified: profile?.emailVerified === true,
    metadata: profile?.metadata && typeof profile.metadata === 'object'
      ? profile.metadata
      : {},
  };
}

export function hashOAuthSubject(provider, subject, secret) {
  return createHmac('sha256', String(secret || ''))
    .update(`${normalizeOAuthProvider(provider)}:${String(subject || '').trim()}`, 'utf8')
    .digest('hex');
}

export function hashOAuthProfile(profile) {
  return createHash('sha256')
    .update(JSON.stringify({
      provider: profile?.provider || '',
      username: profile?.username || '',
      displayName: profile?.displayName || '',
      avatarUrl: profile?.avatarUrl || '',
      emailPresent: Boolean(profile?.email),
    }), 'utf8')
    .digest('hex');
}
