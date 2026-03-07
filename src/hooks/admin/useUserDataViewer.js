import { useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { executeSupabaseRead } from '../../services/supabaseRequest';

/**
 * 用户数据查看器 Hook
 * 负责：加载/清理用户的卡池和抽卡记录数据
 */
export function useUserDataViewer(showToast) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userPools, setUserPools] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [expandedPools, setExpandedPools] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(null);

  // 加载用户数据
  const loadUserData = useCallback(async (userId) => {
    if (!supabase || !userId) return;

    setUserDataLoading(true);
    setSelectedUserId(userId);
    setExpandedPools(new Set());

    try {
      const [poolsRes, historyRes] = await Promise.all([
        executeSupabaseRead(
          () => supabase.from('pools').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          {
            label: 'loadUserData pools',
            retries: 1
          }
        ),
        executeSupabaseRead(
          () => supabase.from('history').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(500),
          {
            label: 'loadUserData history',
            retries: 1
          }
        )
      ]);

      if (poolsRes.error) throw poolsRes.error;
      if (historyRes.error) throw historyRes.error;

      setUserPools(poolsRes.data || []);
      setUserHistory(historyRes.data || []);
    } catch (error) {
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
    const userRecordCount = userHistory.length;
    const sixStarCount = userHistory.filter(h => h.rarity === 6).length;
    const fiveStarCount = userHistory.filter(h => h.rarity === 5).length;
    return { userPoolCount, userRecordCount, sixStarCount, fiveStarCount };
  }, [userPools, userHistory]);

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
    if (!supabase || !selectedUserId) return;
    if (!window.confirm('确定要清空该用户的所有卡池和抽卡记录吗？此操作不可恢复。')) return;

    setActionLoading('purgeUserData');

    const backupPools = [...userPools];
    const backupHistory = [...userHistory];

    setUserPools([]);
    setUserHistory([]);

    try {
      const { error: errHistory } = await supabase.from('history').delete().eq('user_id', selectedUserId);
      if (errHistory) throw errHistory;
      const { error: errPools } = await supabase.from('pools').delete().eq('user_id', selectedUserId);
      if (errPools) throw errPools;
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
    if (!supabase || !selectedUserId) return;
    if (!window.confirm('确定清空该卡池的所有抽卡记录吗？此操作不可恢复。')) return;

    setActionLoading(`purge_records_${poolId}`);

    const backupHistory = [...userHistory];
    setUserHistory(prev => prev.filter(h => h.pool_id !== poolId));

    try {
      const { error } = await supabase.from('history').delete().eq('user_id', selectedUserId).eq('pool_id', poolId);
      if (error) throw error;
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
    if (!supabase || !selectedUserId) return;
    if (!window.confirm('确定删除该卡池及其所有记录吗？此操作不可恢复。')) return;

    setActionLoading(`delete_pool_${poolId}`);

    const backupPools = [...userPools];
    const backupHistory = [...userHistory];

    setUserPools(prev => prev.filter(p => p.pool_id !== poolId));
    setUserHistory(prev => prev.filter(h => h.pool_id !== poolId));

    try {
      const { error: errHistory } = await supabase.from('history').delete().eq('user_id', selectedUserId).eq('pool_id', poolId);
      if (errHistory) throw errHistory;
      const { error: errPools } = await supabase.from('pools').delete().eq('user_id', selectedUserId).eq('pool_id', poolId);
      if (errPools) throw errPools;
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
