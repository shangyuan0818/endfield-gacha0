import { Clock, Loader2, RefreshCw } from 'lucide-react';
import { evaluateImportHealth } from '../../../utils/importHealth.js';
import { ImportStatus } from '../importShared.js';
import { useI18n } from '../../../i18n/index.js';

function FetchProgressBar({ message, progress }) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-500 transition-colors tracking-widest">
        <span className="flex items-center gap-2">
          <RefreshCw size={12} className="animate-spin text-yellow-600 dark:text-yellow-500" />
          正在获取数据
        </span>
        <span className="text-yellow-600 dark:text-yellow-500 font-bold">{progress}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-900 relative overflow-hidden transition-colors" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%)' }}>
        <div
          className="h-full bg-yellow-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between items-center text-xs font-mono">
        <span className="text-slate-600 dark:text-zinc-400 transition-colors">{message}</span>
      </div>
    </div>
  );
}

function QueueStatusDisplay({ queueStatus, retryInfo }) {
  if (!queueStatus && !retryInfo) return null;

  return (
    <div className="mt-4 p-4 bg-slate-100 dark:bg-zinc-950/50 border border-zinc-300 dark:border-zinc-800 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>
      <div className="flex items-start gap-3">
        <Clock size={16} className="text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          {queueStatus && (
            <div className="text-xs font-mono">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-800 dark:text-zinc-200 font-bold tracking-widest uppercase">请求队列状态</span>
                {queueStatus.isProcessing && (
                  <Loader2 size={14} className="animate-spin text-yellow-600 dark:text-yellow-500" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800/50 pb-1">
                  <span className="text-slate-500 dark:text-zinc-500">队列长度:</span>
                  <span className="text-yellow-600 dark:text-yellow-500 font-bold">{queueStatus.queueLength}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800/50 pb-1">
                  <span className="text-slate-500 dark:text-zinc-500">活动请求:</span>
                  <span className="text-yellow-600 dark:text-yellow-500 font-bold">{queueStatus.activeRequests || 0}</span>
                </div>
              </div>
              {queueStatus.oldestTaskAge > 0 && (
                <div className="mt-2 text-[10px] text-slate-500 dark:text-zinc-500">
                  最早任务等待: {Math.round(queueStatus.oldestTaskAge / 1000)}秒
                </div>
              )}
            </div>
          )}

          {retryInfo && (
            <div className="text-xs font-mono border-t border-zinc-300 dark:border-zinc-800 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-red-500 dark:text-red-500 animate-spin" />
                <span className="text-slate-800 dark:text-zinc-200 font-bold tracking-widest uppercase">正在重试</span>
              </div>
              <div className="text-[11px] space-y-1.5">
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800/50 pb-1">
                  <span className="text-slate-500 dark:text-zinc-500">重试次数:</span>
                  <span className="text-red-600 dark:text-red-500 font-bold">
                    {retryInfo.currentRetry}/{retryInfo.maxRetries}
                  </span>
                </div>
                {retryInfo.nextRetryIn && (
                  <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800/50 pb-1">
                    <span className="text-slate-500 dark:text-zinc-500">下次重试:</span>
                    <span className="text-slate-800 dark:text-zinc-300 font-bold">
                      {Math.round(retryInfo.nextRetryIn / 1000)}秒后
                    </span>
                  </div>
                )}
                {retryInfo.reason && (
                  <div className="mt-2 text-red-600 dark:text-red-500">
                    原因: {retryInfo.reason}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OfficialImportProgressView({
  progress,
  queueStatus,
  retryInfo,
  statusMessage,
  onCancel
}) {
  const { t } = useI18n();
  const health = evaluateImportHealth({
    status: ImportStatus.FETCHING,
    queueStatus,
    retryInfo,
    error: null,
  });
  const healthToneClasses = {
    healthy: 'border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    queue: 'border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    warning: 'border-orange-300/80 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
    error: 'border-red-300/80 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300',
  };

  return (
    <div className="py-8 px-4 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>
      <div className={`mb-4 inline-flex items-center gap-2 border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.24em] transition-colors ${healthToneClasses[health.tone] || healthToneClasses.healthy}`} style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}>
        <span className="opacity-80">健康状态</span>
        <span>{t(health.key)}</span>
      </div>
      <FetchProgressBar progress={progress} message={statusMessage} />
      <QueueStatusDisplay queueStatus={queueStatus} retryInfo={retryInfo} />
      <button
        onClick={onCancel}
        className="mt-6 w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/50 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all duration-200"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
      >
        [ 取消操作 ]
      </button>
    </div>
  );
}