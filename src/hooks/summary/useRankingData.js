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

  // 加载全服角色排名统计（仅全服数据时加载）
  useEffect(() => {
    if (dataSource === 'global' && !characterRanking && !rankingLoading) {
      setRankingLoading(true);
      getCharacterRankingStats()
        .then(data => {
          setCharacterRanking(data);
        })
        .finally(() => {
          setRankingLoading(false);
        });
    }
  }, [dataSource, characterRanking, rankingLoading]);

  // 加载用户个人排名统计
  useEffect(() => {
    if (dataSource === 'local' && user?.id && !userRanking && !userRankingLoading) {
      setUserRankingLoading(true);
      getUserRankingStats(user.id)
        .then(data => {
          setUserRanking(data);
        })
        .finally(() => {
          setUserRankingLoading(false);
        });
    }
  }, [dataSource, user, userRanking, userRankingLoading]);

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
