import { supabase } from '../../supabaseClient';
import { executeSupabaseRead, fetchWithTimeout } from '../supabaseRequest';
import { loadPublicProfilesMap } from '../publicProfileService';
import {
  getSupabaseAccessToken,
  withAuthenticatedSupabaseRequest,
} from '../authFetchService.js';

export async function loadAccountRecoveryRequests() {
  const { data, error } = await executeSupabaseRead(
    () => withAuthenticatedSupabaseRequest(
      () => supabase
        .from('account_recovery_requests')
        .select('*')
        .order('created_at', { ascending: false }),
      { requireToken: true }
    ),
    {
      label: 'loadAccountRecoveryRequests',
      retries: 1
    }
  );

  if (error) {
    throw error;
  }

  const requests = data || [];
  const handledByProfiles = await loadPublicProfilesMap(requests.map((item) => item.handled_by));

  return requests.map((item) => ({
    ...item,
    handlerProfile: handledByProfiles.get(item.handled_by) || null
  }));
}

export async function updateAccountRecoveryRequest(requestId, updateData) {
  const payload = {
    ...updateData,
    updated_at: new Date().toISOString()
  };

  if (payload.status && payload.status !== 'pending' && !payload.handled_at) {
    payload.handled_at = new Date().toISOString();
  }

  const { error } = await withAuthenticatedSupabaseRequest(
    () => supabase
      .from('account_recovery_requests')
      .update(payload)
      .eq('id', requestId),
    { requireToken: true }
  );

  if (error) {
    throw error;
  }
}

export async function resetRecoveryRequestPassword(requestId, userId, temporaryPassword, adminNote) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin-reset-recovery-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
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
