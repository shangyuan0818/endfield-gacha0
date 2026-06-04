import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
} from '../supabaseRequest';
import { getSupabaseAccessToken } from '../authFetchService.js';

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

export async function loadUsers() {
  const headers = await buildAdminHeaders({
    Accept: 'application/json',
  });

  const response = await fetchWithTimeout('/api/admin-users', {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'admin-users',
    timeoutMs: 45000
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '加载用户列表失败');
  }

  return Array.isArray(result?.users) ? result.users : [];
}

export async function updateUserProfile(userId, userForm) {
  const headers = await buildAdminHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const { response, data } = await fetchJsonWithTimeout('/api/admin-users', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      userId,
      username: userForm.username,
      role: userForm.role,
    }),
  }, {
    label: 'admin-update-profile',
    timeoutMs: 45000,
  });

  if (!response.ok || data?.success !== true) {
    const error = new Error(data?.error || '更新用户失败');
    error.status = response.status;
    error.code = 'admin_update_profile_failed';
    throw error;
  }

  return data.profile;
}

export async function createUser(userForm) {
  const headers = await buildAdminHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/admin-users', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      email: userForm.email.trim(),
      password: userForm.password,
      username: userForm.username?.trim() || userForm.email.split('@')[0],
      role: userForm.role
    })
  }, {
    label: 'admin-create-user',
    timeoutMs: 45000
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || '创建用户失败');
  }

  return result;
}

export async function deleteUser(userId) {
  const headers = await buildAdminHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/admin-delete-user', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ userId })
  }, {
    label: 'admin-delete-user',
    timeoutMs: 45000
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || '删除用户失败');
  }

  return result;
}

export async function resetUserPassword(userId, temporaryPassword) {
  const headers = await buildAdminHeaders({
    'Content-Type': 'application/json',
  });

  const response = await fetchWithTimeout('/api/admin-user-reset-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      userId,
      temporaryPassword
    })
  }, {
    label: 'admin-user-reset-password',
    timeoutMs: 45000
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '重置密码失败');
  }

  return result;
}
