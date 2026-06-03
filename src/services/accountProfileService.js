import { supabase } from '../supabaseClient.js';
import { withAuthenticatedSupabaseRequest } from './authFetchService.js';
import { getPreferredUsername, normalizeUsername } from '../utils/usernameValidation.js';

function isMissingSupabaseAuthSessionError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.name === 'AuthSessionMissingError'
    || error?.code === 'session_not_found'
    || message.includes('auth session missing')
  );
}

export async function updateOwnUsername(user, nextUsername) {
  if (!supabase) {
    throw new Error('Supabase 未配置，无法修改用户名');
  }

  if (!user?.id) {
    throw new Error('当前登录态已失效，请重新登录后再试');
  }

  const normalizedUsername = normalizeUsername(nextUsername);
  const previousMetadata = {
    ...(user?.user_metadata || {}),
  };
  const previousUsername = getPreferredUsername(user);

  let authData = null;
  let authMetadataUpdated = false;
  const { data: nextAuthData, error: authError } = await supabase.auth.updateUser({
    data: {
      ...previousMetadata,
      username: normalizedUsername,
    },
  }).catch((error) => ({ data: null, error }));

  if (authError && !isMissingSupabaseAuthSessionError(authError)) {
    throw authError;
  }

  if (!authError) {
    authData = nextAuthData;
    authMetadataUpdated = true;
  }

  const { error: profileError } = await withAuthenticatedSupabaseRequest(
    () => supabase
      .from('profiles')
      .update({ username: normalizedUsername })
      .eq('id', user.id),
    { requireToken: true }
  );

  if (profileError) {
    // Best-effort rollback to avoid auth metadata/profile divergence.
    if (authMetadataUpdated) {
      await supabase.auth.updateUser({
        data: {
          ...previousMetadata,
          username: previousUsername,
        },
      }).catch(() => null);
    }
    throw profileError;
  }

  if (!authMetadataUpdated) {
    await supabase.auth.updateUser({
      data: {
        ...previousMetadata,
        username: normalizedUsername,
      },
    }).catch(() => null);
  }

  return authData?.user || {
    ...user,
    user_metadata: {
      ...previousMetadata,
      username: normalizedUsername,
    },
  };
}

export default {
  updateOwnUsername,
};
