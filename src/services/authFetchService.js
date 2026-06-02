import { supabase } from '../supabaseClient.js';
import { getCurrentSiteSession } from './siteSessionService.js';

export async function getSupabaseAccessToken({
  syncSiteSession = true,
} = {}) {
  if (!supabase) {
    return null;
  }

  if (syncSiteSession) {
    const siteSession = await getCurrentSiteSession({ syncSupabase: true }).catch(() => null);
    const siteSessionToken = siteSession?.supabase?.accessToken || null;
    if (siteSessionToken) {
      return siteSessionToken;
    }
    if (siteSession?.authenticated) {
      return null;
    }
  }

  const currentSession = await supabase.auth.getSession().catch(() => null);
  const currentToken = currentSession?.data?.session?.access_token || null;
  if (currentToken) {
    return currentToken;
  }

  return null;
}

export async function getAuthFetchHeaders(baseHeaders = {}, {
  requireToken = false,
  syncSiteSession = true,
} = {}) {
  const headers = {
    ...baseHeaders,
  };
  const accessToken = await getSupabaseAccessToken({ syncSiteSession });

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

export default {
  buildAuthenticatedFetchInit,
  getAuthFetchHeaders,
  getSupabaseAccessToken,
};
