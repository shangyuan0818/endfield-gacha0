import { supabase } from '../supabaseClient.js';
import { getCurrentSiteSession } from './siteSessionService.js';

async function clearInvalidSupabaseSession() {
  await supabase?.auth?.signOut?.({ scope: 'local' }).catch(() => null);
}

export async function getValidatedSupabaseSession() {
  if (!supabase) {
    return null;
  }

  const currentSession = await supabase.auth.getSession().catch(() => null);
  const nativeSession = currentSession?.data?.session || null;
  const accessToken = nativeSession?.access_token || '';
  const sessionUserId = nativeSession?.user?.id || '';
  if (!accessToken || !sessionUserId) {
    return null;
  }

  const userResult = await supabase.auth.getUser(accessToken).catch((error) => ({
    error,
    data: null,
  }));
  const verifiedUser = userResult?.data?.user || null;
  if (userResult?.error || !verifiedUser?.id || verifiedUser.id !== sessionUserId) {
    await clearInvalidSupabaseSession();
    return null;
  }

  return {
    ...nativeSession,
    user: verifiedUser,
  };
}

export async function getSupabaseAccessToken({
  syncSiteSession = true,
  useSiteSessionCache = true,
  allowSiteSessionToken = true,
} = {}) {
  if (!supabase) {
    return null;
  }

  const nativeSession = await getValidatedSupabaseSession();
  if (nativeSession?.access_token) {
    return nativeSession.access_token;
  }

  if (syncSiteSession) {
    const siteSession = await getCurrentSiteSession({
      syncSupabase: false,
      useCache: useSiteSessionCache,
    }).catch(() => null);
    const siteSessionToken = allowSiteSessionToken ? siteSession?.supabase?.accessToken || null : null;
    if (siteSessionToken) {
      return siteSessionToken;
    }
    if (siteSession?.authenticated) {
      return null;
    }
  }

  return null;
}

export async function getAuthFetchHeaders(baseHeaders = {}, {
  requireToken = false,
  syncSiteSession = true,
  useSiteSessionCache = true,
  allowSiteSessionToken = true,
} = {}) {
  const headers = {
    ...baseHeaders,
  };
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession,
    useSiteSessionCache,
    allowSiteSessionToken,
  });

  if (accessToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (requireToken && !accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  return {
    headers,
    accessToken,
  };
}

export async function buildAuthenticatedFetchInit(init = {}, options = {}) {
  const { headers } = await getAuthFetchHeaders(init.headers || {}, options);
  return {
    ...init,
    credentials: init.credentials || 'same-origin',
    headers,
  };
}

export async function withAuthenticatedSupabaseRequest(buildRequest, options = {}) {
  const { accessToken } = await getAuthFetchHeaders({}, options);
  let request = await buildRequest();

  if (accessToken && typeof request?.setHeader === 'function') {
    request = request.setHeader('Authorization', `Bearer ${accessToken}`);
  }

  return request;
}

export async function getCurrentAuthenticatedUser({
  requireUser = false,
  syncSiteSession = true,
  useSiteSessionCache = true,
} = {}) {
  if (syncSiteSession) {
    const siteSession = await getCurrentSiteSession({
      syncSupabase: true,
      useCache: useSiteSessionCache,
    }).catch(() => null);
    if (siteSession?.authenticated && siteSession.user) {
      return siteSession.user;
    }
    if (siteSession?.authenticated) {
      if (requireUser) {
        throw new Error('请先登录');
      }
      return null;
    }
  }

  const nativeSession = await getValidatedSupabaseSession();
  const user = nativeSession?.user || null;

  if (requireUser && !user) {
    throw new Error('请先登录');
  }

  return user;
}

export default {
  buildAuthenticatedFetchInit,
  getAuthFetchHeaders,
  getCurrentAuthenticatedUser,
  getSupabaseAccessToken,
  getValidatedSupabaseSession,
  withAuthenticatedSupabaseRequest,
};
