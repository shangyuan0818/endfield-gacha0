import { useState, useEffect } from 'react';
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

  // 加载全服角色排名统计（仅全服数据时加载，只加载一次）
  useEffect(() => {
    // 使用 ref 标记是否已经开始加载，避免重复加载
    let isMounted = true;

    if (dataSource === 'global' && !characterRanking && !rankingLoading) {
      setRankingLoading(true);
      getCharacterRankingStats()
        .then(data => {
          if (isMounted) {
            setCharacterRanking(data);
          }
        })
        .finally(() => {
          if (isMounted) {
            setRankingLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [dataSource]); // 只依赖 dataSource，避免循环

  // 加载用户个人排名统计（只加载一次）
  useEffect(() => {
    let isMounted = true;

    if (dataSource === 'local' && user?.id && !userRanking && !userRankingLoading) {
      setUserRankingLoading(true);
      getUserRankingStats(user.id)
        .then(data => {
          if (isMounted) {
            setUserRanking(data);
          }
        })
        .finally(() => {
          if (isMounted) {
            setUserRankingLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [dataSource, user?.id]); // 只依赖 dataSource 和 user.id

  // 当用户变更时重置个人排名
  useEffect(() => {
    setUserRanking(null);
  }, [user?.id]);

  return {
    characterRanking,
    rankingLoading,
    userRanking,
    userRankingLoading
  };
}

export default useRankingData;
