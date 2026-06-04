import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout, fetchWithTimeout } from '../supabaseRequest';

async function getOptionalNativeToken() {
  return getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  });
}

async function buildAdminHeaders(baseHeaders = {}) {
  const token = await getOptionalNativeToken();
  const headers = {
    ...baseHeaders,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function loadAccountRecoveryRequests() {
  const headers = await buildAdminHeaders({
    Accept: 'application/json',
  });
  const { response, data } = await fetchJsonWithTimeout('/api/admin-account-recovery', {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'admin-account-recovery-load',
    timeoutMs: 45000,
    retries: 1,
  });

  if (!response.ok || data?.success !== true) {
    const error = new Error(data?.error || '加载账号恢复申请失败');
    error.status = response.status;
    error.code = 'account_recovery_load_failed';
    throw error;
  }

  return Array.isArray(data.requests) ? data.requests : [];
}

export async function updateAccountRecoveryRequest(requestId, updateData) {
  const headers = await buildAdminHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const { response, data } = await fetchJsonWithTimeout('/api/admin-account-recovery', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      requestId,
      status: updateData?.status,
      admin_note: updateData?.admin_note ?? updateData?.adminNote ?? '',
    }),
  }, {
    label: 'admin-account-recovery-update',
    timeoutMs: 45000,
  });

  if (!response.ok || data?.success !== true) {
    const error = new Error(data?.error || '更新账号恢复申请失败');
    error.status = response.status;
    error.code = 'account_recovery_update_failed';
    throw error;
  }

  return data.request || null;
}

export async function resetRecoveryRequestPassword(requestId, userId, temporaryPassword, adminNote) {
  const headers = await buildAdminHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/admin-reset-recovery-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      requestId,
      userId,
      temporaryPassword,
      adminNote
    })
  }, {
    label: 'admin-reset-recovery-password',
    timeoutMs: 45000
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '设置临时密码失败');
  }

  return result;
}
