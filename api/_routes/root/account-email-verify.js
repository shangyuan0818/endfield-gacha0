import { createHash } from 'node:crypto';
import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
} from '../../_lib/authAdmin.js';
import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';

const CODE_VERIFY_LIMIT = Object.freeze({
  windowMs: 10 * 60 * 1000,
  max: 8,
});

function readEnvironment() {
  return globalThis.process?.env || {};
}

function getAppUrl(env = readEnvironment(), req = null) {
  const configured = String(env.APP_URL || env.VITE_APP_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    return configured;
  }

  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`.replace(/\/$/, '');
  }

  return 'https://ef-gacha.mogujun.icu';
}

function buildRedirectUrl(req, params = {}) {
  const url = new URL('/settings', `${getAppUrl(readEnvironment(), req)}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function redirect(res, location) {
  if (typeof res.redirect === 'function') {
    return res.redirect(303, location);
  }

  res.statusCode = 303;
  res.setHeader('Location', location);
  return res.end();
}

function hashEmailVerificationToken(token) {
  return createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function getQueryToken(req) {
  const token = req.query?.token;
  if (Array.isArray(token)) {
    return String(token[0] || '').trim();
  }
  return String(token || '').trim();
}

function getBodyCode(req) {
  if (!req.body) return '';
  const body = typeof req.body === 'string'
    ? (() => {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    })()
    : req.body;
  return String(body?.code || body?.verificationCode || '').replace(/\D/g, '').slice(0, 12);
}

function hashEmailVerificationCode(code, userId = '') {
  return createHash('sha256')
    .update(`${String(userId || '').trim()}:${String(code || '').trim()}`, 'utf8')
    .digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, POST, OPTIONS', headers: 'Content-Type, Authorization' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (req.method === 'POST') {
    const code = getBodyCode(req);
    if (code.length !== 6) {
      return res.status(400).json({ success: false, error: 'Invalid verification code', code: 'invalid_code' });
    }

    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Authentication required', code: 'session_required' });
    }

    const adminClient = getSupabaseAdminClient();
    const callerClient = createSupabaseAccessTokenClient(accessToken);
    if (!adminClient?.from || !callerClient?.auth) {
      return res.status(503).json({ success: false, error: 'Email verification service unavailable', code: 'service_unavailable' });
    }

    try {
      const { data: userData, error: userError } = await callerClient.auth.getUser(accessToken);
      if (userError || !userData?.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required', code: 'session_invalid' });
      }

      const rateLimitResult = checkMemoryRateLimit(
        `account-email-verify:${userData.user.id}:${getRequesterKey(req)}`,
        CODE_VERIFY_LIMIT
      );
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Too many verification attempts',
          code: 'rate_limited',
          retry_after: rateLimitResult.retryAfter,
        });
      }

      const codeHash = hashEmailVerificationCode(code, userData.user.id);
      const { data: stateRow, error: loadError } = await adminClient
        .from('account_security_states')
        .select('user_id, email_verification_required, email_verification_code_expires_at')
        .eq('email_verification_code_hash', codeHash)
        .maybeSingle();

      if (loadError) {
        throw loadError;
      }

      if (!stateRow?.user_id || stateRow.user_id !== userData.user.id) {
        return res.status(400).json({ success: false, error: 'Verification code not found', code: 'code_not_found' });
      }

      const expiresAt = stateRow.email_verification_code_expires_at
        ? new Date(stateRow.email_verification_code_expires_at)
        : null;
      if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ success: false, error: 'Verification code expired', code: 'code_expired' });
      }

      const now = new Date().toISOString();
      const { error: updateError } = await adminClient
        .from('account_security_states')
        .update({
          email_verification_required: false,
          email_verification_verified_at: now,
          email_verification_token_hash: null,
          email_verification_token_expires_at: null,
          email_verification_code_hash: null,
          email_verification_code_expires_at: null,
          updated_at: now,
        })
        .eq('user_id', stateRow.user_id)
        .eq('email_verification_code_hash', codeHash);

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({ success: true, data: { status: 'verified' } });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to verify email code', code: 'server_error' });
    }
  }

  const token = getQueryToken(req);
  if (token.length < 32 || token.length > 160) {
    return redirect(res, buildRedirectUrl(req, {
      email_verification: 'failed',
      reason: 'invalid_token',
    }));
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient?.from) {
    return redirect(res, buildRedirectUrl(req, {
      email_verification: 'failed',
      reason: 'service_unavailable',
    }));
  }

  try {
    const tokenHash = hashEmailVerificationToken(token);
    const { data: stateRow, error: loadError } = await adminClient
      .from('account_security_states')
      .select('user_id, email_verification_required, email_verification_token_expires_at')
      .eq('email_verification_token_hash', tokenHash)
      .maybeSingle();

    if (loadError) {
      throw loadError;
    }

    if (!stateRow?.user_id) {
      return redirect(res, buildRedirectUrl(req, {
        email_verification: 'failed',
        reason: 'token_not_found',
      }));
    }

    const expiresAt = stateRow.email_verification_token_expires_at
      ? new Date(stateRow.email_verification_token_expires_at)
      : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return redirect(res, buildRedirectUrl(req, {
        email_verification: 'failed',
        reason: 'token_expired',
      }));
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from('account_security_states')
      .update({
        email_verification_required: false,
        email_verification_verified_at: now,
        email_verification_token_hash: null,
        email_verification_token_expires_at: null,
        email_verification_code_hash: null,
        email_verification_code_expires_at: null,
        updated_at: now,
      })
      .eq('user_id', stateRow.user_id)
      .eq('email_verification_token_hash', tokenHash);

    if (updateError) {
      throw updateError;
    }

    return redirect(res, buildRedirectUrl(req, {
      email_verification: 'success',
    }));
  } catch {
    return redirect(res, buildRedirectUrl(req, {
      email_verification: 'failed',
      reason: 'server_error',
    }));
  }
}

export const __internal = {
  buildRedirectUrl,
  hashEmailVerificationCode,
  hashEmailVerificationToken,
};
