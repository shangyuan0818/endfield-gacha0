import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';

/**
 * 用户角色 Hook
 * 获取当前用户的角色和申请状态
 */
export function useUserRole() {
  const user = useAuthStore(state => state.user);
  const setUserRole = useAuthStore(state => state.setUserRole);
  const setApplicationStatus = useAppStore(state => state.setApplicationStatus);

  useEffect(() => {
    if (!supabase || !user) {
      setUserRole(null);
      setApplicationStatus(null);
      return;
    }

    const fetchUserRole = async () => {
      try {
        // 获取用户角色（使用 maybeSingle 避免无记录时报错）
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        // 如果 profile 不存在，尝试创建一个
        if (!profile) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, username: user.email?.split('@')[0], role: 'user' });
          // 创建profile失败时，依然设置默认role，不影响用户使用
          setUserRole('user');
        } else {
          setUserRole(profile.role || 'user');
        }

        // 获取申请状态（移除排序避免列名问题）
        const { data: application } = await supabase
          .from('admin_applications')
          .select('status')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        setApplicationStatus(application?.status || null);
      } catch (error) {
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, [user, setUserRole, setApplicationStatus]);
}

export default useUserRole;
