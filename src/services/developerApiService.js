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

export async function loadMyDeveloperApplications() {
  const headers = await buildAuthHeaders();

  const response = await fetchWithTimeout('/api/dev/applications/me', {
    method: 'GET',
    credentials: 'same-origin',
    headers,
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
  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/dev/applications', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
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
