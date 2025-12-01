import { useState, useCallback } from 'react';

/**
 * 确认对话框 Hook
 * @returns {{confirmState: Object, confirm: Function, handleConfirm: Function, handleCancel: Function}}
 */
export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    type: 'warning',
    resolve: null
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || '确认',
        message: options.message || '',
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        type: options.type || 'warning',
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.resolve?.(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState.resolve]);

  const handleCancel = useCallback(() => {
    confirmState.resolve?.(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState.resolve]);

  return { confirmState, confirm, handleConfirm, handleCancel };
};

export default useConfirm;
