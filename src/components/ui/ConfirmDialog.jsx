import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

/**
 * 确认对话框组件
 */
const ConfirmDialog = React.memo(({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const iconBg = {
    warning: 'bg-amber-100 text-amber-500',
    danger: 'bg-red-100 text-red-500',
    info: 'bg-blue-100 text-blue-500',
    success: 'bg-green-100 text-green-500'
  };

  const confirmBtnClass = {
    warning: 'bg-amber-500 hover:bg-amber-600',
    danger: 'bg-red-500 hover:bg-red-600',
    info: 'bg-blue-500 hover:bg-blue-600',
    success: 'bg-green-500 hover:bg-green-600'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
        <div className="p-6 text-center">
          <div className={`w-14 h-14 ${iconBg[type]} rounded-sm flex items-center justify-center mx-auto mb-4`}>
            {type === 'danger' && <AlertCircle size={28} />}
            {type === 'warning' && <AlertTriangle size={28} />}
            {type === 'info' && <Info size={28} />}
            {type === 'success' && <CheckCircle2 size={28} />}
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-500 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors"
          >
            {cancelText || '取消'}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold text-white ${confirmBtnClass[type]} rounded-none shadow-sm transition-all`}
          >
            {confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

export default ConfirmDialog;
