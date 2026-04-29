import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';
import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
  listMergedAdminUsers,
} from '../../_lib/authAdmin.js';
import {
  createApiKeySecret,
  createVerifierSecret,
  encryptRevealSecret,
} from '../../_lib/devApiSecrets.js';
import { parseRequestedJobIds } from '../../_lib/opsAutomation.js';
import { runOpsAutomationJobs } from '../../_lib/runOpsAutomation.js';

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
    case 'api-clients-review':
    case 'api-clients-rotate-key':
    case 'api-clients-revoke-key':
    case 'api-clients-delete-key':
    case 'api-clients-rotate-verifier':
      return {
        methods: 'POST, OPTIONS',
        headers: 'Content-Type, Authorization',
      };
    case 'api-clients':
      return {
        methods: 'GET, OPTIONS',
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
  const body = parseRequestBody(req);
  if (body?.job) {
    return body.job;
  }

  try {
    const url = new URL(req.url || '', 'https://example.com');
    return url.searchParams.get('job') || 'all';
  } catch {
    return 'all';
  }
}

function readForceRefresh(req) {
  const body = parseRequestBody(req);
  if (typeof body?.forceRefresh === 'boolean') {
    return body.forceRefresh;
  }

  if (typeof body?.force_refresh === 'boolean') {
    return body.force_refresh;
  }

  try {
    const url = new URL(req.url || '', 'https://example.com');
    const value = url.searchParams.get('forceRefresh') || url.searchParams.get('force_refresh') || '';
    return ['1', 'true', 'yes', 'force'].includes(String(value).toLowerCase());
  } catch {
    return false;
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
    const forceRefresh = readForceRefresh(req);
    const runResult = await runOpsAutomationJobs({
      requestedJobIds,
      triggerType: 'manual',
      createdBy: authResult.callerUser.id,
      forceRefresh,
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

function serializeApiKeyRow(keyRow) {
  return {
    id: keyRow.id,
    client_id: keyRow.client_id,
    key_prefix: keyRow.key_prefix,
    label: keyRow.label,
    status: keyRow.status,
    last_used_at: keyRow.last_used_at || null,
    expires_at: keyRow.expires_at || null,
    created_at: keyRow.created_at || null,
    revoked_at: keyRow.revoked_at || null,
    secret_revealed_at: keyRow.secret_revealed_at || null,
  };
}

function serializeApiClientRow(clientRow, ownerProfile, approvedByProfile, keyRows = []) {
  return {
    id: clientRow.id,
    owner_user_id: clientRow.owner_user_id,
    client_type: clientRow.client_type,
    provider: clientRow.provider,
    name: clientRow.name,
    use_case: clientRow.use_case,
    status: clientRow.status,
    requested_scopes: clientRow.requested_scopes || [],
    granted_scopes: clientRow.granted_scopes || [],
    rate_limit_tier: clientRow.rate_limit_tier,
    review_note: clientRow.review_note || '',
    approved_at: clientRow.approved_at || null,
    verifier_secret_prefix: clientRow.verifier_secret_prefix || null,
    verifier_last_used_at: clientRow.verifier_last_used_at || null,
    verifier_rotated_at: clientRow.verifier_rotated_at || null,
    created_at: clientRow.created_at || null,
    updated_at: clientRow.updated_at || null,
    owner: ownerProfile ? {
      id: ownerProfile.id,
      username: ownerProfile.username,
      email: ownerProfile.email,
      role: ownerProfile.role,
    } : null,
    approved_by_profile: approvedByProfile ? {
      id: approvedByProfile.id,
      username: approvedByProfile.username,
      email: approvedByProfile.email,
      role: approvedByProfile.role,
    } : null,
    keys: keyRows.map(serializeApiKeyRow),
  };
}

async function loadApiClientsWithRelations(adminClient) {
  const { data: clients, error: clientsError } = await adminClient
    .from('api_clients')
    .select('*')
    .order('client_type', { ascending: true })
    .order('created_at', { ascending: false });

  if (clientsError) {
    throw clientsError;
  }

  const clientIds = (clients || []).map((client) => client.id);
  const userIds = [
    ...new Set(
      (clients || [])
        .flatMap((client) => [client.owner_user_id, client.approved_by])
        .filter(Boolean)
    ),
  ];

  const [keysResult, profilesResult] = await Promise.all([
    clientIds.length > 0
      ? adminClient
        .from('api_client_keys')
        .select('*')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? adminClient
        .from('profiles')
        .select('id, username, email, role')
        .in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (keysResult.error) {
    throw keysResult.error;
  }
  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const keysByClientId = new Map();
  (keysResult.data || []).forEach((keyRow) => {
    if (!keysByClientId.has(keyRow.client_id)) {
      keysByClientId.set(keyRow.client_id, []);
    }
    keysByClientId.get(keyRow.client_id).push(keyRow);
  });

  const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));

  return (clients || []).map((clientRow) => serializeApiClientRow(
    clientRow,
    profilesById.get(clientRow.owner_user_id) || null,
    profilesById.get(clientRow.approved_by) || null,
    keysByClientId.get(clientRow.id) || []
  ));
}

async function createClientKey(adminClient, clientId, {
  label = 'primary',
  ownerReveal = false,
} = {}) {
  const { secret, keyPrefix, keyHash } = createApiKeySecret();
  const payload = {
    client_id: clientId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    label,
    status: 'active',
    expires_at: null,
    encrypted_secret: ownerReveal ? encryptRevealSecret(secret) : null,
    secret_revealed_at: ownerReveal ? null : new Date().toISOString(),
  };

  const { data, error } = await adminClient
    .from('api_client_keys')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    secret,
    key: data,
  };
}

async function revokeActiveClientKeys(adminClient, clientId) {
  const nowIso = new Date().toISOString();
  await adminClient
    .from('api_client_keys')
    .update({
      status: 'revoked',
      revoked_at: nowIso,
    })
    .eq('client_id', clientId)
    .eq('status', 'active');
}

async function handleApiClients(req, res, adminClient) {
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
    const clients = await loadApiClientsWithRelations(adminClient);
    return res.status(200).json({
      success: true,
      clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load API clients',
    });
  }
}

async function handleApiClientReview(req, res, adminClient) {
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

  const { clientId, status, reviewNote } = parseRequestBody(req);
  const normalizedClientId = String(clientId || '').trim();
  const normalizedStatus = String(status || '').trim();
  const normalizedNote = String(reviewNote || '').trim();

  if (!normalizedClientId) {
    return res.status(400).json({ success: false, error: 'Missing clientId' });
  }

  if (!['active', 'rejected', 'revoked'].includes(normalizedStatus)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  try {
    const { data: clientRow, error: clientError } = await adminClient
      .from('api_clients')
      .select('*')
      .eq('id', normalizedClientId)
      .limit(1)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    if (!clientRow) {
      return res.status(404).json({ success: false, error: 'API client not found' });
    }

    if (clientRow.client_type !== 'developer') {
      return res.status(400).json({ success: false, error: 'Only developer clients can be reviewed here' });
    }

    const nowIso = new Date().toISOString();
    const nextUpdate = {
      status: normalizedStatus,
      review_note: normalizedNote || null,
      approved_by: authResult.callerUser.id,
      updated_at: nowIso,
      granted_scopes: normalizedStatus === 'active' ? ['public.read'] : [],
      approved_at: normalizedStatus === 'active' ? nowIso : null,
    };

    const { data: updatedClient, error: updateError } = await adminClient
      .from('api_clients')
      .update(nextUpdate)
      .eq('id', normalizedClientId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    let bootstrapKey = null;
    if (normalizedStatus === 'active') {
      const { data: activeKeys, error: activeKeyError } = await adminClient
        .from('api_client_keys')
        .select('id')
        .eq('client_id', normalizedClientId)
        .eq('status', 'active')
        .limit(1);

      if (activeKeyError) {
        throw activeKeyError;
      }

      if (!Array.isArray(activeKeys) || activeKeys.length === 0) {
        const created = await createClientKey(adminClient, normalizedClientId, {
          label: 'bootstrap',
          ownerReveal: true,
        });
        bootstrapKey = {
          secret: created.secret,
          key: serializeApiKeyRow(created.key),
        };
      }
    }

    if (normalizedStatus === 'revoked') {
      await revokeActiveClientKeys(adminClient, normalizedClientId);
    }

    return res.status(200).json({
      success: true,
      client: {
        id: updatedClient.id,
        status: updatedClient.status,
        review_note: updatedClient.review_note || '',
        granted_scopes: updatedClient.granted_scopes || [],
        approved_at: updatedClient.approved_at || null,
      },
      bootstrapKey,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to review API client',
    });
  }
}

async function handleApiClientRotateKey(req, res, adminClient) {
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

  const { clientId, label } = parseRequestBody(req);
  const normalizedClientId = String(clientId || '').trim();
  const normalizedLabel = String(label || '').trim() || 'rotated';

  if (!normalizedClientId) {
    return res.status(400).json({ success: false, error: 'Missing clientId' });
  }

  try {
    const { data: clientRow, error: clientError } = await adminClient
      .from('api_clients')
      .select('*')
      .eq('id', normalizedClientId)
      .limit(1)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    if (!clientRow) {
      return res.status(404).json({ success: false, error: 'API client not found' });
    }

    await revokeActiveClientKeys(adminClient, normalizedClientId);
    const created = await createClientKey(adminClient, normalizedClientId, {
      label: normalizedLabel,
      ownerReveal: clientRow.client_type === 'developer',
    });

    return res.status(200).json({
      success: true,
      key: {
        ...serializeApiKeyRow(created.key),
        secret: created.secret,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to rotate API key',
    });
  }
}

async function handleApiClientRevokeKey(req, res, adminClient) {
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

  const { keyId } = parseRequestBody(req);
  const normalizedKeyId = String(keyId || '').trim();

  if (!normalizedKeyId) {
    return res.status(400).json({ success: false, error: 'Missing keyId' });
  }

  try {
    const { data: revokedKey, error } = await adminClient
      .from('api_client_keys')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', normalizedKeyId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!revokedKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    return res.status(200).json({
      success: true,
      key: serializeApiKeyRow(revokedKey),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to revoke API key',
    });
  }
}

async function handleApiClientDeleteKey(req, res, adminClient) {
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

  const { keyId } = parseRequestBody(req);
  const normalizedKeyId = String(keyId || '').trim();

  if (!normalizedKeyId) {
    return res.status(400).json({ success: false, error: 'Missing keyId' });
  }

  try {
    const { data: deletedKey, error } = await adminClient
      .from('api_client_keys')
      .delete()
      .eq('id', normalizedKeyId)
      .select('id, client_id, key_prefix, label, status')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!deletedKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    return res.status(200).json({
      success: true,
      key: {
        id: deletedKey.id,
        client_id: deletedKey.client_id,
        key_prefix: deletedKey.key_prefix,
        label: deletedKey.label,
        status: deletedKey.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete API key',
    });
  }
}

async function handleApiClientRotateVerifier(req, res, adminClient) {
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

  const { clientId } = parseRequestBody(req);
  const normalizedClientId = String(clientId || '').trim();

  if (!normalizedClientId) {
    return res.status(400).json({ success: false, error: 'Missing clientId' });
  }

  try {
    const { data: clientRow, error: clientError } = await adminClient
      .from('api_clients')
      .select('*')
      .eq('id', normalizedClientId)
      .limit(1)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    if (!clientRow) {
      return res.status(404).json({ success: false, error: 'API client not found' });
    }

    if (clientRow.client_type !== 'official_bot' || !clientRow.provider) {
      return res.status(400).json({ success: false, error: 'Only official bot clients can rotate verifier secrets' });
    }

    const { secret, secretHash, secretPrefix } = createVerifierSecret(clientRow.provider);
    const { data: updatedClient, error: updateError } = await adminClient
      .from('api_clients')
      .update({
        verifier_secret_prefix: secretPrefix,
        verifier_secret_hash: secretHash,
        verifier_rotated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedClientId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      verifier: {
        client_id: updatedClient.id,
        provider: updatedClient.provider,
        verifier_secret_prefix: updatedClient.verifier_secret_prefix,
        verifier_rotated_at: updatedClient.verifier_rotated_at,
        secret,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to rotate verifier secret',
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
    case 'api-clients':
      return handleApiClients(req, res, adminClient);
    case 'api-clients-review':
      return handleApiClientReview(req, res, adminClient);
    case 'api-clients-rotate-key':
      return handleApiClientRotateKey(req, res, adminClient);
    case 'api-clients-revoke-key':
      return handleApiClientRevokeKey(req, res, adminClient);
    case 'api-clients-delete-key':
      return handleApiClientDeleteKey(req, res, adminClient);
    case 'api-clients-rotate-verifier':
      return handleApiClientRotateVerifier(req, res, adminClient);
    default:
      return res.status(400).json({
        success: false,
        error: 'Unsupported admin route',
      });
  }
}
