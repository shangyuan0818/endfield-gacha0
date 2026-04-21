import { CheckCircle, User } from 'lucide-react';
import { getPoolName } from '../importShared';
import { useI18n } from '../../../i18n/index.js';

export default function OfficialImportSuccessView({
  importSummary,
  userInfo,
  onConfirm,
  onReset
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {userInfo && (
        <div className="flex items-center gap-4 p-4 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)' }}>
          <div className={`w-12 h-12 flex items-center justify-center shrink-0 border border-black/10 dark:border-white/10 ${
            userInfo.isOfficial !== false
              ? 'bg-amber-100 dark:bg-amber-800/50'
              : 'bg-pink-100 dark:bg-pink-800/50'
          }`} style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}>
            <User size={24} className={userInfo.isOfficial !== false ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800 dark:text-white truncate">{userInfo.nickName || 'Unknown User'}</span>
              {userInfo.channelName && (
                <span className={`shrink-0 text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider ${
                  userInfo.isOfficial !== false
                    ? 'bg-amber-500 dark:bg-amber-600 text-white'
                    : 'bg-pink-500 dark:bg-pink-600 text-white'
                }`} style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)' }}>
                  {userInfo.channelName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1">
                <span className="text-[9px] uppercase tracking-widest">UID</span>
                <span className="text-slate-700 dark:text-zinc-300 font-bold">{userInfo.gameUid || userInfo.hgUid}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-4 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="text-emerald-600 dark:text-emerald-500" size={16} />
          <span className="text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-widest text-sm">{t('import.complete')}</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors py-2" style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}>
            <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">TOTAL</div>
            <div className="text-xl font-mono font-bold text-slate-800 dark:text-white mt-1">{importSummary.total}</div>
          </div>

          {['6', '5', '4'].map((rarity) => (
            <div key={rarity} className="text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors py-2" style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}>
              <div className={`text-[10px] font-bold uppercase tracking-widest ${rarity === '6' ? 'text-yellow-600 dark:text-yellow-500' : rarity === '5' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {rarity}★
              </div>
              <div className="text-xl font-mono font-bold text-slate-700 dark:text-zinc-300 mt-1">{importSummary.byRarity[rarity] || 0}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-5 border-t border-zinc-200 dark:border-zinc-800/50 transition-colors">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono uppercase tracking-widest mb-3">{t('import.official.poolDistribution')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(importSummary.byPoolType || importSummary.byPool).map(([pool, count]) => (
              <span
                key={pool}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono font-bold transition-colors uppercase tracking-wider"
                style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
              >
                {getPoolName(pool, t)} <span className="text-slate-800 dark:text-white ml-2">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {importSummary.sixStars && importSummary.sixStars.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] text-yellow-600/80 dark:text-yellow-500/80 font-mono uppercase tracking-widest mb-3">{t('import.official.sixStarDrops')}</p>
            <div className="flex flex-wrap gap-2">
              {importSummary.sixStars.map((record, index) => (
                <span
                  key={index}
                  className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 px-3 py-1.5 text-[11px] text-yellow-700 dark:text-yellow-500 font-bold transition-colors tracking-widest flex items-center gap-2"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
                >
                  {record.name}
                  {record.isNew && <span className="text-[9px] bg-yellow-500 text-black px-1.5 font-black uppercase tracking-wider" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%)' }}>NEW</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onReset}
          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-yellow-500 dark:hover:border-yellow-500 text-slate-700 dark:text-zinc-300 font-bold py-3 text-xs tracking-widest font-mono uppercase transition-all duration-200 relative group overflow-hidden"
          style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-yellow-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-bottom" />
          <span className="relative z-10 group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">{t('import.continue')}</span>
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 text-xs tracking-widest font-mono uppercase transition-all duration-300 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)] active:scale-95 group relative overflow-hidden"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}
        >
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-in-out" />
          <span className="relative z-10">{t('common.confirm')}</span>
        </button>
      </div>
    </div>
  );
}