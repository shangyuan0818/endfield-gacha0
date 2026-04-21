import { ArrowRight, User } from 'lucide-react';

export default function OfficialImportAccountSelectionView({
  accounts,
  onCancel,
  onSelect
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 p-4 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)' }}>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-blue-700 dark:text-blue-400 font-bold uppercase tracking-widest text-sm">检测到多个游戏账号</span>
        </div>
        <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono mb-4">
          请选择要导入抽卡记录的账号：
        </p>

        <div className="space-y-2">
          {accounts.map((account) => (
            <button
              key={`${account.uid}-${account.gameUid || 'unknown'}-${account.serverId || 'unknown'}`}
              onClick={() => onSelect(account)}
              className={`w-full p-4 border transition-all duration-300 text-left flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden ${
                account.isOfficial
                  ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  : 'border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30'
              }`}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}
            >
              <div className={`w-12 h-12 flex items-center justify-center shrink-0 border border-black/10 dark:border-white/10 ${
                account.isOfficial
                  ? 'bg-amber-100 dark:bg-amber-800/50'
                  : 'bg-pink-100 dark:bg-pink-800/50'
              }`} style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}>
                <User size={24} className={account.isOfficial ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'} />
              </div>
              <div className="flex-1 min-w-0 z-10 relative">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800 dark:text-white truncate">{account.nickName}</span>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider ${
                    account.isOfficial
                      ? 'bg-amber-500 dark:bg-amber-600 text-white'
                      : 'bg-pink-500 dark:bg-pink-600 text-white'
                  }`} style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}>
                    {account.channelName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1">
                    <span className="text-[9px] uppercase tracking-widest">UID</span>
                    <span className="text-slate-700 dark:text-zinc-300 font-bold">{account.gameUid}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1">
                    <span className="text-[9px] uppercase tracking-widest">LV</span>
                    <span className="text-slate-700 dark:text-zinc-300 font-bold">{account.level}</span>
                  </p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-400 dark:text-zinc-500 group-hover:translate-x-1 group-hover:text-slate-800 dark:group-hover:text-white transition-all z-10 relative" />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onCancel}
        className="w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/50 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all duration-200"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
      >
        [ 取消并返回 ]
      </button>
    </div>
  );
}