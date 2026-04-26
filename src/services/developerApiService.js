import { supabase } from '../supabaseClient.js';
import { fetchWithTimeout } from './supabaseRequest.js';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function loadMyDeveloperApplications() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/dev/applications/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }, {
    label: 'dev-applications-me',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '加载开发者接口申请失败');
  }

  return Array.isArray(result?.data?.applications) ? result.data.applications : [];
}

export async function submitDeveloperApplication({ name, useCase }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/dev/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name,
      useCase,
      requestedScopes: ['public.read'],
    }),
  }, {
    label: 'dev-applications-create',
    timeoutMs: 30000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '提交开发者接口申请失败');
  }

  return result?.data?.application || null;
}

export default {
  loadMyDeveloperApplications,
  submitDeveloperApplication,
};
