export const PLATFORM_PROVIDERS = new Set(['discord', 'telegram', 'qq']);

export function parseRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

export function normalizeProvider(value) {
  return String(value || '').trim().toLowerCase();
}

export function assertProvider(provider) {
  if (!PLATFORM_PROVIDERS.has(provider)) {
    throw {
      status: 400,
      message: 'Invalid provider',
    };
  }
}

export function sanitizeBinding(binding) {
  if (!binding) {
    return null;
  }

  return {
    id: binding.id || null,
    provider: binding.provider || null,
    display_handle: binding.display_handle || null,
    status: binding.status || null,
    verified_at: binding.verified_at || null,
    revoked_at: binding.revoked_at || null,
    last_verified_at: binding.last_verified_at || null,
    created_at: binding.created_at || null,
    updated_at: binding.updated_at || null,
  };
}

export function sanitizeBotBinding(binding) {
  if (!binding) {
    return null;
  }

  return {
    provider: binding.provider || null,
    display_handle: binding.display_handle || null,
    status: 'verified',
    verified_at: binding.verified_at || null,
  };
}

export function sanitizeChallenge(challenge, {
  includeCode = false,
} = {}) {
  if (!challenge) {
    return null;
  }

  return {
    id: challenge.id || null,
    provider: challenge.provider || null,
    status: challenge.status || null,
    expires_at: challenge.expires_at || null,
    consumed_at: challenge.consumed_at || null,
    created_at: challenge.created_at || null,
    updated_at: challenge.updated_at || null,
    ...(includeCode ? { challenge_code: challenge.challenge_code || null } : {}),
  };
}

export function getErrorMessage(payload, fallback) {
  if (typeof payload?.error === 'string') {
    return payload.error;
  }

  if (payload?.error?.message) {
    return payload.error.message;
  }

  return fallback;
}

export default {
  PLATFORM_PROVIDERS,
  assertProvider,
  getErrorMessage,
  normalizeProvider,
  parseRequestBody,
  sanitizeBinding,
  sanitizeBotBinding,
  sanitizeChallenge,
};
