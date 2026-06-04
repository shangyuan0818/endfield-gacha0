import { getSupabaseAccessToken } from './authFetchService.js';
import { fetchJsonWithTimeout } from './supabaseRequest.js';

export async function updateAccountLastSeen({
  requireAuth = false,
} = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  });

  const headers = {
    Accept: 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { response, data: payload } = await fetchJsonWithTimeout('/api/account-last-seen', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'account-last-seen',
    timeoutMs: 15000,
    retries: 0,
  });

  if (!response.ok || payload?.success !== true) {
    if (!requireAuth && (response.status === 401 || response.status === 403)) {
      return {
        updated: false,
        skipped: true,
        reason: payload?.code || payload?.error || 'authentication_required',
      };
    }

    throw new Error(payload?.error || '更新最后在线时间失败');
  }

  return {
    updated: payload.updated === true,
    updatedAt: payload.updatedAt || null,
    source: payload.source || null,
  };
}

export default {
  updateAccountLastSeen,
};
