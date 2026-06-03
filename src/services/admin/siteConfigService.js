import { fetchWithTimeout } from '../supabaseRequest.js';
import { getSupabaseAccessToken } from '../authFetchService.js';

const SITE_CONFIG_TIMEOUT_MS = 45000;

async function getAdminAccessToken() {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }
  return accessToken;
}

export async function loadAdminSiteConfigItems() {
  const accessToken = await getAdminAccessToken();
  const response = await fetchWithTimeout('/api/admin?route=site-config', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
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
  const accessToken = await getAdminAccessToken();
  const response = await fetchWithTimeout('/api/admin?route=site-config', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
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
