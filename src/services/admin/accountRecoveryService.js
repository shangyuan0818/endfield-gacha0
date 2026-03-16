import { supabase } from '../../supabaseClient';
import { executeSupabaseRead } from '../supabaseRequest';
import { loadPublicProfilesMap } from '../publicProfileService';

export async function loadAccountRecoveryRequests() {
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('account_recovery_requests')
      .select('*')
      .order('created_at', { ascending: false }),
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

  const { error } = await supabase
    .from('account_recovery_requests')
    .update(payload)
    .eq('id', requestId);

  if (error) {
    throw error;
  }
}
