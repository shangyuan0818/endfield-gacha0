import { supabase } from '../supabaseClient.js';
import { getPreferredUsername, normalizeUsername } from '../utils/usernameValidation.js';

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

  const { data: authData, error: authError } = await supabase.auth.updateUser({
    data: {
      ...previousMetadata,
      username: normalizedUsername,
    },
  });

  if (authError) {
    throw authError;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ username: normalizedUsername })
    .eq('id', user.id);

  if (profileError) {
    // Best-effort rollback to avoid auth metadata/profile divergence.
    await supabase.auth.updateUser({
      data: {
        ...previousMetadata,
        username: previousUsername,
      },
    }).catch(() => null);
    throw profileError;
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
