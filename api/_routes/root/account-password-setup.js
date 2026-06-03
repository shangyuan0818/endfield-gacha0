import { getSupabaseAdminClient, loadAuthUserById, findAuthUserByEmail } from '../../_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { resolveAuthenticatedRequestUser } from '../../_lib/siteAuth.js';
import {
  getPrimaryAccountPasswordError,
  validateAccountPassword,
} from '../../../src/utils/authSecurity.js';
import { buildClearedPasswordChangeState } from '../../../src/utils/accountRecoveryFlow.js';

const SYNTHETIC_OAUTH_EMAIL_SUFFIX = '@oauth.local.invalid';

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized.length > 320) {
    return '';
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function isSyntheticOAuthAuthUser(authUser) {
  const email = String(authUser?.email || '').trim().toLowerCase();
  const metadata = authUser?.user_metadata || authUser?.raw_user_meta_data || {};
  return email.endsWith(SYNTHETIC_OAUTH_EMAIL_SUFFIX)
    || metadata?.synthetic_oauth_email === true;
}

function getPasswordErrorCode(password) {
  const validation = validateAccountPassword(password);
  if (validation.isValid) {
    return '';
  }
  return getPrimaryAccountPasswordError(validation) || 'invalid_password';
}

function toClientSecurityState(row) {
  return {
    passwordChangeRequired: Boolean(row?.password_change_required),
    reason: row?.password_change_reason || null,
    source: row?.password_change_source || null,
    requestedAt: row?.password_change_requested_at || null,
    expiresAt: row?.password_change_expires_at || null,
    recoveryRequestId: row?.password_change_recovery_request_id || null,
    emailVerificationRequired: Boolean(row?.email_verification_required),
    emailVerificationReason: row?.email_verification_reason || null,
    emailVerificationRequestedAt: row?.email_verification_requested_at || null,
    emailVerificationVerifiedAt: row?.email_verification_verified_at || null,
  };
}

async function loadSecurityState(adminClient, userId) {
  const { data, error } = await adminClient
    .from('account_security_states')
    .select('password_change_required, password_change_reason, email_verification_required, email_verification_verified_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

async function loadProfile(adminClient, userId) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

async function clearPasswordSetupState(adminClient, userId) {
  const { data, error } = await adminClient
    .from('account_security_states')
    .upsert({
      user_id: userId,
      ...buildClearedPasswordChangeState(),
    }, {
      onConflict: 'user_id',
    })
    .select('password_change_required, password_change_reason, password_change_source, password_change_requested_at, password_change_expires_at, password_change_recovery_request_id, email_verification_required, email_verification_reason, email_verification_requested_at, email_verification_verified_at')
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      error: 'Account password setup service is not configured',
      code: 'password_setup_unavailable',
    });
  }

  try {
    const authResult = await resolveAuthenticatedRequestUser(req, { adminClient });
    if (!authResult.ok || !authResult.user?.id) {
      return res.status(authResult.status || 401).json({
        success: false,
        error: authResult.error || 'Authentication required',
        code: 'auth_required',
      });
    }

    const userId = authResult.user.id;
    const body = parseRequestBody(req);
    const newPassword = String(body.newPassword || body.new_password || '');
    const passwordError = getPasswordErrorCode(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet the security requirements',
        code: passwordError,
      });
    }

    const securityState = await loadSecurityState(adminClient, userId);
    const canSetPassword = securityState?.password_change_required === true
      && String(securityState?.password_change_reason || '').startsWith('oauth_password_setup_required');
    if (!canSetPassword) {
      return res.status(403).json({
        success: false,
        error: 'This account is not in first password setup state',
        code: 'password_setup_not_allowed',
      });
    }

    const profile = await loadProfile(adminClient, userId);
    const profileEmail = normalizeEmail(profile?.email);
    const emailVerified = securityState?.email_verification_required !== true
      && Boolean(securityState?.email_verification_verified_at);
    if (!profileEmail || !emailVerified) {
      return res.status(409).json({
        success: false,
        error: 'Verify a site email before setting a password for this OAuth account',
        code: 'verified_email_required',
      });
    }

    const authUser = await loadAuthUserById(adminClient, userId);
    if (!authUser?.id) {
      return res.status(404).json({
        success: false,
        error: 'Auth user not found',
        code: 'auth_user_not_found',
      });
    }

    const updatePayload = {
      password: newPassword,
      user_metadata: {
        ...(authUser?.user_metadata || authUser?.raw_user_meta_data || {}),
        synthetic_oauth_email: false,
        email_bound_from_profile: true,
        site_password_set: true,
      },
    };

    if (isSyntheticOAuthAuthUser(authUser)) {
      if (typeof adminClient?.auth?.admin?.listUsers === 'function') {
        const existingAuthUser = await findAuthUserByEmail(adminClient, profileEmail);
        if (existingAuthUser?.id && existingAuthUser.id !== userId) {
          return res.status(409).json({
            success: false,
            error: 'Email is already used by another auth account',
            code: 'auth_email_already_used',
          });
        }
      }
      updatePayload.email = profileEmail;
      updatePayload.email_confirm = true;
    }

    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
    if (updateError) {
      return res.status(500).json({
        success: false,
        error: updateError.message || 'Failed to set account password',
        code: updateError.code || 'password_setup_failed',
      });
    }

    const nextState = await clearPasswordSetupState(adminClient, userId);
    return res.status(200).json({
      success: true,
      user: updateData?.user || updateData || null,
      state: toClientSecurityState(nextState),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to set account password',
      code: error?.code || 'password_setup_failed',
    });
  }
}
