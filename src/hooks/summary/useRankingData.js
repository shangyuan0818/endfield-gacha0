import { useEffect, useRef, useState } from 'react';
import { getCharacterRankingStats, getUserRankingStats } from '../../services/statsService';

/**
 * 排名数据加载 Hook
 * 根据数据源和用户信息加载全服或个人排名数据
 *
 * @param {string} dataSource - 'global' | 'local'
 * @param {Object|null} user - 用户对象
 * @returns {Object} 排名数据和加载状态
 */
export function useRankingData(dataSource, user) {
  // 全服角色排名统计
  const [characterRanking, setCharacterRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  // 用户个人排名统计
  const [userRanking, setUserRanking] = useState(null);
  const [userRankingLoading, setUserRankingLoading] = useState(false);
  const hasAttemptedGlobalRankingRef = useRef(false);
  const attemptedUserRankingRef = useRef(null);
  const resolvedUserRankingRef = useRef(null);
  const globalRequestTokenRef = useRef(0);
  const userRequestTokenRef = useRef(0);

  // 加载全服角色排名统计（仅全服数据时加载，只加载一次）
  useEffect(() => {
    if (dataSource !== 'global') {
      globalRequestTokenRef.current += 1;
      hasAttemptedGlobalRankingRef.current = false;
      queueMicrotask(() => setRankingLoading(false));
      return;
    }

    if (!characterRanking && !hasAttemptedGlobalRankingRef.current) {
      const requestToken = globalRequestTokenRef.current + 1;
      globalRequestTokenRef.current = requestToken;
      hasAttemptedGlobalRankingRef.current = true;
      queueMicrotask(() => {
        setRankingLoading(true);

        getCharacterRankingStats()
          .then(data => {
            if (globalRequestTokenRef.current !== requestToken) return;
            setCharacterRanking(data);
          })
          .finally(() => {
            if (globalRequestTokenRef.current !== requestToken) return;
            setRankingLoading(false);
          });
      });
    }
  }, [dataSource, characterRanking]);

  // 加载用户个人排名统计（只加载一次）
  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (dataSource !== 'local') {
      userRequestTokenRef.current += 1;
      attemptedUserRankingRef.current = null;
      queueMicrotask(() => setUserRankingLoading(false));
      return;
    }

    if (!currentUserId) {
      userRequestTokenRef.current += 1;
      attemptedUserRankingRef.current = null;
      resolvedUserRankingRef.current = null;
      queueMicrotask(() => {
        setUserRanking(null);
        setUserRankingLoading(false);
      });
      return;
    }

    const alreadyRequestedCurrentUser = attemptedUserRankingRef.current === currentUserId;
    const alreadyResolvedCurrentUser = resolvedUserRankingRef.current === currentUserId;

    if (!alreadyRequestedCurrentUser && !(alreadyResolvedCurrentUser && userRanking)) {
      const requestToken = userRequestTokenRef.current + 1;
      userRequestTokenRef.current = requestToken;
      attemptedUserRankingRef.current = currentUserId;
      queueMicrotask(() => {
        setUserRankingLoading(true);

        getUserRankingStats(currentUserId)
          .then(data => {
            if (userRequestTokenRef.current !== requestToken) return;
            resolvedUserRankingRef.current = currentUserId;
            setUserRanking(data);
          })
          .finally(() => {
            if (userRequestTokenRef.current !== requestToken) return;
            setUserRankingLoading(false);
          });
      });
    }
  }, [dataSource, user?.id, userRanking]);

  // 当用户变更时重置个人排名
  useEffect(() => {
    userRequestTokenRef.current += 1;
    attemptedUserRankingRef.current = null;
    resolvedUserRankingRef.current = null;
    queueMicrotask(() => {
      setUserRanking(null);
      setUserRankingLoading(false);
    });
  }, [user?.id]);

  return {
    characterRanking,
    rankingLoading,
    userRanking,
    userRankingLoading
  };
}

export default useRankingData;
