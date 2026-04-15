import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from './_lib/http.js';
import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
  listMergedAdminUsers,
} from './_lib/authAdmin.js';
import { parseRequestedJobIds } from './_lib/opsAutomation.js';
import { runOpsAutomationJobs } from './_lib/runOpsAutomation.js';

const PASSWORD_RESET_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 20,
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

function readAdminRoute(req) {
  try {
    const url = new URL(req.url || '', 'https://example.com');
    const explicitRoute = String(url.searchParams.get('route') || '').trim();
    if (explicitRoute) {
      return explicitRoute;
    }

    const normalizedPath = url.pathname.replace(/\/+$/, '');
    const pathnameRouteMap = {
      '/api/admin': 'users',
      '/api/admin-users': 'users',
      '/api/admin-delete-user': 'delete-user',
      '/api/admin-user-reset-password': 'user-reset-password',
      '/api/admin-reset-recovery-password': 'reset-recovery-password',
      '/api/admin-ops-automation': 'ops-automation',
    };

    return pathnameRouteMap[normalizedPath] || '';
  } catch {
    return '';
  }
}

function getAdminRouteConfig(route) {
  switch (route) {
    case 'users':
      return {
        methods: 'GET, OPTIONS',
        headers: 'Content-Type, Authorization',
      };
    case 'delete-user':
    case 'user-reset-password':
    case 'reset-recovery-password':
    case 'ops-automation':
      return {
        methods: 'POST, OPTIONS',
        headers: 'Content-Type, Authorization',
      };
    default:
      return {
        methods: 'GET, POST, OPTIONS',
        headers: 'Content-Type, Authorization',
      };
  }
}

async function verifySuperAdmin(req, adminClient, { useAnonServerClient = false } = {}) {
  const token = getBearerToken(req);
  if (!token) {
    return {
      error: { status: 401, message: 'Missing access token' },
    };
  }

  const callerClient = useAnonServerClient
    ? getSupabaseAnonServerClient()
    : createSupabaseAccessTokenClient(token);

  if (!callerClient) {
    return {
      error: {
        status: 503,
        message: useAnonServerClient
          ? 'Supabase anon server client not configured'
          : 'Supabase caller client not configured',
      },
    };
  }

  const userResult = useAnonServerClient
    ? await callerClient.auth.getUser(token)
    : await callerClient.auth.getUser();

  const callerUser = userResult?.data?.user;
  if (userResult?.error || !callerUser?.id) {
    return {
      error: { status: 401, message: userResult?.error?.message || 'Invalid access token' },
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', callerUser.id)
    .single();

  if (profileError) {
    return {
      error: { status: 500, message: profileError.message || 'Failed to load caller profile' },
    };
  }

  if (profile?.role !== 'super_admin') {
    return {
      error: { status: 403, message: 'Super admin role required' },
    };
  }

  return { callerUser };
}

async function handleUsers(req, res, adminClient) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authResult = await verifySuperAdmin(req, adminClient);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
  }

  try {
    const users = await listMergedAdminUsers(adminClient, {
      repairProfiles: true,
    });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load admin users',
    });
  }
}

async function handleDeleteUser(req, res, adminClient) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authResult = await verifySuperAdmin(req, adminClient);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
  }

  const { userId } = parseRequestBody(req);
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required',
    });
  }

  if (normalizedUserId === authResult.callerUser.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete current super admin',
    });
  }

  try {
    const cleanupOperations = [
      adminClient.from('announcements').update({ created_by: null }).eq('created_by', normalizedUserId),
      adminClient.from('site_config').update({ updated_by: null }).eq('updated_by', normalizedUserId),
      adminClient.from('puzzles').update({ uploader_id: null }).eq('uploader_id', normalizedUserId),
    ];

    for (const operation of cleanupOperations) {
      const { error } = await operation;
      if (error) {
        throw error;
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(normalizedUserId);
    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({
      success: true,
      userId: normalizedUserId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete user',
    });
  }
}

async function handleUserResetPassword(req, res, adminClient) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authResult = await verifySuperAdmin(req, adminClient);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
  }

  const { userId, temporaryPassword } = parseRequestBody(req);
  const normalizedUserId = String(userId || '').trim();
  const normalizedPassword = String(temporaryPassword || '').trim();

  if (!normalizedUserId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required',
    });
  }

  if (normalizedUserId === authResult.callerUser.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot reset current super admin password here',
    });
  }

  if (normalizedPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Temporary password must be at least 6 characters',
    });
  }

  try {
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(normalizedUserId, {
      password: normalizedPassword,
    });

    if (updateAuthError) {
      throw updateAuthError;
    }

    return res.status(200).json({
      success: true,
      userId: normalizedUserId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reset user password',
    });
  }
}

