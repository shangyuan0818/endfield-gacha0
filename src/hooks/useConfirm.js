import { useState, useCallback } from 'react';
import { useI18n } from '../i18n/index.js';

/**
 * 确认对话框 Hook
 * @returns {{confirmState: Object, confirm: Function, handleConfirm: Function, handleCancel: Function}}
 */
export const useConfirm = () => {
  const { t } = useI18n();
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
        title: options.title || t('common.confirm'),
        message: options.message || '',
        confirmText: options.confirmText || t('common.confirm'),
        cancelText: options.cancelText || t('common.cancel'),
        type: options.type || 'warning',
        resolve
      });
    });
  }, [t]);

  const handleConfirm = () => {
    confirmState.resolve?.(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    confirmState.resolve?.(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  return { confirmState, confirm, handleConfirm, handleCancel };
};

export default useConfirm;
