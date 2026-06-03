import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';
import {
  findAuthUserByEmail,
  getSupabaseAdminClient,
  listMergedAdminUsers,
} from '../../_lib/authAdmin.js';
import { requireSuperAdminUser } from '../../_lib/siteAuth.js';
import {
  createApiKeySecret,
  createVerifierSecret,
  encryptRevealSecret,
} from '../../_lib/devApiSecrets.js';
import { parseRequestedJobIds } from '../../_lib/opsAutomation.js';
import {
  bumpPublicCacheEpoch,
  refreshPublicAnalyticsCache,
} from '../../_lib/publicCache.js';
import { getRequesterIp } from '../../_lib/authSecurityGuards.js';
import { enqueueMailOutboxEvent } from '../../_lib/mailOutbox.js';
import { MAIL_EVENT_TYPES } from '../../_lib/mailAbuseGuards.js';
import {
  buildOpsAutomationHttpPayload,
  runOpsAutomationJobs,
} from '../../_lib/runOpsAutomation.js';
import { runMailOutboxWorker } from '../../_lib/mailOutboxWorker.js';
import { sendMailSmokeTest } from '../../_lib/mailSmokeTest.js';
import {
  buildMailRuntimeControls,
  isRuntimeEventEnabled,
  loadMailRuntimeState,
  sanitizeMailRuntimeUpdate,
  saveMailRuntimeConfig,
} from '../../_lib/mailRuntimeConfig.js';
import { serverLogger } from '../../_lib/serverLogger.js';
import {
  getPrimaryAccountPasswordError,
  validateAccountPassword,
} from '../../../src/utils/authSecurity.js';
import {
  appendRecoveryAuditEvent,
  buildTemporaryPasswordIssueMetadata,
} from '../../../src/utils/accountRecoveryFlow.js';
import { buildAdminSiteHealth } from '../../_lib/adminSiteHealth.js';

const PASSWORD_RESET_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 20,
};
const SYNTHETIC_OAUTH_EMAIL_SUFFIX = '@oauth.local.invalid';

