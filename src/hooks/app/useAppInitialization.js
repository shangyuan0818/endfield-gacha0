import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuthStore, usePoolStore, useHistoryStore } from '../../stores';
import useSiteConfigStore from '../../stores/useSiteConfigStore';
import { characterCache } from '../../utils/characterUtils';
import { DEFAULT_POOL_ID } from '../../constants';

/**
 * 应用初始化 Hook
 * 处理会话获取、last_seen 更新、characterCache 预加载
 */
export function useAppInitialization({ loadCloudData, loadPublicPools }) {
  const setUser = useAuthStore(state => state.setUser);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const setHistory = useHistoryStore(state => state.setHistory);

  // 使用 ref 存储 currentPoolId，避免将其作为 useEffect 依赖项导致循环
  const currentPoolIdRef = useRef(usePoolStore.getState().currentPoolId);

  // 订阅 currentPoolId 变化，更新 ref（不触发重渲染）
  useEffect(() => {
    const unsubscribe = usePoolStore.subscribe(
      state => state.currentPoolId,
      (newPoolId) => {
        currentPoolIdRef.current = newPoolId;
      }
    );
    return unsubscribe;
  }, []);

  // 更新用户最后在线时间
  const updateLastSeen = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.rpc('update_last_seen');
    } catch {
      // 静默失败，不影响用户体验
    }
  }, []);

  // 主初始化逻辑
  useEffect(() => {
    const initializeApp = async () => {
      if (!supabase) {
        return;
      }

      try {
        // 预加载角色缓存（确保头像数据可用）
        await characterCache.load();

        // 获取当前会话
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // 更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }

        // 站点配置用于首页和公共视图，初始化阶段优先保证它完成
        await useSiteConfigStore.getState().loadConfig();

        // 只有登录用户才加载历史记录和个人卡池数据
        if (session?.user) {
          const cloudData = await loadCloudData(session.user);
          if (cloudData && cloudData.pools.length > 0) {
            setPools(cloudData.pools);

            // 使用 ref 中的值，避免依赖项循环
            const savedPoolId = currentPoolIdRef.current;
            const hasCurrent = cloudData.pools.some(p => p.id === savedPoolId);
            const defaultPool = cloudData.pools.find(p => p.id === DEFAULT_POOL_ID);
            const fallbackId = hasCurrent
              ? savedPoolId
              : defaultPool
                ? defaultPool.id
                : cloudData.pools[0].id;
            switchPool(fallbackId);
            localStorage.setItem('gacha_current_pool_id', fallbackId);

            if (cloudData.history.length > 0) {
              setHistory(cloudData.history);
            }
          }
        } else if (typeof loadPublicPools === 'function') {
          // 未登录时也加载公共卡池数据，供首页轮换计划和倒计时使用
          await loadPublicPools();
        }
      } catch (error) {
        console.error('[useAppInitialization] 初始化失败:', error);
      }
    };

    initializeApp();

    // 监听登录状态变化
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        // 用户登录时更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [loadCloudData, loadPublicPools, updateLastSeen, setUser, setPools, switchPool, setHistory]); // 移除 currentPoolId 依赖，使用 ref 代替

  return {
    updateLastSeen
  };
}

export default useAppInitialization;
