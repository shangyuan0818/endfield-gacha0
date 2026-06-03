import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuthStore, usePoolStore, useHistoryStore } from '../../stores';
import useSiteConfigStore from '../../stores/useSiteConfigStore';
import { characterCache } from '../../utils/characterUtils';
import appLogger from '../../utils/appLogger.js';
import { getValidatedSupabaseSession } from '../../services/authFetchService.js';
import { getCurrentSiteSession } from '../../services/siteSessionService.js';
import { subscribeAuthSessionSync } from '../../services/authSessionEvents.js';
import {
  canUsePrivateCloudDataFromSiteSession,
  useAuthenticatedSessionSync
} from './useAuthenticatedSessionSync.js';

const APP_INIT_SYNC_BUDGET_MS = import.meta.env.DEV ? 9000 : 6500;

function wait(ms) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * 应用初始化 Hook
 * 处理会话获取、last_seen 更新、characterCache 预加载
 */
export function useAppInitialization({ loadCloudData, loadPublicPools }) {
  const setUser = useAuthStore(state => state.setUser);
  const setAuthResolved = useAuthStore(state => state.setAuthResolved);
  const switchGameAccount = usePoolStore(state => state.switchGameAccount);
  const setHistory = useHistoryStore(state => state.setHistory);
  const siteSessionUserRef = useRef(null);
  const {
    applyAuthenticatedSession,
    applySiteSession,
  } = useAuthenticatedSessionSync({ loadCloudData });

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
    let isMounted = true;
    const isMountedRef = {
      get current() {
        return isMounted;
      },
    };

    const initializeApp = async () => {
      if (!supabase) {
        setAuthResolved(true);
        return;
      }

      try {
        // 预加载角色缓存（确保头像数据可用）
        await characterCache.load();

        // 获取当前会话；Supabase 本地缓存必须先经过 Auth 服务验证。
        const session = await getValidatedSupabaseSession();
        const siteSession = await getCurrentSiteSession({ syncSupabase: false }).catch(() => null);
        const effectiveUser = siteSession?.authenticated && siteSession.user
          ? siteSession.user
          : (session?.user ?? null);
        const canLoadPrivateCloudData = canUsePrivateCloudDataFromSiteSession(siteSession, effectiveUser);

        if (siteSession?.authenticated && siteSession.user) {
          siteSessionUserRef.current = siteSession.user;
        } else {
          siteSessionUserRef.current = null;
        }

        if (!isMounted) {
          return;
        }
        setUser(effectiveUser);
        setAuthResolved(true);

        // 更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }

        // 站点配置和云端数据改为“限时等待 + 后台补齐”，避免首屏被慢请求长时间阻塞
        const startupTasks = [
          useSiteConfigStore.getState().loadConfig().catch(() => null)
        ];

        // 只有登录用户才加载历史记录和个人卡池数据
        if (effectiveUser && canLoadPrivateCloudData) {
          const cloudDataPromise = applyAuthenticatedSession(effectiveUser, {
            canLoadPrivateCloudData,
            source: 'initial_session',
            isMountedRef,
          });

          startupTasks.push(cloudDataPromise);
        } else if (typeof loadPublicPools === 'function') {
          // 未登录时也加载公共卡池数据，供首页轮换计划和倒计时使用
          startupTasks.push(loadPublicPools().catch(() => null));
        }

        const startupWork = Promise.allSettled(startupTasks);
        await Promise.race([
          startupWork.then(() => 'completed'),
          wait(APP_INIT_SYNC_BUDGET_MS).then(() => 'budget-exhausted')
        ]);
      } catch (error) {
        setAuthResolved(true);
        appLogger.error('[useAppInitialization] 初始化失败:', error);
      }
    };

    initializeApp();

    const unsubscribeAuthSessionSync = subscribeAuthSessionSync((event) => {
      queueMicrotask(async () => {
        if (event?.detail?.alreadyApplied === true) {
          return;
        }
        const siteSession = await getCurrentSiteSession({ syncSupabase: false }).catch(() => null);
        if (!isMounted || !siteSession?.authenticated || !siteSession.user) {
          return;
        }
        siteSessionUserRef.current = siteSession.user;
        await applySiteSession(siteSession, {
          source: 'auth_session_sync',
          isMountedRef,
        });
      });
    });

    // 监听登录状态变化
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (!session?.user && siteSessionUserRef.current) {
            setAuthResolved(true);
          }
          return;
        }

        queueMicrotask(async () => {
          if (!isMounted) {
            return;
          }

          const verifiedSession = session?.user
            ? await getValidatedSupabaseSession()
            : null;

          if (verifiedSession?.user) {
            siteSessionUserRef.current = null;
            setUser(verifiedSession.user);
            setAuthResolved(true);
            updateLastSeen();
            await applyAuthenticatedSession(verifiedSession.user, {
              canLoadPrivateCloudData: true,
              source: 'supabase_auth_change',
              isMountedRef,
            });
            return;
          }

          setUser(null);
          setAuthResolved(true);
          setHistory([]);
          switchGameAccount(null);
          if (typeof loadPublicPools === 'function') {
            await loadPublicPools().catch(() => null);
          }
        });
      });

      return () => {
        isMounted = false;
        unsubscribeAuthSessionSync();
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
      unsubscribeAuthSessionSync();
    };
  }, [applyAuthenticatedSession, applySiteSession, loadPublicPools, updateLastSeen, setAuthResolved, setUser, switchGameAccount, setHistory]);

  return {
    updateLastSeen
  };
}

export default useAppInitialization;
