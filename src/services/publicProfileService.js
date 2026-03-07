import { supabase } from '../supabaseClient';
import { executeSupabaseRead } from './supabaseRequest';

export async function loadPublicProfilesMap(userIds) {
  if (!supabase) return new Map();

  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('public_profiles')
      .select('id, username, role')
      .in('id', uniqueIds),
    {
      label: 'loadPublicProfilesMap',
      retries: 1
    }
  );

  if (error) {
    return new Map();
  }

  return new Map((data || []).map(profile => [profile.id, profile]));
}

export function attachPublicProfiles(items, profilesMap, userIdKey = 'user_id') {
  return (items || []).map(item => ({
    ...item,
    profiles: profilesMap.get(item[userIdKey]) || null,
  }));
}
