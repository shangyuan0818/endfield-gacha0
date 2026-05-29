import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, Clipboard } from 'lucide-react';

const TOAST_STYLES = {
  success: {
    shell: 'bg-green-50/95 border-green-200 text-green-800',
    icon: 'text-green-500',
    action: 'border-green-200 text-green-800 hover:bg-green-100',
    primary: 'bg-green-600 text-white hover:bg-green-700 border-green-600',
  },
  error: {
    shell: 'bg-red-50/95 border-red-200 text-red-800',
    icon: 'text-red-500',
    action: 'border-red-200 text-red-800 hover:bg-red-100',
    primary: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
  },
  warning: {
    shell: 'bg-amber-50/95 border-amber-200 text-amber-800',
    icon: 'text-amber-500',
    action: 'border-amber-200 text-amber-800 hover:bg-amber-100',
    primary: 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600',
  },
  info: {
    shell: 'bg-blue-50/95 border-blue-200 text-blue-800',
    icon: 'text-blue-500',
    action: 'border-blue-200 text-blue-800 hover:bg-blue-100',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
  },
};

async function copyText(text) {
  if (!text) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.cssText = 'position: fixed; left: -9999px; top: -9999px; opacity: 0;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    textarea.remove();
    return success;
  } catch {
    return false;
  }
}

function ToastIcon({ type, className }) {
  if (type === 'success') return <CheckCircle2 size={20} className={className} />;
  if (type === 'error') return <AlertCircle size={20} className={className} />;
  if (type === 'warning') return <AlertTriangle size={20} className={className} />;
  return <Info size={20} className={className} />;
}

function ToastAction({ action, style, onRemove, toastId }) {
  const className = `inline-flex items-center justify-center border px-2.5 py-1 text-xs font-bold transition-colors ${
    action.variant === 'primary' ? style.primary : style.action
  }`;

  const handleClick = (event) => {
    if (!action.href) {
      event.preventDefault();
    }
    if (action.onClick) {
      action.onClick(event);
    }
    if (action.dismissOnClick) {
      onRemove(toastId);
    }
  };

  if (action.href) {
    return (
      <a className={className} href={action.href} onClick={handleClick}>
        {action.label}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {action.label}
    </button>
  );
}

/**
 * Toast 通知组件
 */
const Toast = React.memo(({ toasts, onRemove }) => {
  const [copiedIds, setCopiedIds] = useState(() => new Set());

  const handleCopyDiagnostic = async (toast) => {
    const copied = await copyText(toast.diagnosticText);
    if (!copied) {
      return;
    }

    setCopiedIds(prev => new Set(prev).add(toast.id));
    window.setTimeout(() => {
      setCopiedIds(prev => {
        const next = new Set(prev);
        next.delete(toast.id);
        return next;
      });
    }, 1600);
  };

  return (
    <div className="fixed inset-x-3 top-3 z-[100] space-y-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[min(24rem,calc(100vw-2rem))]">
      {toasts.map(toast => {
        const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
        const copied = copiedIds.has(toast.id);

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            className={`flex items-start gap-3 border p-4 shadow-lg backdrop-blur-sm animate-slide-in ${style.shell}`}
          >
            <div className="shrink-0 mt-0.5">
              <ToastIcon type={toast.type} className={style.icon} />
            </div>
            <div className="flex-1 min-w-0">
              {toast.title && <p className="font-bold text-sm mb-0.5">{toast.title}</p>}
              <p className="text-sm whitespace-pre-wrap break-words">{toast.message}</p>

              {(toast.diagnosticText || toast.actions?.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {toast.diagnosticText && (
                    <button
                      type="button"
                      onClick={() => void handleCopyDiagnostic(toast)}
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold transition-colors ${style.action}`}
                    >
                      <Clipboard size={13} />
                      {copied ? toast.copiedDiagnosticLabel : toast.copyDiagnosticLabel}
                    </button>
                  )}
                  {toast.actions?.map((action, index) => (
                    <ToastAction
                      key={`${toast.id}-action-${index}`}
                      action={action}
                      style={style}
                      toastId={toast.id}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="关闭通知"
              onClick={() => onRemove(toast.id)}
              className="shrink-0 p-1 hover:bg-black/5 rounded-sm transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
});

Toast.displayName = 'Toast';

export default Toast;
