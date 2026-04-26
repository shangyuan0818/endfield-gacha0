import { supabase } from '../supabaseClient.js';
import { fetchWithTimeout } from './supabaseRequest.js';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
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
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return [];
  }

  const response = await fetchWithTimeout('/api/integrations/bindings/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }, {
    label: 'binding-status',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(getApiErrorMessage(result, '读取绑定状态失败'));
  }

  return result.data?.bindings || [];
}

export async function createBindingChallenge(provider) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/integrations/bindings/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/integrations/bindings/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { notified: false, reason: 'missing_access_token' };
  }

  const response = await fetchWithTimeout('/api/integrations/bot/import-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
