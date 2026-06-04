import { fetchWithTimeout } from '../supabaseRequest.js';
import { getSupabaseAccessToken } from '../authFetchService.js';

const SITE_CONFIG_TIMEOUT_MS = 45000;

async function buildAdminHeaders(baseHeaders = {}) {
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

export async function loadAdminSiteConfigItems() {
  const headers = await buildAdminHeaders();
  const response = await fetchWithTimeout('/api/admin?route=site-config', {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'admin-site-config-load',
    timeoutMs: SITE_CONFIG_TIMEOUT_MS,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '站点配置读取失败');
  }

  return Array.isArray(result.items) ? result.items : [];
}

export async function saveAdminSiteConfigItem({ key, value, label, category } = {}) {
  const headers = await buildAdminHeaders({
    'Content-Type': 'application/json',
  });
  const response = await fetchWithTimeout('/api/admin?route=site-config', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      key,
      value,
      label,
      category,
    }),
  }, {
    label: 'admin-site-config-save',
    timeoutMs: SITE_CONFIG_TIMEOUT_MS,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '站点配置保存失败');
  }

  return result.item || {
    key,
    value,
    label,
    category,
  };
}

export default {
  loadAdminSiteConfigItems,
  saveAdminSiteConfigItem,
};
