/**
 * 兼容层：
 * 旧的 cacheService 曾服务于已移除的「急」按钮。
 * 当前仅保留公共只读 bootstrap 的预热与可用性检测，避免旧引用再次引入私有直连链路。
 */

import { fetchWithTimeout } from './supabaseRequest';
import { preloadPublicBootstrap } from './bootstrapService';

const API_BASE = '/api/bootstrap';
const API_CHECK_TIMEOUT_MS = 18000;
const IS_LOCAL_DEV = import.meta.env.DEV;

export async function preloadStatsCache(forceRefresh = false) {
  return preloadPublicBootstrap(forceRefresh);
}

export async function checkAPIAvailability() {
  if (IS_LOCAL_DEV) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(API_BASE, {
      method: 'GET'
    }, {
      label: 'bootstrap api availability',
      timeoutMs: API_CHECK_TIMEOUT_MS
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  preloadStatsCache,
  checkAPIAvailability
};
