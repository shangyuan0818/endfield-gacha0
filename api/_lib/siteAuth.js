import { createSupabaseAccessTokenClient, getBearerToken, getSupabaseAdminClient } from './authAdmin.js';
import { createSupabaseCompatAccessToken, loadSiteSession } from './siteSession.js';

export async function resolveAuthenticatedRequestUser(req, {
  adminClient = getSupabaseAdminClient(),
  touch = true,
} = {}) {
  const siteSession = adminClient
    ? await loadSiteSession(adminClient, {
      req,
      touch,
    }).catch(() => null)
    : null;

  if (siteSession?.authenticated && siteSession.user?.id) {
    const compatToken = createSupabaseCompatAccessToken({
      user: siteSession.user,
      profile: siteSession.profile || null,
      sessionId: siteSession.session?.id || '',
    });

    return {
      ok: true,
      source: 'site_session',
      user: siteSession.user,
      profile: siteSession.profile || null,
      session: siteSession.session || null,
      identities: siteSession.identities || [],
      accessToken: compatToken?.accessToken || null,
      adminClient,
    };
  }

  const token = getBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: adminClient ? 401 : 503,
      error: adminClient ? 'Missing access token' : 'Auth service not configured',
      code: adminClient ? 'missing_access_token' : 'auth_service_not_configured',
    };
  }

  const callerClient = createSupabaseAccessTokenClient(token);
  if (!callerClient?.auth) {
    return {
      ok: false,
      status: 503,
      error: 'Auth service not configured',
      code: 'auth_service_not_configured',
    };
  }

  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      ok: false,
      status: 401,
      error: userError?.message || 'Invalid access token',
      code: 'invalid_access_token',
    };
  }

  return {
    ok: true,
    source: 'supabase',
    user: userData.user,
    profile: null,
    session: null,
    identities: [],
    adminClient: adminClient || null,
    callerClient,
    accessToken: token,
  };
}

export async function requireSuperAdminUser(req, {
  adminClient = getSupabaseAdminClient(),
  touch = true,
} = {}) {
  const authResult = await resolveAuthenticatedRequestUser(req, {
    adminClient,
    touch,
  });

  if (!authResult.ok) {
    return authResult;
  }

  if (!authResult.adminClient) {
    return {
      ok: false,
      status: 503,
      error: 'Auth service not configured',
      code: 'auth_service_not_configured',
    };
  }

  const { data: profile, error: profileError } = await authResult.adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', authResult.user.id)
    .single();

  if (profileError) {
    return {
      ok: false,
      status: 500,
      error: profileError.message || 'Failed to load caller profile',
      code: 'profile_load_failed',
    };
  }

  if (profile?.role !== 'super_admin') {
    return {
      ok: false,
      status: 403,
      error: 'Super admin role required',
      code: 'super_admin_required',
    };
  }

  return {
    ...authResult,
    profile,
  };
}

export default {
  requireSuperAdminUser,
  resolveAuthenticatedRequestUser,
};
