import { supabase } from '../../supabaseClient';
import {
  executeSupabaseRpc,
  fetchWithTimeout,
} from '../supabaseRequest';
import {
  getSupabaseAccessToken,
  withAuthenticatedSupabaseRequest,
} from '../authFetchService.js';

export async function loadUsers() {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin-users', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
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
  const { error, data } = await executeSupabaseRpc(
    () => withAuthenticatedSupabaseRequest(
      () => supabase.rpc('admin_update_profile', {
        p_target_user_id: userId,
        p_username: userForm.username,
        p_role: userForm.role,
      }),
      { requireToken: true }
    ),
    {
      label: 'admin_update_profile'
    }
  );

  if (error) throw error;
  return data;
}

export async function createUser(userForm) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout(`${supabase.supabaseUrl}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
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
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin-delete-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
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
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin-user-reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
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
