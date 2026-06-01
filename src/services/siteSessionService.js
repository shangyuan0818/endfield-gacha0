import { supabase } from '../supabaseClient.js';
import { fetchJsonWithTimeout } from './supabaseRequest.js';

function buildSupabaseSessionPayload(payload) {
  const accessToken = payload?.supabase?.accessToken;
  const user = payload?.user;
  if (!accessToken || !user?.id) {
    return null;
  }

  return {
    access_token: accessToken,
    token_type: payload.supabase.tokenType || 'bearer',
    expires_in: payload.supabase.expiresIn || 3600,
    expires_at: payload.supabase.expiresAt || Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `site_session_${payload?.session?.id || user.id}`,
    user,
  };
}

export async function syncSiteSessionToSupabase(payload) {
  const sessionPayload = buildSupabaseSessionPayload(payload);
  if (!supabase || !sessionPayload) {
    return false;
  }

  try {
    const { error } = await supabase.auth.setSession(sessionPayload);
    return !error;
  } catch {
    return false;
  }
}

export async function bootstrapSiteSessionFromSupabaseToken(accessToken = '') {
  if (!supabase) {
    return {
      bootstrapped: false,
      authenticated: false,
      source: null,
    };
  }

  const token = String(accessToken || '').trim();
  if (!token) {
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    const currentToken = sessionResult?.data?.session?.access_token || '';
    if (!currentToken) {
      return {
        bootstrapped: false,
        authenticated: false,
        source: null,
      };
    }
    return bootstrapSiteSessionFromSupabaseToken(currentToken);
  }

  const { response, data } = await fetchJsonWithTimeout('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, {
    label: 'auth-session-bootstrap',
    timeoutMs: 15000,
    retries: 0,
  });

  if (!response.ok || data?.success !== true) {
    return {
      bootstrapped: false,
      authenticated: false,
      source: null,
      error: data?.error || data?.message || 'auth_session_bootstrap_failed',
    };
  }

  return {
    bootstrapped: data?.data?.bootstrapped === true,
    authenticated: true,
    source: data?.data?.source || 'supabase',
  };
}

export async function getCurrentSiteSession({
  syncSupabase = true,
} = {}) {
  const { response, data } = await fetchJsonWithTimeout('/api/auth/session', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
  }, {
    label: 'auth-session',
    timeoutMs: 15000,
    retries: 0,
  });

  if (!response.ok || data?.success !== true || data?.authenticated !== true) {
    return {
      authenticated: false,
      user: null,
      profile: null,
      identities: [],
      supabaseSessionSynced: false,
    };
  }

  const payload = data.data || {};
  const supabaseSessionSynced = syncSupabase
    ? await syncSiteSessionToSupabase(payload)
    : false;

  return {
    authenticated: true,
    user: payload.user || null,
    profile: payload.profile || null,
    identities: Array.isArray(payload.identities) ? payload.identities : [],
    session: payload.session || null,
    supabase: payload.supabase || null,
    supabaseSessionSynced,
  };
}

export async function logoutSiteSession() {
  try {
    await fetchJsonWithTimeout('/api/auth/session/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, {
      label: 'auth-session-logout',
      timeoutMs: 10000,
      retries: 0,
    });
  } catch {
    // Supabase sign-out and local state cleanup should still continue.
  }
}

export default {
  bootstrapSiteSessionFromSupabaseToken,
  getCurrentSiteSession,
  logoutSiteSession,
  syncSiteSessionToSupabase,
};
