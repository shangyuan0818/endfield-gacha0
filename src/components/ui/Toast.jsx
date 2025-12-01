import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Toast 通知组件
 */
const Toast = React.memo(({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-4 rounded-none shadow-lg border backdrop-blur-sm animate-slide-in
            ${toast.type === 'success' ? 'bg-green-50/95 border-green-200 text-green-800' : ''}
            ${toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' : ''}
            ${toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-800' : ''}
            ${toast.type === 'info' ? 'bg-blue-50/95 border-blue-200 text-blue-800' : ''}
          `}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
            {toast.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
            {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-500" />}
            {toast.type === 'info' && <Info size={20} className="text-blue-500" />}
          </div>
          <div className="flex-1 min-w-0">
            {toast.title && <p className="font-bold text-sm mb-0.5">{toast.title}</p>}
            <p className="text-sm whitespace-pre-wrap">{toast.message}</p>
          </div>
          <button
            onClick={() => onRemove(toast.id)}
            className="shrink-0 p-1 hover:bg-black/5 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
});

Toast.displayName = 'Toast';

export default Toast;
