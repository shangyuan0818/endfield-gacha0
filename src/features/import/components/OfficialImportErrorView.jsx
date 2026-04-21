import { AlertCircle } from 'lucide-react';

export default function OfficialImportErrorView({ error, onRetry }) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-4 flex gap-3 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-red-600 dark:text-red-500 font-bold text-sm mb-1 uppercase tracking-widest font-mono">导入失败</h4>
          <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono">{error}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-red-500 dark:hover:border-red-500 text-slate-700 dark:text-zinc-300 font-bold py-3 text-xs tracking-widest font-mono uppercase transition-all duration-200 relative group overflow-hidden"
        style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-red-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-bottom" />
        <span className="relative z-10 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">重试</span>
      </button>
    </div>
  );
}