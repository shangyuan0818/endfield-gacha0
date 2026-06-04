import {
  ensureProfileForAuthUser,
  getSupabaseAdminClient,
  loadAuthUserById,
} from '../../_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { resolveAuthenticatedRequestUser } from '../../_lib/siteAuth.js';
import {
  getUsernameValidationCode,
  normalizeUsername,
} from '../../../src/utils/usernameValidation.js';

const PROFILE_FIELDS = 'id, username, email, role, created_at, updated_at, last_seen_at';

function sendError(res, status, error, code = error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function toClientProfile(profile) {
  return {
    id: profile?.id || null,
    username: profile?.username || '',
    email: profile?.email || null,
    role: profile?.role || 'user',
    created_at: profile?.created_at || null,
    updated_at: profile?.updated_at || null,
    last_seen_at: profile?.last_seen_at || null,
  };
}

function mergeUserWithProfile(user, profile) {
  if (!user?.id) {
    return null;
  }

  const username = profile?.username || user?.user_metadata?.username || '';
  const email = profile?.email || user?.email || null;
  return {
    ...user,
    email,
    profile_role: profile?.role || user?.profile_role || 'user',
    user_metadata: {
      ...(user?.user_metadata || {}),
      username,
      display_name: username,
    },
  };
}

async function resolveCurrentProfile(req, adminClient) {
  const authResult = await resolveAuthenticatedRequestUser(req, {
    adminClient,
    touch: true,
  });

  if (!authResult.ok) {
    return {
      ok: false,
      status: authResult.status || 401,
      error: authResult.error || 'Authentication required',
      code: authResult.code || 'authentication_required',
    };
  }

  const authUser = authResult.source === 'site_session'
    ? authResult.user
    : await loadAuthUserById(adminClient, authResult.user.id).catch(() => authResult.user);
  const profile = await ensureProfileForAuthUser(
    adminClient,
    authUser || authResult.user,
    authResult.profile || null
  );

  return {
    ok: true,
    authResult,
    authUser: authUser || authResult.user,
    profile,
  };
}

async function updateProfileUsername(adminClient, userId, normalizedUsername) {
  const { data, error } = await adminClient
    .from('profiles')
    .update({ username: normalizedUsername })
    .eq('id', userId)
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data || null;
}

async function syncAuthUsername(adminClient, userId, authUser, normalizedUsername) {
  const updateUserById = adminClient?.auth?.admin?.updateUserById;
  if (typeof updateUserById !== 'function') {
    return { attempted: false, ok: false, code: 'auth_admin_update_unavailable' };
  }

  const metadata = authUser?.user_metadata || authUser?.raw_user_meta_data || {};
  const { data, error } = await updateUserById.call(adminClient.auth.admin, userId, {
    user_metadata: {
      ...metadata,
      username: normalizedUsername,
      display_name: normalizedUsername,
    },
  });

  if (error) {
    return {
      attempted: true,
      ok: false,
      code: error.code || 'auth_metadata_update_failed',
    };
  }

  return {
    attempted: true,
    ok: true,
    user: data?.user || data || null,
  };
}

export default async function accountProfileHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, PATCH, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PATCH');
    return sendError(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return sendError(res, 503, 'Auth service not configured', 'auth_service_not_configured');
  }

  try {
    const current = await resolveCurrentProfile(req, adminClient);
    if (!current.ok) {
      return sendError(res, current.status, current.error, current.code);
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        source: current.authResult.source || 'unknown',
        profile: toClientProfile(current.profile),
        user: mergeUserWithProfile(current.authResult.user, current.profile),
      });
    }

    const body = parseRequestBody(req);
    const normalizedUsername = normalizeUsername(body.username);
    const validationCode = getUsernameValidationCode(normalizedUsername, { required: true });
    if (validationCode) {
      return sendError(res, 400, 'Invalid username', validationCode);
    }

    const profile = await updateProfileUsername(
      adminClient,
      current.authResult.user.id,
      normalizedUsername
    );
    const metadataSync = await syncAuthUsername(
      adminClient,
      current.authResult.user.id,
      current.authUser,
      normalizedUsername
    );
    const nextUser = mergeUserWithProfile(
      metadataSync.user || current.authResult.user,
      profile
    );

    return res.status(200).json({
      success: true,
      source: current.authResult.source || 'unknown',
      profile: toClientProfile(profile),
      user: nextUser,
      metadataSync: {
        attempted: metadataSync.attempted === true,
        ok: metadataSync.ok === true,
        code: metadataSync.ok ? null : metadataSync.code || null,
      },
    });
  } catch (error) {
    return sendError(
      res,
      500,
      error?.message || 'Failed to load account profile',
      error?.code || 'account_profile_failed'
    );
  }
}
