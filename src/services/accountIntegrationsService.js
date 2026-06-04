import { fetchWithTimeout } from './supabaseRequest.js';
import { getSupabaseAccessToken } from './authFetchService.js';

async function buildAuthHeaders(baseHeaders = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  });
  const headers = {
    ...baseHeaders,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function getApiErrorMessage(result, fallback) {
  if (typeof result?.error === 'string') {
    return result.error;
  }

  if (result?.error?.message) {
    return result.error.message;
  }

  return fallback;
}

export async function loadOwnBindings() {
  const headers = await buildAuthHeaders();

  const response = await fetchWithTimeout('/api/integrations/bindings/me', {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'binding-status',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    if (response.status === 401 || response.status === 403) {
      return [];
    }
    throw new Error(getApiErrorMessage(result, '读取绑定状态失败'));
  }

  return result.data?.bindings || [];
}

export async function createBindingChallenge(provider) {
  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/integrations/bindings/challenge', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ provider }),
  }, {
    label: 'binding-challenge',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(getApiErrorMessage(result, '创建绑定验证码失败'));
  }

  return result.data;
}

export async function revokeBinding(provider) {
  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/integrations/bindings/revoke', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ provider }),
  }, {
    label: 'binding-revoke',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(getApiErrorMessage(result, '解绑失败'));
  }

  return result.data;
}

export async function notifyOfficialBotImportUpdated({ summary, userInfo }) {
  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/integrations/bot/import-notify', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      summary: summary || {},
      userInfo: userInfo || {},
    }),
  }, {
    label: 'official-bot-import-notify',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    if (response.status === 401 || response.status === 403) {
      return { notified: false, reason: 'authentication_required' };
    }
    throw new Error(getApiErrorMessage(result, '通知官方 BOT 导入更新失败'));
  }

  return result.data || { notified: false, reason: 'empty_response' };
}

export default {
  loadOwnBindings,
  createBindingChallenge,
  revokeBinding,
  notifyOfficialBotImportUpdated,
};
