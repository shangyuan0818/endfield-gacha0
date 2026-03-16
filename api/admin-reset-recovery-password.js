import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';
import {
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient
} from './_lib/authAdmin.js';

const PASSWORD_RESET_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 20
};

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

async function requireSuperAdmin(req, adminClient) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return {
      error: { status: 401, message: 'Missing access token' }
    };
  }

  const callerClient = getSupabaseAnonServerClient();
  if (!callerClient) {
    return {
      error: { status: 503, message: 'Supabase anon server client not configured' }
    };
  }

  const { data: userData, error: userError } = await callerClient.auth.getUser(accessToken);
  if (userError || !userData?.user?.id) {
    return {
      error: { status: 401, message: userError?.message || 'Invalid access token' }
    };
  }

  const callerUser = userData.user;
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', callerUser.id)
    .single();

  if (profileError) {
    return {
      error: { status: 500, message: profileError.message || 'Failed to load caller profile' }
    };
  }

  if (profile?.role !== 'super_admin') {
    return {
      error: { status: 403, message: 'Super admin role required' }
    };
  }

  return {
    callerUser
  };
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

  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`admin-reset-recovery:${requesterKey}`, PASSWORD_RESET_LIMIT);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter
    });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      error: 'Auth admin not configured'
    });
  }

  const authResult = await requireSuperAdmin(req, adminClient);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message
    });
  }

  const {
    requestId,
    userId,
    temporaryPassword,
    adminNote
  } = parseRequestBody(req);

  const normalizedRequestId = String(requestId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const normalizedPassword = String(temporaryPassword || '').trim();
  const normalizedAdminNote = String(adminNote || '').trim();

  if (!normalizedRequestId || !normalizedUserId) {
    return res.status(400).json({
      success: false,
      error: 'Missing requestId or userId'
    });
  }

  if (normalizedPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Temporary password must be at least 6 characters'
    });
  }

  try {
    const { data: recoveryRequest, error: requestError } = await adminClient
      .from('account_recovery_requests')
      .select('id, matched_user_id, request_type, status, admin_note')
      .eq('id', normalizedRequestId)
      .single();

    if (requestError) {
      throw requestError;
    }

    if (!recoveryRequest) {
      return res.status(404).json({
        success: false,
        error: 'Recovery request not found'
      });
    }

    if (recoveryRequest.request_type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        error: 'Request type does not support password reset'
      });
    }

    if (recoveryRequest.matched_user_id !== normalizedUserId) {
      return res.status(400).json({
        success: false,
        error: 'Matched user mismatch'
      });
    }

    if (recoveryRequest.status !== 'verified') {
      return res.status(400).json({
        success: false,
        error: 'Recovery request must be verified first'
      });
    }

    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(normalizedUserId, {
      password: normalizedPassword
    });

    if (updateAuthError) {
      throw updateAuthError;
    }

    const finalAdminNote = [
      normalizedAdminNote,
      '已通过超管操作设置临时密码，请通过线下已确认的沟通渠道告知用户，并要求其登录后立即到设置页修改密码。'
    ].filter(Boolean).join('\n\n');

    const { error: updateRequestError } = await adminClient
      .from('account_recovery_requests')
      .update({
        status: 'closed',
        admin_note: finalAdminNote,
        handled_by: authResult.callerUser.id,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', normalizedRequestId);

    if (updateRequestError) {
      throw updateRequestError;
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reset recovery password'
    });
  }
}
