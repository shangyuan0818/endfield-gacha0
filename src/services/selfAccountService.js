import { supabase } from '../supabaseClient';
import { fetchWithTimeout } from './supabaseRequest';
import { getSupabaseAccessToken } from './authFetchService.js';

export async function deleteOwnAccount(currentPassword) {
  if (!supabase) {
    throw new Error('Supabase 未配置，无法注销账号');
  }

  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录态已失效，请重新登录后再试');
  }

  const response = await fetchWithTimeout('/api/self-delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      currentPassword
    })
  }, {
    label: 'self-delete-account',
    timeoutMs: 45000
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || '注销账号失败');
  }

  return result;
}

export default {
  deleteOwnAccount
};
