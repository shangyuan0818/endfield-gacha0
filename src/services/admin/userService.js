import { supabase } from '../../supabaseClient';
import {
  executeSupabaseRead,
  executeSupabaseRpc,
  fetchWithTimeout,
} from '../supabaseRequest';

export const ADMIN_PROFILE_FIELDS = 'id, username, email, role, created_at, updated_at, last_seen_at';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

export async function loadUsers() {
  const { data, error } = await executeSupabaseRead(
    () => supabase.from('profiles').select(ADMIN_PROFILE_FIELDS),
    {
      label: 'loadUsers',
      retries: 1
    }
  );
  if (error) throw error;
  return data || [];
}

export async function updateUserProfile(userId, userForm) {
  const { error, data } = await executeSupabaseRpc(
    () => supabase.rpc('admin_update_profile', {
      p_target_user_id: userId,
      p_username: userForm.username,
      p_role: userForm.role,
    }),
    {
      label: 'admin_update_profile'
    }
  );

  if (error) throw error;
  return data;
}

export async function createUser(userForm) {
  const accessToken = await getAccessToken();
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
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(`${supabase.supabaseUrl}/functions/v1/admin-delete-user`, {
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
