import { useCallback, useMemo } from 'react';
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
  const setSyncing = useAuthStore(state => state.setSyncing);

  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const createPool = usePoolStore(state => state.createPool);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const updatePool = usePoolStore(state => state.updatePool);

  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);

  const modalState = useUIStore(state => state.modalState);
  const setModalState = useUIStore(state => state.setModalState);

  const {
    savePoolToCloud,
    deletePoolFromCloud,
    deletePoolHistoryFromCloud,
    deleteUserDataFromCloud,
    loadPublicPools
  } = cloudSync;

  const isSuperAdmin = userRole === 'super_admin';
  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);

  // 创建卡池
  const confirmCreatePool = useCallback(async (poolForm) => {
    const name = poolForm?.name?.trim();
    if (!name) return;

    const type = poolForm?.type || 'limited';
    const isLimitedWeapon = type === 'weapon' ? poolForm?.isLimitedWeapon !== false : undefined;
    const newId = 'pool_' + Date.now();
    const newPoolDraft = {
      id: newId,
      name,
      type,
      locked: false,
      user_id: user?.id,
      isLimitedWeapon
    };

    const validation = validatePoolData(newPoolDraft);
    if (!validation.isValid) {
      showToast(`卡池创建失败: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    const newPool = createPool(newPoolDraft);
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
  }, [user, createPool, switchPool, setModalState, savePoolToCloud, showToast]);

  // 确认编辑卡池
  const confirmEditPool = useCallback(async (poolForm) => {
    const targetPool = modalState.data;
    const name = poolForm?.name?.trim();
    if (!name || !targetPool) return;

    const type = poolForm?.type || targetPool.type || 'standard';
    const isLimitedWeapon = type === 'weapon' ? poolForm?.isLimitedWeapon !== false : undefined;
    const updatedPool = {
      ...targetPool,
      name,
      type,
      isLimitedWeapon
    };

    updatePool(targetPool.id, {
      name,
      type,
      isLimitedWeapon
    });
    setModalState({ type: null, data: null });

    if (user) {
      await savePoolToCloud(updatedPool);
    }
  }, [modalState.data, user, updatePool, setModalState, savePoolToCloud]);

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
      const nextHistory = (Array.isArray(history) ? history : []).filter((item) => (
        item?.user_id && item.user_id !== user.id
      ));

      const refreshedPublicPools = await deleteUserDataFromCloud()
        .then(() => loadPublicPools?.())
        .catch((error) => {
          throw error;
        });

      const fallbackPools = poolsArray.filter((pool) => pool?.user_id !== user.id);
      const nextPools = Array.isArray(refreshedPublicPools) ? refreshedPublicPools : fallbackPools;

      setHistory(nextHistory);
      setPools(nextPools);

      if (!nextPools.some((pool) => pool?.id === currentPoolId)) {
        switchPool(nextPools[0]?.id || null);
      }

      showToast('我的抽卡数据已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [
    currentPoolId,
    deleteUserDataFromCloud,
    history,
    loadPublicPools,
    poolsArray,
    setHistory,
    setPools,
    setSyncing,
    showToast,
    switchPool,
    user
  ]);

  return {
    confirmCreatePool,
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