async function handleResetRecoveryPassword(req, res, adminClient) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`admin-reset-recovery:${requesterKey}`, PASSWORD_RESET_LIMIT);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter,
    });
  }

  const authResult = await verifySuperAdmin(req, adminClient, { useAnonServerClient: true });
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
  }

  const {
    requestId,
    userId,
    temporaryPassword,
    adminNote,
  } = parseRequestBody(req);

  const normalizedRequestId = String(requestId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const normalizedPassword = String(temporaryPassword || '').trim();
  const normalizedAdminNote = String(adminNote || '').trim();

  if (!normalizedRequestId || !normalizedUserId) {
    return res.status(400).json({
      success: false,
      error: 'Missing requestId or userId',
    });
  }

  if (normalizedPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Temporary password must be at least 6 characters',
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
        error: 'Recovery request not found',
      });
    }

    if (recoveryRequest.request_type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        error: 'Request type does not support password reset',
      });
    }

    if (recoveryRequest.matched_user_id !== normalizedUserId) {
      return res.status(400).json({
        success: false,
        error: 'Matched user mismatch',
      });
    }

    if (recoveryRequest.status !== 'verified') {
      return res.status(400).json({
        success: false,
        error: 'Recovery request must be verified first',
      });
    }

    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(normalizedUserId, {
      password: normalizedPassword,
    });

    if (updateAuthError) {
      throw updateAuthError;
    }

    const finalAdminNote = [
      normalizedAdminNote,
      '已通过超管操作设置临时密码，请通过线下已确认的沟通渠道告知用户，并要求其登录后立即到设置页修改密码。',
    ].filter(Boolean).join('\n\n');

    const { error: updateRequestError } = await adminClient
      .from('account_recovery_requests')
      .update({
        status: 'closed',
        admin_note: finalAdminNote,
        handled_by: authResult.callerUser.id,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedRequestId);

    if (updateRequestError) {
      throw updateRequestError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reset recovery password',
    });
  }
}

function readRequestedJobs(req) {
  if (req.body?.job) {
    return req.body.job;
  }

  try {
    const url = new URL(req.url || '', 'https://example.com');
    return url.searchParams.get('job') || 'all';
  } catch {
    return 'all';
  }
}

async function handleOpsAutomation(req, res, adminClient) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authResult = await verifySuperAdmin(req, adminClient);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
  }

  try {
    const requestedJobIds = parseRequestedJobIds(readRequestedJobs(req));
    const runResult = await runOpsAutomationJobs({
      requestedJobIds,
      triggerType: 'manual',
      createdBy: authResult.callerUser.id,
    });

    if (!runResult.ok && runResult.status === 503) {
      return res.status(503).json({ success: false, error: runResult.error });
    }

    return res.status(runResult.status).json({
      success: runResult.ok,
      ...runResult.results,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const route = readAdminRoute(req);
  if (!route) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported admin route',
    });
  }

  if (rejectDisallowedBrowserOrigin(req, res, getAdminRouteConfig(route))) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      error: 'Auth admin not configured',
    });
  }

  switch (route) {
    case 'users':
      return handleUsers(req, res, adminClient);
    case 'delete-user':
      return handleDeleteUser(req, res, adminClient);
    case 'user-reset-password':
      return handleUserResetPassword(req, res, adminClient);
    case 'reset-recovery-password':
      return handleResetRecoveryPassword(req, res, adminClient);
    case 'ops-automation':
      return handleOpsAutomation(req, res, adminClient);
    default:
      return res.status(400).json({
        success: false,
        error: 'Unsupported admin route',
      });
  }
}
