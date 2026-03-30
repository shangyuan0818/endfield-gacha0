import React from 'react';
import { RefreshCw, User } from 'lucide-react';
import { characterCache } from '../../utils/characterUtils';

const formatDateTime = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};

const RotationScheduleCard = React.memo(function RotationScheduleCard({ poolSchedule, now }) {
  if (!poolSchedule.length) {
    return null;
  }

  let currentActiveIndex = -1;
  for (let index = 0; index < poolSchedule.length; index += 1) {
    const pool = poolSchedule[index];
    const start = new Date(pool.startDate);
    const end = new Date(pool.endDate);
    if (now >= start && now < end) {
      currentActiveIndex = index;
      break;
    }
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
      <div className="relative z-10 px-6 py-4">
        <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-4 flex items-center gap-2 uppercase tracking-widest">
          <RefreshCw size={12} />
          Rotation Schedule // 轮换计划
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {poolSchedule.map((pool, index) => {
            const poolStart = new Date(pool.startDate);
            const poolEnd = new Date(pool.endDate);
            const isPast = now >= poolEnd;
            const offset = currentActiveIndex === -1 ? null : index - currentActiveIndex;
            const isCurrent = offset === 0;
            const isInPool = offset !== null && offset >= -2 && offset <= 0;

            let statusLabel = null;
            if (isCurrent) {
              statusLabel = '当前UP角色';
            } else if (offset === -1) {
              statusLabel = '在卡池中 · 第2次轮换后移出';
            } else if (offset === -2) {
              statusLabel = '在卡池中 · 下一次轮换后移出';
            } else if (offset === 1) {
              statusLabel = '下一卡池UP';
            } else if (offset === 2) {
              statusLabel = '下下次卡池UP';
            }

            const characterData = characterCache.searchByName(pool.name, false);
            const avatarUrl = characterData?.avatar_url;

            let containerClass = 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400';
            if (isCurrent) {
              containerClass = 'bg-endfield-yellow/10 border-endfield-yellow text-amber-600 dark:text-endfield-yellow ring-1 ring-endfield-yellow/50 animate-pulse';
            } else if (isInPool) {
              containerClass = 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400';
            } else if (isPast) {
              containerClass = 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 line-through opacity-70';
            }

            return (
              <React.Fragment key={pool.name}>
                <div className={`px-3 py-2 rounded-sm text-xs font-mono transition-all border ${containerClass}`}>
                  <div className="font-bold flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                      isCurrent
                        ? 'bg-gradient-to-br from-orange-400 to-pink-500 ring-1 ring-endfield-yellow'
                        : isInPool
                          ? 'bg-blue-200 dark:bg-blue-800'
                          : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={pool.name}
                          className="w-full h-full object-cover"
                          onError={(event) => {
                            event.target.style.display = 'none';
                            event.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full items-center justify-center text-white/80 ${avatarUrl ? 'hidden' : 'flex'}`}>
                        <User size={12} />
                      </div>
                    </div>
                    <span>{pool.name}</span>
                    {isCurrent && <span className="text-[10px] font-bold">UP</span>}
                    {isInPool && !isCurrent && <span className="text-[10px] opacity-80">(在卡池中)</span>}
                  </div>
                  <div className="text-[10px] opacity-70 mt-1 ml-8">
                    {formatDateTime(poolStart)} - {formatDateTime(poolEnd)}
                  </div>
                  {statusLabel && (
                    <div className={`text-[10px] mt-1 ml-8 font-bold ${
                      isCurrent ? 'text-amber-600 dark:text-endfield-yellow' :
                      isInPool ? 'text-blue-500 dark:text-blue-400' :
                      'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {statusLabel}
                    </div>
                  )}
                </div>
                {index < poolSchedule.length - 1 && <div className="w-4 h-px bg-zinc-200 dark:bg-zinc-800"></div>}
              </React.Fragment>
            );
          })}
          <div className="w-4 h-px bg-zinc-200 dark:bg-zinc-800"></div>
          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 rounded-sm text-xs font-mono">
            待公布...
          </div>
        </div>
      </div>
    </div>
  );
});

export default RotationScheduleCard;
