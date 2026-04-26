import { supabase } from '../../supabaseClient.js';
import { fetchWithTimeout } from '../supabaseRequest.js';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function fetchAdminRoute(route, init = {}, label = route) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout(`/api/admin?route=${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  }, {
    label,
    timeoutMs: 45000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '后台开发者接口请求失败');
  }

  return result;
}

export async function loadApiClients() {
  const result = await fetchAdminRoute('api-clients', {
    method: 'GET',
  }, 'admin-api-clients');

  return Array.isArray(result?.clients) ? result.clients : [];
}

export async function reviewApiClient(clientId, status, reviewNote = '') {
  return fetchAdminRoute('api-clients-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clientId, status, reviewNote }),
  }, 'admin-api-clients-review');
}

export async function rotateApiClientKey(clientId, label = 'rotated') {
  return fetchAdminRoute('api-clients-rotate-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clientId, label }),
  }, 'admin-api-clients-rotate-key');
}

export async function revokeApiClientKey(keyId) {
  return fetchAdminRoute('api-clients-revoke-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keyId }),
  }, 'admin-api-clients-revoke-key');
}

export async function rotateApiClientVerifier(clientId) {
  return fetchAdminRoute('api-clients-rotate-verifier', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clientId }),
  }, 'admin-api-clients-rotate-verifier');
}

export default {
  loadApiClients,
  reviewApiClient,
  rotateApiClientKey,
  revokeApiClientKey,
  rotateApiClientVerifier,
};
