import { ArrowRight, User } from 'lucide-react';

export default function OfficialImportAccountSelectionView({
  accounts,
  onCancel,
  onSelect
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 p-4 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-blue-700 dark:text-blue-400 font-bold text-sm">检测到多个游戏账号</span>
        </div>
        <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono mb-4">
          请选择要导入抽卡记录的账号：
        </p>

        <div className="space-y-2">
          {accounts.map((account) => (
            <button
              key={`${account.uid}-${account.gameUid || 'unknown'}-${account.serverId || 'unknown'}`}
              onClick={() => onSelect(account)}
              className={`w-full p-3 border transition-all text-left flex items-center gap-3 ${
                account.isOfficial
                  ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  : 'border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30'
              }`}
            >
              <div className={`w-10 h-10 flex items-center justify-center ${
                account.isOfficial
                  ? 'bg-amber-100 dark:bg-amber-800/50'
                  : 'bg-pink-100 dark:bg-pink-800/50'
              }`}>
                <User size={20} className={account.isOfficial ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-white">{account.nickName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                    account.isOfficial
                      ? 'bg-amber-500 dark:bg-amber-600 text-white'
                      : 'bg-pink-500 dark:bg-pink-600 text-white'
                  }`}>
                    {account.channelName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mt-0.5">
                  UID: {account.gameUid} • Lv.{account.level}
                </p>
              </div>
              <ArrowRight size={16} className="text-slate-400 dark:text-zinc-500" />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onCancel}
        className="w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xs font-mono uppercase tracking-widest transition-colors"
      >
        [ 取消并返回 ]
      </button>
    </div>
  );
}
