import { useState, useCallback } from 'react';
import {
  deleteAdminUserData,
  loadAdminUserData,
} from '../../services/admin/userDataService.js';

const USER_HISTORY_SAMPLE_LIMIT = 500;

const EMPTY_HISTORY_META = {
  sampleLimit: USER_HISTORY_SAMPLE_LIMIT,
  totalCount: 0,
  loadedCount: 0,
  isTruncated: false
};

/**
 * 用户数据查看器 Hook
 * 负责：加载/清理用户的卡池和抽卡记录数据
 */
export function useUserDataViewer(showToast) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userPools, setUserPools] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [userHistoryMeta, setUserHistoryMeta] = useState(EMPTY_HISTORY_META);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [expandedPools, setExpandedPools] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(null);

  // 加载用户数据
  const loadUserData = useCallback(async (userId) => {
    if (!userId) return;

    setUserDataLoading(true);
    setSelectedUserId(userId);
    setExpandedPools(new Set());
    setUserHistoryMeta(EMPTY_HISTORY_META);

    try {
      const result = await loadAdminUserData(userId);
      const nextPools = result.pools || [];
      const nextHistory = result.history || [];
      const nextMeta = result.historyMeta || {};
      const totalCount = typeof nextMeta.totalCount === 'number' ? nextMeta.totalCount : nextHistory.length;

      setUserPools(nextPools);
      setUserHistory(nextHistory);
      setUserHistoryMeta({
        sampleLimit: nextMeta.sampleLimit || USER_HISTORY_SAMPLE_LIMIT,
        totalCount,
        loadedCount: nextHistory.length,
        isTruncated: Boolean(nextMeta.isTruncated ?? (totalCount > nextHistory.length))
      });
    } catch (error) {
      setUserPools([]);
      setUserHistory([]);
      setUserHistoryMeta(EMPTY_HISTORY_META);
      showToast('加载用户数据失败: ' + error.message, 'error');
    } finally {
      setUserDataLoading(false);
    }
  }, [showToast]);

  // 展开/收起卡池
  const togglePoolExpand = useCallback((poolId) => {
    setExpandedPools(prev => {
      const next = new Set(prev);
      if (next.has(poolId)) {
        next.delete(poolId);
      } else {
        next.add(poolId);
      }
      return next;
    });
  }, []);

  // 获取用户统计
  const getUserStats = useCallback(() => {
    const userPoolCount = userPools.length;
    const sixStarCount = userHistory.filter(h => h.rarity === 6).length;
    const fiveStarCount = userHistory.filter(h => h.rarity === 5).length;
    return {
      userPoolCount,
      totalRecordCount: userHistoryMeta.totalCount,
      loadedRecordCount: userHistoryMeta.loadedCount,
      sampleLimit: userHistoryMeta.sampleLimit,
      isSampleTruncated: userHistoryMeta.isTruncated,
      sixStarCount,
      fiveStarCount
    };
  }, [userPools, userHistory, userHistoryMeta]);

  // 获取卡池统计
  const getPoolStats = useCallback((poolId) => {
    const records = userHistory.filter(h => h.pool_id === poolId);
    const total = records.length;
    const sixStar = records.filter(r => r.rarity === 6).length;
    const fiveStar = records.filter(r => r.rarity === 5).length;
    const fourStar = records.filter(r => r.rarity === 4).length;
    const threeStar = records.filter(r => r.rarity === 3).length;
    return { total, sixStar, fiveStar, fourStar, threeStar };
  }, [userHistory]);

  // 获取卡池记录
  const getPoolRecords = useCallback((poolId) => {
    return userHistory.filter(h => h.pool_id === poolId);
  }, [userHistory]);

  // 清空用户所有数据
  const handleDeleteUserData = useCallback(async () => {
    if (!selectedUserId) return;
    if (!window.confirm('确定要清空该用户的所有卡池和抽卡记录吗？此操作不可恢复。')) return;

    setActionLoading('purgeUserData');

    const backupPools = [...userPools];
    const backupHistory = [...userHistory];

    setUserPools([]);
    setUserHistory([]);

    try {
      await deleteAdminUserData({
        action: 'purgeUserData',
        userId: selectedUserId,
      });
      showToast('已清空该用户的卡池和抽卡记录', 'success');
    } catch (error) {
      setUserPools(backupPools);
      setUserHistory(backupHistory);
      showToast('清理用户数据失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [selectedUserId, userPools, userHistory, showToast]);

  // 清空指定卡池的记录
  const handleDeletePoolRecords = useCallback(async (poolId) => {
    if (!selectedUserId) return;
    if (!window.confirm('确定清空该卡池的所有抽卡记录吗？此操作不可恢复。')) return;

    setActionLoading(`purge_records_${poolId}`);

    const backupHistory = [...userHistory];
    setUserHistory(prev => prev.filter(h => h.pool_id !== poolId));

    try {
      await deleteAdminUserData({
        action: 'purgePoolRecords',
        userId: selectedUserId,
        poolId,
      });
      showToast('已清空该卡池的抽卡记录', 'success');
    } catch (error) {
      setUserHistory(backupHistory);
      showToast('清理卡池记录失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [selectedUserId, userHistory, showToast]);

  // 删除卡池及其记录
  const handleDeletePool = useCallback(async (poolId) => {
    if (!selectedUserId) return;
    if (!window.confirm('确定删除该卡池及其所有记录吗？此操作不可恢复。')) return;

    setActionLoading(`delete_pool_${poolId}`);

    const backupPools = [...userPools];
    const backupHistory = [...userHistory];

    setUserPools(prev => prev.filter(p => p.pool_id !== poolId));
    setUserHistory(prev => prev.filter(h => h.pool_id !== poolId));

    try {
      await deleteAdminUserData({
        action: 'deletePool',
        userId: selectedUserId,
        poolId,
      });
      showToast('已删除卡池及其记录', 'success');
    } catch (error) {
      setUserPools(backupPools);
      setUserHistory(backupHistory);
      showToast('删除卡池失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [selectedUserId, userPools, userHistory, showToast]);

  return {
    selectedUserId,
    userPools,
    userHistory,
    userHistoryMeta,
    userDataLoading,
    expandedPools,
    actionLoading,
    loadUserData,
    togglePoolExpand,
    getUserStats,
    getPoolStats,
    getPoolRecords,
    handleDeleteUserData,
    handleDeletePoolRecords,
    handleDeletePool,
  };
}

export default useUserDataViewer;
