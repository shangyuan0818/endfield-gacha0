import { createHash } from 'node:crypto';
import {
  getSupabaseAdminClient,
} from '../../_lib/authAdmin.js';

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
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
  hashEmailVerificationToken,
};
