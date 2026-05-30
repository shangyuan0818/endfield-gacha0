import {
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from '../../_lib/authAdmin.js';
import {
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';
import {
  buildClearedPasswordChangeState,
} from '../../../src/utils/accountRecoveryFlow.js';

function parseRequestBody(req) {
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

function isAuthEmailConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
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

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: 'Missing access token',
    });
  }

  const adminClient = getSupabaseAdminClient();
  const callerClient = getSupabaseAnonServerClient();
  if (!adminClient || !callerClient) {
    return res.status(503).json({
      success: false,
      error: 'Account security state service not configured',
    });
  }

  try {
    const { data: userData, error: userError } = await callerClient.auth.getUser(accessToken);
    const currentUser = userData?.user;
    if (userError || !currentUser?.id) {
      return res.status(401).json({
        success: false,
        error: userError?.message || 'Invalid access token',
      });
    }

    if (req.method === 'POST') {
      const { action } = parseRequestBody(req);
      if (action !== 'clear_password_change_required') {
        return res.status(400).json({
          success: false,
          error: 'Invalid account security action',
        });
      }

      const { error: upsertError } = await adminClient
        .from('account_security_states')
        .upsert({
          user_id: currentUser.id,
          ...buildClearedPasswordChangeState(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        throw upsertError;
      }
    }

    const { data: stateRow, error: stateError } = await adminClient
      .from('account_security_states')
      .select('password_change_required, password_change_reason, password_change_source, password_change_requested_at, password_change_expires_at, password_change_recovery_request_id, email_verification_required, email_verification_reason, email_verification_requested_at, email_verification_verified_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (stateError) {
      throw stateError;
    }

    const fallbackEmailVerificationRequired = !stateRow
      && !isAuthEmailConfirmed(currentUser)
      && currentUser?.app_metadata?.role !== 'super_admin';

    return res.status(200).json({
      success: true,
      state: toClientSecurityState(stateRow || (fallbackEmailVerificationRequired ? {
        email_verification_required: true,
        email_verification_reason: 'unverified_email',
        email_verification_requested_at: null,
        email_verification_verified_at: null,
      } : null)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load account security state',
    });
  }
}
