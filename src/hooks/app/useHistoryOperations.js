import { useCallback } from 'react';
import { useHistoryStore, usePoolStore, useUIStore, useAuthStore } from '../../stores';

/**
 * 历史记录操作 Hook
 * 处理历史记录的编辑、删除操作
 */
export function useHistoryOperations({
  showToast,
  cloudSync
}) {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const isSuperAdmin = userRole === 'super_admin';

  const currentPool = usePoolStore(state => state.currentPool);

  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);

  const modalState = useUIStore(state => state.modalState);
  const setModalState = useUIStore(state => state.setModalState);
  const closeModal = useUIStore(state => state.closeModal);
  const editItemState = useUIStore(state => state.editItemState);
  const setEditItemState = useUIStore(state => state.setEditItemState);

  const { saveHistoryToCloud, deleteHistoryFromCloud } = cloudSync;

  // 关闭弹窗并清理编辑状态的辅助函数
  const closeModalAndClear = useCallback(() => {
    closeModal();
    setEditItemState(null);
  }, [closeModal, setEditItemState]);

  // 编辑记录
  const handleUpdateItem = useCallback(async (id, newConfig) => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法修改数据', 'error', '操作被阻止');
      return;
    }

    // 查找要更新的记录
    const itemToUpdate = history.find(item => item.id === id);
    if (!itemToUpdate) return;

    const updatedItem = { ...itemToUpdate, ...newConfig };

    // 修复ERROR-NEW-001: 先同步到云端，成功后再更新本地状态
    if (user) {
      try {
        await saveHistoryToCloud([updatedItem]);
        // 云端保存成功，更新本地状态
        setHistory(prev => prev.map(item => item.id === id ? updatedItem : item));
        setEditItemState(null);
      } catch (error) {
        // 云端保存失败，已在saveHistoryToCloud中显示错误，不更新本地状态
      }
    } else {
      // 未登录用户，仅更新本地状态
      setHistory(prev => prev.map(item => item.id === id ? updatedItem : item));
      setEditItemState(null);
    }
  }, [currentPool?.locked, isSuperAdmin, history, user, saveHistoryToCloud, setHistory, setEditItemState, showToast]);

  // 删除单条记录 (触发弹窗)
  const handleDeleteItem = useCallback((id) => {
    setModalState({ type: 'deleteItem', data: id });
  }, [setModalState]);

  // 确认删除单条记录
  const confirmRealDeleteItem = useCallback(async () => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法删除数据', 'error', '操作被阻止');
      setModalState({ type: null, data: null });
      return;
    }

    const idToDelete = modalState.data;
    setHistory(prev => prev.filter(item => item.id !== idToDelete));
    setEditItemState(null);
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      const success = await deleteHistoryFromCloud([idToDelete]);
      if (success) {
        showToast('记录已删除并同步到云端', 'success');
      } else {
        showToast('记录已删除，但云端同步失败', 'warning');
      }
    }
  }, [currentPool?.locked, isSuperAdmin, modalState.data, user, setHistory, setEditItemState, setModalState, deleteHistoryFromCloud, showToast]);

  // 删除整组记录 (触发弹窗)
  const handleDeleteGroup = useCallback((items) => {
    setModalState({ type: 'deleteGroup', data: items });
  }, [setModalState]);

  // 确认删除整组记录
  const confirmRealDeleteGroup = useCallback(async () => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法删除数据', 'error', '操作被阻止');
      setModalState({ type: null, data: null });
      return;
    }

    const itemsToDelete = modalState.data;
    const idsToDelete = new Set(itemsToDelete.map(i => i.id));
    setHistory(prev => prev.filter(item => !idsToDelete.has(item.id)));
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      const success = await deleteHistoryFromCloud(Array.from(idsToDelete));
      if (success) {
        showToast(`已删除 ${itemsToDelete.length} 条记录并同步到云端`, 'success');
      } else {
        showToast(`已删除 ${itemsToDelete.length} 条记录，但云端同步失败`, 'warning');
      }
    }
  }, [currentPool?.locked, isSuperAdmin, modalState.data, user, setHistory, setModalState, deleteHistoryFromCloud, showToast]);

  return {
    closeModalAndClear,
    handleUpdateItem,
    handleDeleteItem,
    confirmRealDeleteItem,
    handleDeleteGroup,
    confirmRealDeleteGroup
  };
}

export default useHistoryOperations;
