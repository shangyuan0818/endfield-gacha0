import { AlertCircle } from 'lucide-react';

export default function OfficialImportErrorView({ error, onRetry }) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 p-4 flex gap-3 transition-colors">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
        <div>
          <h4 className="text-red-600 dark:text-red-500 font-bold text-sm mb-1">导入失败</h4>
          <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono">{error}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
      >
        重试
      </button>
    </div>
  );
}
