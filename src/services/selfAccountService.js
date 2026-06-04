import { fetchWithTimeout } from './supabaseRequest';
import { getSupabaseAccessToken } from './authFetchService.js';

export async function deleteOwnAccount(currentPassword) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  });
  const headers = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchWithTimeout('/api/self-delete-account', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      currentPassword
    })
  }, {
    label: 'self-delete-account',
    timeoutMs: 45000
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || '注销账号失败');
  }

  return result;
}

export default {
  deleteOwnAccount
};