function normalizeAuthEmail(value) {
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

async function loadAdminAuthUser(adminClient, userId) {
  const getUserById = adminClient?.auth?.admin?.getUserById;
  if (typeof getUserById !== 'function') {
    return null;
  }

  const { data, error } = await getUserById.call(adminClient.auth.admin, userId);
  if (error) {
    throw error;
  }
  return data?.user || data || null;
}

async function loadProfileEmailForAuthSync(adminClient, userId) {
  const query = adminClient
    .from('profiles')
    .select('id, email')
    .eq('id', userId);

  const { data, error } = typeof query.maybeSingle === 'function'
    ? await query.maybeSingle()
    : await query.single();

  if (error) {
    throw error;
  }
  return normalizeAuthEmail(data?.email);
}

async function buildTemporaryPasswordAuthUpdate(adminClient, userId, temporaryPassword) {
  const payload = {
    password: temporaryPassword,
  };
  const authUser = await loadAdminAuthUser(adminClient, userId);
  if (!isSyntheticOAuthAuthUser(authUser)) {
    return {
      payload,
      emailSynced: false,
      email: null,
    };
  }

  const profileEmail = await loadProfileEmailForAuthSync(adminClient, userId);
  if (!profileEmail) {
    return {
      payload,
      emailSynced: false,
      email: null,
    };
  }

  if (typeof adminClient?.auth?.admin?.listUsers === 'function') {
    const existingAuthUser = await findAuthUserByEmail(adminClient, profileEmail);
    if (existingAuthUser?.id && existingAuthUser.id !== userId) {
      const error = new Error('Profile email is already used by another auth account');
      error.status = 409;
      error.code = 'auth_email_already_used';
      throw error;
    }
  }

  const metadata = {
    ...(authUser?.user_metadata || authUser?.raw_user_meta_data || {}),
    synthetic_oauth_email: false,
    email_bound_from_profile: true,
  };

  return {
    payload: {
      ...payload,
      email: profileEmail,
      email_confirm: true,
      user_metadata: metadata,
    },
    emailSynced: true,
    email: profileEmail,
  };
}

function getTemporaryPasswordError(password) {
  const validation = validateAccountPassword(password);
  if (validation.isValid) {
    return null;
  }

  switch (getPrimaryAccountPasswordError(validation)) {
    case 'required':
    case 'too_short':
      return 'Temporary password must be at least 8 characters';
    case 'too_long':
      return 'Temporary password must be 100 characters or fewer';
    case 'too_simple':
      return 'Temporary password must include at least two character groups';
    default:
      return 'Temporary password does not meet the security requirements';
  }
}

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

async function safeLoadMailRuntimeState(adminClient) {
  try {
    return await loadMailRuntimeState(adminClient);
  } catch (error) {
    serverLogger.warn('mail.runtime-config.load-failed', {
      code: 'mail_runtime_config_load_failed',
      message: String(error?.message || error || 'mail_runtime_config_load_failed').slice(0, 200),
    });
    return null;
  }
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
      '/api/admin-public-cache-bump': 'public-cache-bump',
      '/api/admin-site-health': 'site-health',
      '/api/admin-mail-outbox-drain': 'mail-outbox-drain',
      '/api/admin-mail-smoke-test': 'mail-smoke-test',
      '/api/admin-mail-alert': 'mail-alert',
      '/api/admin-mail-budget-config': 'mail-budget-config',
      '/api/admin-mail-runtime-config': 'mail-runtime-config',
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
    case 'public-cache-bump':
    case 'mail-outbox-drain':
    case 'mail-smoke-test':
    case 'mail-alert':
    case 'mail-budget-config':
    case 'mail-runtime-config':
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
    case 'site-health':
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

async function verifySuperAdmin(req, adminClient) {
  const authResult = await requireSuperAdminUser(req, { adminClient });
  if (!authResult.ok) {
    return {
      error: { status: authResult.status || 401, message: authResult.error || 'Invalid access token' },
    };
  }

  return {
    callerUser: authResult.user,
    profile: authResult.profile,
  };
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

  const passwordError = getTemporaryPasswordError(normalizedPassword);
  if (passwordError) {
    return res.status(400).json({
      success: false,
      error: passwordError,
    });
  }

  try {
    const authUpdate = await buildTemporaryPasswordAuthUpdate(
      adminClient,
      normalizedUserId,
      normalizedPassword
    );
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      normalizedUserId,
      authUpdate.payload
    );

    if (updateAuthError) {
      throw updateAuthError;
    }

    return res.status(200).json({
      success: true,
      userId: normalizedUserId,
      emailSynced: authUpdate.emailSynced,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      success: false,
      error: error?.message || 'Failed to reset user password',
      code: error?.code || undefined,
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

  const authResult = await verifySuperAdmin(req, adminClient);
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

  const passwordError = getTemporaryPasswordError(normalizedPassword);
  if (passwordError) {
    return res.status(400).json({
      success: false,
      error: passwordError,
    });
  }

  try {
    const { data: recoveryRequest, error: requestError } = await adminClient
      .from('account_recovery_requests')
      .select('id, matched_user_id, request_type, status, admin_note, recovery_audit')
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

    const authUpdate = await buildTemporaryPasswordAuthUpdate(
      adminClient,
      normalizedUserId,
      normalizedPassword
    );
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      normalizedUserId,
      authUpdate.payload
    );

    if (updateAuthError) {
      throw updateAuthError;
    }

    const issueMetadata = buildTemporaryPasswordIssueMetadata({
      actorUserId: authResult.callerUser.id,
      requestId: normalizedRequestId,
    });
    const warnings = [];

    const { error: securityStateError } = await adminClient
      .from('account_security_states')
      .upsert({
        user_id: normalizedUserId,
        ...issueMetadata.securityState,
      }, {
        onConflict: 'user_id',
      });

    if (securityStateError) {
      warnings.push({
        code: 'account_security_state_update_failed',
        message: securityStateError.message || 'Failed to mark password change as required',
      });
    }

    const finalAdminNote = [
      normalizedAdminNote,
      `已通过超管操作设置临时密码。临时密码将在 ${issueMetadata.expiresAt} 过期；请通过线下已确认的沟通渠道告知用户，并要求其登录后立即到设置页修改密码。`,
    ].filter(Boolean).join('\n\n');
    const nextAudit = appendRecoveryAuditEvent(
      recoveryRequest.recovery_audit,
      {
        ...issueMetadata.auditEvent,
        warnings,
      }
    );

    const { error: updateRequestError } = await adminClient
      .from('account_recovery_requests')
      .update({
        status: 'closed',
        admin_note: finalAdminNote,
        handled_by: authResult.callerUser.id,
        handled_at: issueMetadata.issuedAt,
        updated_at: issueMetadata.issuedAt,
        ...issueMetadata.recoveryRequestPatch,
        recovery_audit: nextAudit,
      })
      .eq('id', normalizedRequestId);

    if (updateRequestError) {
      warnings.push({
        code: 'recovery_request_update_failed',
        message: updateRequestError.message || 'Failed to close recovery request',
      });
    }

    return res.status(200).json({
      success: true,
      partial: warnings.length > 0,
      warnings,
      deliveryChannel: issueMetadata.deliveryChannel,
      nextStep: issueMetadata.nextStep,
      expiresAt: issueMetadata.expiresAt,
      forceChangeRequired: issueMetadata.forceChangeRequired,
      emailSynced: authUpdate.emailSynced,
      securityStateUpdated: !securityStateError,
      recoveryRequestUpdated: !updateRequestError,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      success: false,
      error: error?.message || 'Failed to reset recovery password',
      code: error?.code || undefined,
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

function readAnnouncementRefreshMode(req) {
  const body = parseRequestBody(req);
  const bodyValue = body?.refreshMode || body?.refresh_mode || body?.announcementRefreshMode;
  if (bodyValue) {
    return String(bodyValue);
  }

  try {
    const url = new URL(req.url || '', 'https://example.com');
    return url.searchParams.get('refreshMode') || url.searchParams.get('refresh_mode') || '';
  } catch {
    return '';
  }
}

function readAnnouncementLimit(req) {
  const body = parseRequestBody(req);
  const bodyValue = body?.announcementLimit || body?.announcement_limit || body?.limit;
  if (bodyValue != null && bodyValue !== '') {
    return bodyValue;
  }

  try {
    const url = new URL(req.url || '', 'https://example.com');
    return url.searchParams.get('announcementLimit')
      || url.searchParams.get('announcement_limit')
      || url.searchParams.get('limit')
      || null;
  } catch {
    return null;
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
    const refreshMode = readAnnouncementRefreshMode(req);
    const announcementLimit = readAnnouncementLimit(req);
    const runResult = await runOpsAutomationJobs({
      requestedJobIds,
      triggerType: 'manual',
      createdBy: authResult.callerUser.id,
      forceRefresh,
      refreshMode,
      announcementLimit,
    });

    if (!runResult.ok && runResult.status === 503) {
      return res.status(503).json({ success: false, error: runResult.error });
    }

    return res.status(runResult.status).json(buildOpsAutomationHttpPayload(runResult));
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

async function handlePublicCacheBump(req, res, adminClient) {
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

  const body = parseRequestBody(req);
  const scope = String(body?.scope || 'public').trim() || 'public';
  const reason = String(body?.reason || 'admin').trim() || 'admin';
  const shouldRefreshAnalytics = ['pools', 'stats'].includes(scope);
  const analyticsRefresh = shouldRefreshAnalytics
    ? await refreshPublicAnalyticsCache(adminClient, { reason })
    : null;
  const result = await bumpPublicCacheEpoch(adminClient, {
    scope,
    reason,
  });

  if (!result.ok) {
    return res.status(500).json({
      success: false,
      error: result.error || 'Failed to bump public cache epoch',
    });
  }

  return res.status(200).json({
    success: true,
    cacheVersion: result.version,
    scope: result.scope,
    reason: result.reason,
    updatedAt: result.updatedAt,
    ...(analyticsRefresh ? { analyticsRefresh } : {}),
  });
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

async function loadProfileById(adminClient, userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return null;
  }

  const query = adminClient
    .from('profiles')
    .select('id, username, email, role')
    .eq('id', normalizedUserId);

  const profileResult = typeof query.maybeSingle === 'function'
    ? await query.maybeSingle()
    : (typeof query.single === 'function' ? await query.single() : await query);

  if (profileResult.error) {
    throw profileResult.error;
  }

  return Array.isArray(profileResult.data)
    ? profileResult.data[0] || null
    : profileResult.data || null;
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

function isDeveloperApiReviewMailEnabled(env = readEnvironment(), runtimeState = null) {
  if (runtimeState) {
    return isRuntimeEventEnabled(runtimeState, 'developerApiReview');
  }

  return parseBoolean(env.DEVELOPER_API_REVIEW_MAIL_OUTBOX_ENABLED, false)
    && parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED, false);
}

function summarizeMailNotification(result, {
  enabled,
  attempted,
  disabledCode = 'developer_api_review_mail_disabled',
  skippedCode = 'developer_api_review_mail_skipped',
} = {}) {
  if (!enabled) {
    return {
      enabled: false,
      attempted: false,
      status: 'disabled',
      code: disabledCode,
    };
  }

  if (!attempted) {
    return {
      enabled: true,
      attempted: false,
      status: 'skipped',
      code: result?.code || skippedCode,
    };
  }

  if (result?.queued) {
    return {
      enabled: true,
      attempted: true,
      status: 'queued',
      code: result.code || 'mail_outbox_queued',
      outboxId: result.outboxId || null,
    };
  }

  if (result?.deduped) {
    return {
      enabled: true,
      attempted: true,
      status: 'deduped',
      code: result.code || 'mail_idempotency_hit',
      outboxId: result.outboxId || null,
    };
  }

  if (result?.action === 'block') {
    return {
      enabled: true,
      attempted: true,
      status: 'blocked',
      code: result.code || 'mail_enqueue_blocked',
    };
  }

  return {
    enabled: true,
    attempted: true,
    status: 'error',
    code: result?.code || 'mail_enqueue_failed',
  };
}

async function enqueueDeveloperApiReviewMail({
  req,
  adminClient,
  clientRow,
  previousClientRow,
  reviewerUserId,
  status,
  reviewNote,
  nowIso,
  runtimeState,
} = {}) {
  const enabled = isDeveloperApiReviewMailEnabled(readEnvironment(), runtimeState);
  if (!enabled) {
    return summarizeMailNotification(null, { enabled, attempted: false });
  }

  const ownerUserId = clientRow?.owner_user_id || previousClientRow?.owner_user_id || '';
  let ownerProfile = null;
  try {
    ownerProfile = await loadProfileById(adminClient, ownerUserId);
  } catch (error) {
    serverLogger.warn('developer-api.review-mail.owner-load-failed', {
      clientId: clientRow?.id || previousClientRow?.id || '',
      status,
      code: 'owner_profile_load_failed',
      message: String(error?.message || error || 'owner_profile_load_failed').slice(0, 200),
    });
    return summarizeMailNotification({
      code: 'owner_profile_load_failed',
    }, { enabled, attempted: false });
  }

  if (!ownerProfile?.email) {
    return summarizeMailNotification({
      code: 'owner_email_unavailable',
    }, { enabled, attempted: false });
  }

  let mailResult;
  try {
    mailResult = await enqueueMailOutboxEvent({
      adminClient,
      eventType: MAIL_EVENT_TYPES.DEVELOPER_API_REVIEW,
      recipientEmail: ownerProfile.email,
      requesterIp: getRequesterIp(req),
      userId: ownerUserId,
      templateKey: 'developer-api.review',
      locale: 'zh-CN',
      relatedEntityType: 'api_client',
      relatedEntityId: clientRow.id,
      purposeKey: `${status}:${clientRow.updated_at || nowIso}`,
      payload: {
        status,
        previousStatus: previousClientRow?.status || null,
        clientName: clientRow.name || previousClientRow?.name || 'unnamed',
        clientType: clientRow.client_type || previousClientRow?.client_type || 'developer',
        hasReviewNote: Boolean(reviewNote),
        grantedScopesCount: Array.isArray(clientRow.granted_scopes) ? clientRow.granted_scopes.length : 0,
        reviewedAt: nowIso,
        reviewedBy: reviewerUserId ? '[redacted]' : null,
      },
      priority: status === 'active' ? 4 : 5,
      controls: buildMailRuntimeControls(runtimeState, 'developerApiReview'),
    });
  } catch (error) {
    mailResult = {
      ok: false,
      queued: false,
      deduped: false,
      action: 'error',
      code: 'mail_enqueue_exception',
      reason: error?.message || 'Mail enqueue failed.',
    };
  }

  const notification = summarizeMailNotification(mailResult, {
    enabled,
    attempted: true,
  });

  if (!['queued', 'deduped'].includes(notification.status)) {
    serverLogger.warn('developer-api.review-mail.not-queued', {
      clientId: clientRow?.id || '',
      status,
      mailStatus: notification.status,
      code: notification.code,
    });
  }

  return notification;
}

function isAdminAlertMailEnabled(env = readEnvironment(), runtimeState = null) {
  if (runtimeState) {
    return isRuntimeEventEnabled(runtimeState, 'adminAlert');
  }

  return parseBoolean(env.ADMIN_ALERT_MAIL_OUTBOX_ENABLED, false)
    && parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED, false);
}

async function enqueueAdminAlertMail({
  req,
  adminClient,
  actorUserId,
  summary,
  secondary,
  locale,
  nowIso,
  runtimeState,
} = {}) {
  const enabled = isAdminAlertMailEnabled(readEnvironment(), runtimeState);
  const summaryCodes = {
    disabledCode: 'admin_alert_mail_disabled',
    skippedCode: 'admin_alert_mail_skipped',
  };
  if (!enabled) {
    return summarizeMailNotification(null, { enabled, attempted: false, ...summaryCodes });
  }

  let actorProfile = null;
  try {
    actorProfile = await loadProfileById(adminClient, actorUserId);
  } catch (error) {
    serverLogger.warn('admin.alert-mail.actor-load-failed', {
      actorUserId: actorUserId || '',
      code: 'actor_profile_load_failed',
      message: String(error?.message || error || 'actor_profile_load_failed').slice(0, 200),
    });
    return summarizeMailNotification({ code: 'actor_profile_load_failed' }, {
      enabled,
      attempted: false,
      ...summaryCodes,
    });
  }

  if (!actorProfile?.email || actorProfile.role !== 'super_admin') {
    return summarizeMailNotification({ code: 'admin_alert_recipient_unavailable' }, {
      enabled,
      attempted: false,
      ...summaryCodes,
    });
  }

  let mailResult;
  try {
    mailResult = await enqueueMailOutboxEvent({
      adminClient,
      eventType: MAIL_EVENT_TYPES.ADMIN_ALERT,
      recipientEmail: actorProfile.email,
      requesterIp: getRequesterIp(req),
      userId: actorProfile.id,
      templateKey: 'admin.alert',
      locale,
      relatedEntityType: 'profile',
      relatedEntityId: actorProfile.id,
      purposeKey: `manual-admin-alert:${nowIso}`,
      payload: {
        summary,
        secondary,
        source: 'admin-mail-status-panel',
        generatedAt: nowIso,
      },
      priority: 3,
      controls: buildMailRuntimeControls(runtimeState, 'adminAlert'),
    });
  } catch (error) {
    mailResult = {
      ok: false,
      queued: false,
      deduped: false,
      action: 'error',
      code: 'mail_enqueue_exception',
      reason: error?.message || 'Mail enqueue failed.',
    };
  }

  const notification = summarizeMailNotification(mailResult, {
    enabled,
    attempted: true,
    ...summaryCodes,
  });

  if (!['queued', 'deduped'].includes(notification.status)) {
    serverLogger.warn('admin.alert-mail.not-queued', {
      actorUserId: actorUserId || '',
      mailStatus: notification.status,
      code: notification.code,
    });
  }

  return notification;
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

    const runtimeState = await safeLoadMailRuntimeState(adminClient);
    const mailNotification = await enqueueDeveloperApiReviewMail({
      req,
      adminClient,
      clientRow: updatedClient,
      previousClientRow: clientRow,
      reviewerUserId: authResult.callerUser.id,
      status: normalizedStatus,
      reviewNote: normalizedNote,
      nowIso,
      runtimeState,
    });

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
      mailNotification,
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

async function handleSiteHealth(req, res, adminClient) {
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
    const health = await buildAdminSiteHealth({ adminClient });
    return res.status(200).json({
      success: true,
      health,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load site health',
    });
  }
}

async function handleMailOutboxDrain(req, res, adminClient) {
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
    const result = await runMailOutboxWorker({ adminClient });
    return res.status(200).json({
      success: true,
      partial: result.ok === false,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to drain mail outbox',
    });
  }
}

async function handleMailSmokeTest(req, res, adminClient) {
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

  const body = parseRequestBody(req);
  const recipientEmail = String(body?.recipientEmail || body?.recipient_email || '').trim();
  const locale = String(body?.locale || body?.lang || 'zh-CN').trim() || 'zh-CN';

  if (!recipientEmail) {
    return res.status(400).json({
      success: false,
      error: 'Recipient email is required',
    });
  }

  try {
    const result = await sendMailSmokeTest({
      adminClient,
      recipientEmail,
      locale,
      actorUserId: authResult.callerUser.id,
    });

    return res.status(200).json({
      success: true,
      partial: result.ok === false,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to send mail smoke test',
    });
  }
}

async function handleMailAlert(req, res, adminClient) {
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

  const body = parseRequestBody(req);
  const rawSummary = String(body?.summary || '').trim();
  const rawSecondary = String(body?.secondary || '').trim();
  const locale = String(body?.locale || body?.lang || 'zh-CN').trim() || 'zh-CN';
  const summary = rawSummary.slice(0, 240) || '管理员手动告警测试';
  const secondary = rawSecondary.slice(0, 360)
    || '这是一条由后台邮件状态面板触发的受控告警，用于验证 admin.alert outbox 链路。';
  const nowIso = new Date().toISOString();

  try {
    const runtimeState = await safeLoadMailRuntimeState(adminClient);
    const mailNotification = await enqueueAdminAlertMail({
      req,
      adminClient,
      actorUserId: authResult.callerUser.id,
      summary,
      secondary,
      locale,
      nowIso,
      runtimeState,
    });

    return res.status(200).json({
      success: true,
      partial: mailNotification.status === 'error',
      mailNotification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to enqueue admin alert mail',
    });
  }
}

async function handleMailRuntimeConfig(req, res, adminClient) {
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

  const body = parseRequestBody(req);
  const nextConfig = sanitizeMailRuntimeUpdate({
    events: body?.events,
    controls: body?.controls,
    note: body?.note,
  });

  try {
    await saveMailRuntimeConfig(adminClient, nextConfig, {
      actorUserId: authResult.callerUser.id,
      now: new Date(),
    });
    const runtime = await loadMailRuntimeState(adminClient);
    return res.status(200).json({
      success: true,
      runtime,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update mail runtime config',
    });
  }
}

const MAIL_BUDGET_SCOPES = new Set(['global', 'event', 'recipient', 'domain', 'ip', 'user', 'related']);
const MAIL_BUDGET_EVENTS = new Set(['*', ...Object.values(MAIL_EVENT_TYPES)]);

function normalizeMailBudgetConfigPatch(rawItem = {}) {
  const scope = String(rawItem.scope || '').trim();
  const eventType = String(rawItem.eventType || rawItem.event_type || '').trim();
  const windowSeconds = Number.parseInt(rawItem.windowSeconds ?? rawItem.window_seconds, 10);
  const maxAttempts = Number.parseInt(rawItem.maxAttempts ?? rawItem.max_attempts, 10);
  const enabled = rawItem.enabled === false || String(rawItem.enabled).toLowerCase() === 'false'
    ? false
    : true;

  if (!MAIL_BUDGET_SCOPES.has(scope)) {
    return { ok: false, error: 'Invalid mail budget scope' };
  }
  if (!MAIL_BUDGET_EVENTS.has(eventType)) {
    return { ok: false, error: 'Invalid mail budget event type' };
  }
  if (scope === 'global' && eventType !== '*') {
    return { ok: false, error: 'Global mail budget must use * event type' };
  }
  if (scope !== 'global' && eventType === '*') {
    return { ok: false, error: 'Only global mail budget can use * event type' };
  }
  if (!Number.isFinite(windowSeconds) || windowSeconds < 60 || windowSeconds > 31_536_000) {
    return { ok: false, error: 'Mail budget window must be between 60 and 31536000 seconds' };
  }
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 1_000_000) {
    return { ok: false, error: 'Mail budget max attempts must be between 1 and 1000000' };
  }

  return {
    ok: true,
    item: {
      scope,
      event_type: eventType,
      window_seconds: windowSeconds,
      max_attempts: maxAttempts,
      enabled,
    },
  };
}

async function handleMailBudgetConfig(req, res, adminClient) {
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

  const body = parseRequestBody(req);
  const rawItems = Array.isArray(body?.items)
    ? body.items
    : [body?.item || body].filter(Boolean);
  if (rawItems.length === 0 || rawItems.length > 40) {
    return res.status(400).json({
      success: false,
      error: 'Mail budget update requires 1 to 40 items',
    });
  }

  const normalizedItems = [];
  for (const rawItem of rawItems) {
    const normalized = normalizeMailBudgetConfigPatch(rawItem);
    if (!normalized.ok) {
      return res.status(400).json({
        success: false,
        error: normalized.error,
      });
    }
    normalizedItems.push({
      ...normalized.item,
      updated_by_user_id: authResult.callerUser.id,
      updated_at: new Date().toISOString(),
    });
  }

  try {
    const { data, error } = await adminClient
      .from('mail_abuse_budget_config')
      .upsert(normalizedItems, { onConflict: 'scope,event_type' })
      .select('scope, event_type, window_seconds, max_attempts, enabled, updated_at');

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      updated: (data || []).map((row) => ({
        scope: row.scope,
        eventType: row.event_type,
        windowSeconds: row.window_seconds,
        maxAttempts: row.max_attempts,
        enabled: row.enabled,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update mail budget config',
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
    case 'public-cache-bump':
      return handlePublicCacheBump(req, res, adminClient);
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
    case 'site-health':
      return handleSiteHealth(req, res, adminClient);
    case 'mail-outbox-drain':
      return handleMailOutboxDrain(req, res, adminClient);
    case 'mail-smoke-test':
      return handleMailSmokeTest(req, res, adminClient);
    case 'mail-alert':
      return handleMailAlert(req, res, adminClient);
    case 'mail-budget-config':
      return handleMailBudgetConfig(req, res, adminClient);
    case 'mail-runtime-config':
      return handleMailRuntimeConfig(req, res, adminClient);
    default:
      return res.status(400).json({
        success: false,
        error: 'Unsupported admin route',
      });
  }
}
