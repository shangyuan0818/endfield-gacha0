import { useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { usePoolStore, useAuthStore } from '../../stores';

/**
 * 卡池实时订阅 Hook
 * 监听 pools 表的变化，实时更新本地状态
 */
export function usePoolRealtimeSubscription({ showToast }) {
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const setPools = usePoolStore(state => state.setPools);
  const userRole = useAuthStore(state => state.userRole);

  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // 使用 ref 存储会变化的值，避免重新订阅
  const currentPoolIdRef = useRef(currentPoolId);
  const canEditRef = useRef(canEdit);
  const isSuperAdminRef = useRef(isSuperAdmin);
  const showToastRef = useRef(showToast);

  // 更新 refs
  useEffect(() => {
    currentPoolIdRef.current = currentPoolId;
  }, [currentPoolId]);

  useEffect(() => {
    canEditRef.current = canEdit;
    isSuperAdminRef.current = isSuperAdmin;
  }, [canEdit, isSuperAdmin]);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // 订阅只在组件挂载时执行一次
  useEffect(() => {
    if (!supabase) return;

    // 订阅 pools 表的所有变化
    const channel = supabase
      .channel('pools-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // 监听所有事件：INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pools'
        },
        (payload) => {
          // 卡池数据变化监听
          if (payload.eventType === 'UPDATE') {
            // 更新本地卡池状态
            const updatedPool = payload.new;
            setPools(prev => prev.map(p => {
              if (p.id === updatedPool.pool_id) {
                return {
                  ...p,
                  locked: updatedPool.locked,
                  name: updatedPool.name,
                  type: updatedPool.type
                };
              }
              return p;
            }));

            // 如果更新的是当前卡池，显示通知（使用 ref 获取最新值）
            if (updatedPool.pool_id === currentPoolIdRef.current) {
              if (updatedPool.locked && canEditRef.current && !isSuperAdminRef.current) {
                showToastRef.current(`卡池「${updatedPool.name}」已被超级管理员锁定`, 'warning', '卡池已锁定');
              } else if (!updatedPool.locked) {
                showToastRef.current(`卡池「${updatedPool.name}」已解锁`, 'success', '卡池已解锁');
              }
            }
          } else if (payload.eventType === 'INSERT') {
            // 新增卡池（其他用户创建）
            const newPool = payload.new;
            setPools(prev => {
              // 避免重复添加
              if (prev.some(p => p.id === newPool.pool_id)) return prev;
              return [...prev, {
                id: newPool.pool_id,
                name: newPool.name,
                type: newPool.type,
                locked: newPool.locked || false,
                created_at: newPool.created_at,
                user_id: newPool.user_id
              }];
            });
          } else if (payload.eventType === 'DELETE') {
            // 删除卡池
            const deletedPool = payload.old;
            setPools(prev => prev.filter(p => p.id !== deletedPool.pool_id));
          }
        }
      )
      .subscribe();

    // 清理订阅
    return () => {
      supabase.removeChannel(channel);
    };
  }, [setPools]); // 只依赖 setPools（Zustand store 函数是稳定的）
}

export default usePoolRealtimeSubscription;
