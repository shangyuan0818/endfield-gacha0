import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

const USER_DATA_TIMEOUT_MS = 45000;

async function buildAdminUserDataHeaders(extraHeaders = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  }).catch(() => null);

  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function throwAdminUserDataError(data, response, fallbackMessage, fallbackCode) {
  const error = new Error(data?.error || `${fallbackMessage} (${response.status})`);
  error.code = data?.code || fallbackCode;
  error.status = response.status;
  throw error;
}

export async function loadAdminUserData(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return {
      pools: [],
      history: [],
      historyMeta: null,
    };
  }

  const params = new URLSearchParams({
    route: 'user-data',
    userId: normalizedUserId,
  });
  const headers = await buildAdminUserDataHeaders();
  const { response, data } = await fetchJsonWithTimeout(`/api/admin?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'admin-user-data-load',
    timeoutMs: USER_DATA_TIMEOUT_MS,
    retries: 1,
  });

  if (!response.ok || data?.success !== true) {
    throwAdminUserDataError(data, response, '加载用户数据失败', 'admin_user_data_load_failed');
  }

  return {
    userId: data?.userId || normalizedUserId,
    pools: Array.isArray(data?.pools) ? data.pools : [],
    history: Array.isArray(data?.history) ? data.history : [],
    historyMeta: data?.historyMeta || null,
  };
}

export async function deleteAdminUserData({
  action,
  userId,
  poolId = '',
} = {}) {
  const normalizedAction = String(action || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const normalizedPoolId = String(poolId || '').trim();
  const headers = await buildAdminUserDataHeaders({
    'Content-Type': 'application/json',
  });

  const { response, data } = await fetchJsonWithTimeout('/api/admin?route=user-data', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      action: normalizedAction,
      userId: normalizedUserId,
      poolId: normalizedPoolId || undefined,
    }),
  }, {
    label: 'admin-user-data-delete',
    timeoutMs: USER_DATA_TIMEOUT_MS,
    retries: 0,
  });

  if (!response.ok || data?.success !== true) {
    throwAdminUserDataError(data, response, '更新用户数据失败', 'admin_user_data_update_failed');
  }

  return data;
}

export default {
  deleteAdminUserData,
  loadAdminUserData,
};
