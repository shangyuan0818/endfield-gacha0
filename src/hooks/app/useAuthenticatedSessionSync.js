import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore, useHistoryStore, usePoolStore } from '../../stores';
import { applyCloudDataToStores } from '../../utils/cloudDataSync';
import appLogger from '../../utils/appLogger.js';

export function canUsePrivateCloudDataFromSiteSession(siteSession, fallbackUser = null) {
  if (siteSession?.authenticated) {
    return Boolean(siteSession.supabaseSessionSynced || siteSession.supabase?.accessToken);
  }

  return Boolean(fallbackUser);
}

export function useAuthenticatedSessionSync({ loadCloudData }) {
  const setUser = useAuthStore(state => state.setUser);
  const setAuthResolved = useAuthStore(state => state.setAuthResolved);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const setHistory = useHistoryStore(state => state.setHistory);

  const currentPoolIdRef = useRef(usePoolStore.getState().currentPoolId);
  const currentGameUidRef = useRef(usePoolStore.getState().currentGameUid);

  useEffect(() => {
    const unsubscribe = usePoolStore.subscribe(
      (state, previousState) => {
        if (state.currentPoolId !== previousState?.currentPoolId) {
          currentPoolIdRef.current = state.currentPoolId;
        }
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = usePoolStore.subscribe(
      (state, previousState) => {
        if (state.currentGameUid !== previousState?.currentGameUid) {
          currentGameUidRef.current = state.currentGameUid;
        }
      }
    );
    return unsubscribe;
  }, []);

  const applyAuthenticatedSession = useCallback(async (targetUser, {
    canLoadPrivateCloudData = true,
    source = 'auth',
    isMountedRef = { current: true },
  } = {}) => {
    if (!targetUser?.id || !isMountedRef.current) {
      return null;
    }

    setUser(targetUser);
    setAuthResolved(true);

    if (!canLoadPrivateCloudData || typeof loadCloudData !== 'function') {
      return null;
    }

    const cloudData = await loadCloudData(targetUser).catch((error) => {
      appLogger.warn?.(`[useAuthenticatedSessionSync] ${source} 云端数据加载失败:`, error);
      return null;
    });
    if (!isMountedRef.current) {
      return cloudData;
    }

    applyCloudDataToStores(cloudData, {
      setPools,
      switchPool,
      setHistory,
      preferredPoolId: currentPoolIdRef.current,
      preferredGameUid: currentGameUidRef.current
    });
    return cloudData;
  }, [loadCloudData, setAuthResolved, setHistory, setPools, setUser, switchPool]);

  const applySiteSession = useCallback(async (siteSession, {
    source = 'site_session',
    isMountedRef = { current: true },
  } = {}) => {
    if (!siteSession?.authenticated || !siteSession.user) {
      return null;
    }

    return applyAuthenticatedSession(siteSession.user, {
      canLoadPrivateCloudData: canUsePrivateCloudDataFromSiteSession(siteSession, siteSession.user),
      source,
      isMountedRef,
    });
  }, [applyAuthenticatedSession]);

  return {
    applyAuthenticatedSession,
    applySiteSession,
  };
}

export default useAuthenticatedSessionSync;
