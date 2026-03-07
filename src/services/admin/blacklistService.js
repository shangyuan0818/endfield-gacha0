import { supabase } from '../../supabaseClient';
import { executeSupabaseRead } from '../supabaseRequest';

async function getCurrentUserId() {
  return (await supabase.auth.getUser()).data.user?.id;
}

export async function loadBlacklist() {
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('blacklist')
      .select('*')
      .order('created_at', { ascending: false }),
    {
      label: 'loadBlacklist',
      retries: 1
    }
  );

  if (error) throw error;
  return data || [];
}

export async function createBlacklistEntry(blacklistForm) {
  const createdBy = await getCurrentUserId();
  const { data, error } = await supabase
    .from('blacklist')
    .insert({
      email: blacklistForm.email,
      reason: blacklistForm.reason,
      type: blacklistForm.type,
      created_by: createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBlacklistEntry(entryId) {
  const { error } = await supabase
    .from('blacklist')
    .delete()
    .eq('id', entryId);

  if (error) throw error;
}
