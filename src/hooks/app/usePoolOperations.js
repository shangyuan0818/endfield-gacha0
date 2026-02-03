import { useCallback } from 'react';
import { useHistoryStore, usePoolStore, useUIStore, useAuthStore } from '../../stores';
import { validatePoolData } from '../../utils';

/**
 * 卡池操作 Hook
 * 处理卡池的创建、编辑、删除、锁定等操作
 */
export function usePoolOperations({
  showToast,
  cloudSync
}) {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const isSuperAdmin = userRole === 'super_admin';

  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);

  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);

  const modalState = useUIStore(state => state.modalState);
  const setModalState = useUIStore(state => state.setModalState);
  const newPoolNameInput = useUIStore(state => state.newPoolNameInput);
  const newPoolTypeInput = useUIStore(state => state.newPoolTypeInput);
  const isLimitedWeaponPool = useUIStore(state => state.isLimitedWeaponPool);
  const setNewPoolNameInput = useUIStore(state => state.setNewPoolNameInput);
  const setNewPoolTypeInput = useUIStore(state => state.setNewPoolTypeInput);
  const setIsLimitedWeaponPool = useUIStore(state => state.setIsLimitedWeaponPool);
  const setSyncing = useUIStore(state => state.setSyncing);

  const { savePoolToCloud, deletePoolFromCloud, deletePoolHistoryFromCloud } = cloudSync;

  const poolsArray = Array.isArray(pools) ? pools : [];

  // 创建卡池
  const confirmCreatePool = useCallback(async () => {
    if (!newPoolNameInput.trim()) return;
    const newId = 'pool_' + Date.now();
    const newPool = {
      id: newId,
      name: newPoolNameInput.trim(),
      type: newPoolTypeInput,
      locked: false,
      user_id: user?.id,
      isLimitedWeapon: newPoolTypeInput === 'weapon' ? isLimitedWeaponPool : undefined
    };

    const validation = validatePoolData(newPool);
    if (!validation.isValid) {
      showToast(`卡池创建失败: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    setPools(prev => [...prev, newPool]);
    switchPool(newId);
    setModalState({ type: null, data: null });

    if (user) {
      const success = await savePoolToCloud(newPool, true);
      if (success) {
        showToast(`卡池「${newPool.name}」已创建并同步到云端`, 'success');
      } else {
        showToast(`卡池「${newPool.name}」已创建，但同步到云端失败`, 'warning');
      }
    } else {
      showToast(`卡池「${newPool.name}」已创建（本地）`, 'success');
    }
  }, [newPoolNameInput, newPoolTypeInput, isLimitedWeaponPool, user, setPools, switchPool, setModalState, savePoolToCloud, showToast]);

  // 打开编辑卡池弹窗
  const openEditPoolModal = useCallback((e, pool) => {
    e.stopPropagation();
    setNewPoolNameInput(pool.name);
    setNewPoolTypeInput(pool.type || 'standard');
    setIsLimitedWeaponPool(pool.isLimitedWeapon !== false);
    setModalState({ type: 'editPool', data: pool });
  }, [setNewPoolNameInput, setNewPoolTypeInput, setIsLimitedWeaponPool, setModalState]);

  // 确认编辑卡池
  const confirmEditPool = useCallback(async () => {
    if (!newPoolNameInput.trim() || !modalState.data) return;

    const updatedPool = {
      id: modalState.data.id,
      name: newPoolNameInput.trim(),
      type: newPoolTypeInput,
      locked: modalState.data.locked || false,
      created_at: modalState.data.created_at || null,
      user_id: modalState.data.user_id || null,
      creator_username: modalState.data.creator_username || null,
      isLimitedWeapon: newPoolTypeInput === 'weapon' ? isLimitedWeaponPool : undefined
    };

    setPools(prev => prev.map(p => p.id === modalState.data.id ? updatedPool : p));
    setModalState({ type: null, data: null });

    if (user) {
      await savePoolToCloud(updatedPool);
    }
  }, [newPoolNameInput, newPoolTypeInput, isLimitedWeaponPool, modalState.data, user, setPools, setModalState, savePoolToCloud]);

  // 切换卡池锁定状态（仅超管可用）
  const togglePoolLock = useCallback(async (poolId) => {
    if (!isSuperAdmin) return;

    const pool = poolsArray.find(p => p.id === poolId);
    if (!pool) return;

    const updatedPool = { ...pool, locked: !pool.locked };

    setPools(prev => prev.map(p => p.id === poolId ? updatedPool : p));

    if (user) {
      await savePoolToCloud(updatedPool);
    }

    showToast(
      updatedPool.locked ? `卡池「${pool.name}」已锁定` : `卡池「${pool.name}」已解锁`,
      updatedPool.locked ? 'warning' : 'success'
    );
  }, [isSuperAdmin, poolsArray, user, setPools, savePoolToCloud, showToast]);

  // 打开删除卡池确认弹窗
  const openDeletePoolModal = useCallback((pool) => {
    setModalState({ type: 'deletePool', data: pool });
  }, [setModalState]);

  // 确认删除卡池（包括所有记录）
  const confirmDeletePool = useCallback(async () => {
    const poolToDelete = modalState.data;
    if (!poolToDelete) return;

    const poolId = poolToDelete.id;
    const poolName = poolToDelete.name;

    setHistory(prev => prev.filter(item => item.poolId !== poolId));
    setPools(prev => prev.filter(p => p.id !== poolId));

    if (currentPoolId === poolId) {
      const remainingPools = poolsArray.filter(p => p.id !== poolId);
      if (remainingPools.length > 0) {
        switchPool(remainingPools[0].id);
      }
    }

    setModalState({ type: null, data: null });

    if (user) {
      const historySuccess = await deletePoolHistoryFromCloud(poolId);
      const poolSuccess = await deletePoolFromCloud(poolId);

      if (historySuccess && poolSuccess) {
        showToast(`卡池「${poolName}」已删除并同步到云端`, 'success');
      } else {
        showToast(`卡池「${poolName}」已删除，但云端同步失败`, 'warning');
      }
    } else {
      showToast(`卡池「${poolName}」已删除`, 'success');
    }
  }, [modalState.data, currentPoolId, poolsArray, user, setHistory, setPools, switchPool, setModalState, deletePoolHistoryFromCloud, deletePoolFromCloud, showToast]);

  // 打开删除当前卡池数据确认弹窗
  const openDeleteConfirmModal = useCallback(() => {
    const currentPoolName = poolsArray.find(p => p.id === currentPoolId)?.name;
    setModalState({ type: 'deleteConfirm', data: { poolName: currentPoolName } });
  }, [poolsArray, currentPoolId, setModalState]);

  // 确认删除当前卡池数据
  const confirmDeleteData = useCallback(async () => {
    setHistory(prev => prev.filter(item => item.poolId !== currentPoolId));
    setModalState({ type: null, data: null });

    if (user) {
      await deletePoolHistoryFromCloud(currentPoolId);
    }
  }, [currentPoolId, user, setHistory, setModalState, deletePoolHistoryFromCloud]);

  // 删除当前账号的所有卡池数据（设置页面使用）
  const deleteAllUserData = useCallback(async () => {
    if (!user) return;

    try {
      setSyncing(true);

      for (const pool of pools) {
        await deletePoolHistoryFromCloud(pool.id);
        await deletePoolFromCloud(pool.id);
      }

      setPools([]);
      setHistory([]);

      showToast('所有数据已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [user, pools, setSyncing, deletePoolHistoryFromCloud, deletePoolFromCloud, setPools, setHistory, showToast]);

  return {
    confirmCreatePool,
    openEditPoolModal,
    confirmEditPool,
    togglePoolLock,
    openDeletePoolModal,
    confirmDeletePool,
    openDeleteConfirmModal,
    confirmDeleteData,
    deleteAllUserData
  };
}

export default usePoolOperations;
