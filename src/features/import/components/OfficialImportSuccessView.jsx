import { CheckCircle, User } from 'lucide-react';
import { getPoolName } from '../importShared';

export default function OfficialImportSuccessView({
  importSummary,
  userInfo,
  onConfirm,
  onReset
}) {
  return (
    <div className="space-y-6">
      {userInfo && (
        <div className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
          <div className={`w-10 h-10 flex items-center justify-center ${
            userInfo.isOfficial !== false
              ? 'bg-amber-100 dark:bg-amber-800/50'
              : 'bg-pink-100 dark:bg-pink-800/50'
          }`}>
            <User size={20} className={userInfo.isOfficial !== false ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 dark:text-white">{userInfo.nickName || 'Unknown User'}</span>
              {userInfo.channelName && (
                <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                  userInfo.isOfficial !== false
                    ? 'bg-amber-500 dark:bg-amber-600 text-white'
                    : 'bg-pink-500 dark:bg-pink-600 text-white'
                }`}>
                  {userInfo.channelName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">UID: {userInfo.gameUid || userInfo.hgUid}</p>
          </div>
        </div>
      )}

      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 p-4 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="text-green-600 dark:text-green-500" size={16} />
          <span className="text-green-600 dark:text-green-500 font-bold text-sm">数据获取成功</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800/50 transition-colors">
            <div className="text-xs font-bold text-slate-400 dark:text-zinc-400">TOTAL</div>
            <div className="text-lg font-mono text-slate-800 dark:text-white">{importSummary.total}</div>
          </div>

          {['6', '5', '4'].map((rarity) => (
            <div key={rarity} className="text-center bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800/50 transition-colors">
              <div className={`text-xs font-bold ${rarity === '6' ? 'text-amber-600 dark:text-yellow-500' : rarity === '5' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {rarity}★
              </div>
              <div className="text-lg font-mono text-slate-700 dark:text-zinc-300">{importSummary.byRarity[rarity] || 0}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 transition-colors">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono uppercase mb-2">卡池分布</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(importSummary.byPoolType || importSummary.byPool).map(([pool, count]) => (
              <span
                key={pool}
                className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 font-mono transition-colors"
              >
                {getPoolName(pool)}: <span className="text-slate-800 dark:text-white">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {importSummary.sixStars && importSummary.sixStars.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] text-amber-600/70 dark:text-yellow-500/70 font-mono uppercase mb-2">获得的6星</p>
            <div className="flex flex-wrap gap-2">
              {importSummary.sixStars.map((record, index) => (
                <span
                  key={index}
                  className="bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-500/20 px-2 py-1 text-xs text-amber-700 dark:text-yellow-500 font-bold transition-colors"
                >
                  {record.name}
                  {record.isNew && <span className="ml-1 text-[10px] bg-amber-500 dark:bg-yellow-500 text-white dark:text-black px-1 rounded-sm">NEW</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onReset}
          className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
        >
          重新获取
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors"
        >
          确认并保存
        </button>
      </div>
    </div>
  );
}
