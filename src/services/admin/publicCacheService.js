import { supabase } from '../../supabaseClient.js';
import { fetchWithTimeout } from '../supabaseRequest.js';
import appLogger from '../../utils/appLogger.js';

const PUBLIC_CACHE_BUMP_TIMEOUT_MS = 8000;
const publicCacheWarningListeners = new Set();

export function subscribePublicCacheWarnings(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  publicCacheWarningListeners.add(listener);
  return () => {
    publicCacheWarningListeners.delete(listener);
  };
}

function notifyPublicCacheWarning(event) {
  publicCacheWarningListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      appLogger.warn('[publicCache] 公共缓存 warning 监听器失败:', {
        error: error?.message || error,
      });
    }
  });
}

function getAnalyticsRefreshWarning(analyticsRefresh) {
  if (!analyticsRefresh || typeof analyticsRefresh !== 'object') {
    return null;
  }

  if (analyticsRefresh.ok === false) {
    return analyticsRefresh.error || analyticsRefresh.warning || 'analytics_refresh_failed';
  }

  if (analyticsRefresh.partial === true) {
    return analyticsRefresh.warning || 'analytics_refresh_partial';
  }

  if (analyticsRefresh.warning) {
    return analyticsRefresh.warning;
  }

  return null;
}

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

export async function bumpPublicCache(scope = 'public', reason = 'admin') {
  if (!supabase) {
    throw new Error('Supabase 未配置，无法刷新公共缓存版本');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error('未登录或会话已过期');
  }

  const response = await fetchWithTimeout('/api/admin-public-cache-bump', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ scope, reason }),
  }, {
    label: 'admin public cache bump',
    timeoutMs: PUBLIC_CACHE_BUMP_TIMEOUT_MS,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.success !== true) {
    throw new Error(json?.error || `公共缓存刷新失败 (${response.status})`);
  }

  return json;
}

export function bumpPublicCacheBestEffort(scope = 'public', reason = 'admin') {
  return bumpPublicCache(scope, reason).catch((error) => ({
    success: false,
    error,
  }));
}

export async function invalidatePublicCache(scope = 'public', reason = 'admin') {
  const result = await bumpPublicCacheBestEffort(scope, reason);
  if (result?.success === false) {
    appLogger.warn('[publicCache] 公共缓存失效触发失败:', {
      scope,
      reason,
      error: result.error?.message || result.error,
    });
    notifyPublicCacheWarning({
      scope,
      reason,
      error: result.error?.message || result.error,
    });
    return result;
  }

  const analyticsWarning = getAnalyticsRefreshWarning(result?.analyticsRefresh);
  if (analyticsWarning) {
    appLogger.warn('[publicCache] 公共聚合刷新返回 warning:', {
      scope,
      reason,
      warning: analyticsWarning,
    });
    notifyPublicCacheWarning({
      scope,
      reason,
      analyticsRefresh: result.analyticsRefresh,
      error: analyticsWarning,
    });
  }
  return result;
}

export default {
  bumpPublicCache,
  bumpPublicCacheBestEffort,
  invalidatePublicCache,
  subscribePublicCacheWarnings,
};
