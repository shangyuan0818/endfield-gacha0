import { supabase } from '../supabaseClient';
import { fetchJsonWithTimeout } from './supabaseRequest.js';

export class AuthRateLimitError extends Error {
  constructor(retryAfter = 60) {
    super('Auth action rate limited');
    this.name = 'AuthRateLimitError';
    this.code = 'auth_rate_limited';
    this.retryAfter = Number(retryAfter || 60);
  }
}

export async function checkAuthActionRateLimit(action) {
  const { response, data: payload } = await fetchJsonWithTimeout('/api/auth-rate-limit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  }, {
    label: `auth-rate-limit:${action}`,
    timeoutMs: 15000,
    retries: 1,
  });

  if (!response.ok && payload?.allowed !== false) {
    throw new Error(payload?.error || 'Failed to check auth rate limit');
  }

  if (payload?.allowed === false) {
    throw new AuthRateLimitError(payload.retry_after);
  }

  return payload || { allowed: true };
}

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

const EMPTY_ACCOUNT_SECURITY_STATE = Object.freeze({
  passwordChangeRequired: false,
  reason: null,
  source: null,
  requestedAt: null,
  expiresAt: null,
  recoveryRequestId: null,
  emailVerificationRequired: false,
  emailVerificationReason: null,
  emailVerificationRequestedAt: null,
  emailVerificationVerifiedAt: null,
});

export async function loadAccountSecurityState() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return EMPTY_ACCOUNT_SECURITY_STATE;
  }

  const { response, data: payload } = await fetchJsonWithTimeout('/api/account-security-state', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }, {
    label: 'account-security-state',
    timeoutMs: 20000,
    retries: 1,
  });

  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || 'Failed to load account security state');
  }

  return payload.state || EMPTY_ACCOUNT_SECURITY_STATE;
}

export async function clearPasswordChangeRequired() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return EMPTY_ACCOUNT_SECURITY_STATE;
  }

  const { response, data: payload } = await fetchJsonWithTimeout('/api/account-security-state', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'clear_password_change_required',
    }),
  }, {
    label: 'account-security-state:clear',
    timeoutMs: 20000,
    retries: 1,
  });

  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || 'Failed to clear account security state');
  }

  return payload.state || EMPTY_ACCOUNT_SECURITY_STATE;
}

export async function updatePasswordWithCurrentPassword({
  email,
  currentPassword,
  newPassword,
  clearTemporaryPasswordState = true,
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) {
    throw new Error('Current user email is required');
  }

  await checkAuthActionRateLimit('change_password');

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: currentPassword,
  });

  if (reauthError) {
    throw reauthError;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  if (!clearTemporaryPasswordState) {
    return {
      securityStateUpdated: false,
      securityStateError: null,
    };
  }

  try {
    const state = await clearPasswordChangeRequired();
    return {
      securityStateUpdated: true,
      state,
      securityStateError: null,
    };
  } catch (securityStateError) {
    return {
      securityStateUpdated: false,
      securityStateError,
    };
  }
}
