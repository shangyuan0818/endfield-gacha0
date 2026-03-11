import React from 'react';
import { Star, Hexagon, Gift, BookOpen } from 'lucide-react';
import { RESOURCE_ICON_URLS, RESOURCE_LABELS } from '../../utils/resourceEconomy';

function getCostDisplay(cost) {
  if (!cost?.resource || !cost?.amount) {
    return 'FREE';
  }

  const label = cost.resource === 'arsenalQuota' ? RESOURCE_LABELS.arsenalQuota : RESOURCE_LABELS.jade;
  return `${Number(cost.amount || 0).toLocaleString()} ${label}`;
}

function getCostIcon(cost) {
  if (!cost?.resource || !cost?.amount) {
    return null;
  }

  return RESOURCE_ICON_URLS[cost.resource] || null;
}

function PullButtonWrapper({ children, disabledReason }) {
  if (!disabledReason) {
    return children;
  }

  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-600 dark:text-zinc-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {disabledReason}
      </div>
    </div>
  );
}

const SimulatorControls = ({
  onPullOne,
  onPullTen,
  disableSingle,
  disableTen,
  singleDisabledReason = '',
  tenDisabledReason = '',
  singleCost,
  tenCost,
  availableFreePulls = 0,
  infoBookTenPullAvailable = false
}) => {
  const hasFree = availableFreePulls > 0;
  const hasInfoBook = infoBookTenPullAvailable;
  const singleCostIcon = getCostIcon(singleCost);
  const tenCostIcon = getCostIcon(tenCost);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 单抽按钮 */}
      <PullButtonWrapper disabledReason={disableSingle ? singleDisabledReason : ''}>
        <button
          onClick={onPullOne}
          disabled={disableSingle}
          className="group relative h-24 w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:border-endfield-yellow active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <div className="absolute inset-0 bg-white dark:bg-zinc-800 opacity-0 group-hover:opacity-10 transition-opacity" />
          <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rotate-45 transform group-hover:scale-110 transition-transform" />

          <div className="relative z-10 flex flex-col items-center justify-center h-full">
            <span className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-2 group-hover:text-endfield-yellow transition-colors">
              单次寻访
            </span>
            <div className="flex items-center gap-2 bg-zinc-200 dark:bg-black/50 px-3 py-1.5 rounded-none border border-zinc-300 dark:border-zinc-700">
              {singleCostIcon ? (
                <img src={singleCostIcon} alt="" className="w-5 h-5 object-contain shrink-0" loading="lazy" />
              ) : (
                <Hexagon size={14} className="text-endfield-yellow fill-current" />
              )}
              <span className="text-base font-mono font-bold text-slate-800 dark:text-zinc-200">{getCostDisplay(singleCost)}</span>
            </div>
          </div>
        </button>
      </PullButtonWrapper>

      {/* 十连按钮 */}
      <PullButtonWrapper disabledReason={disableTen ? tenDisabledReason : ''}>
        <button
          onClick={onPullTen}
          disabled={disableTen}
          className={`group relative h-24 w-full border ${
            hasInfoBook
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 dark:border-amber-600'
              : hasFree
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 border-blue-400 dark:border-blue-600'
              : 'bg-endfield-yellow border-yellow-400 dark:border-transparent'
          } hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden`}
        >
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
          <div className="absolute top-0 right-0 w-20 h-full bg-black/10 -skew-x-12 transform translate-x-10 group-hover:translate-x-6 transition-transform duration-500" />

          {hasInfoBook && (
            <div className="absolute top-1 right-1 bg-white text-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-sm border border-amber-200 shadow-sm animate-pulse flex items-center gap-1">
              <BookOpen size={10} />
              情报书
            </div>
          )}

          {!hasInfoBook && hasFree && (
            <div className="absolute top-1 right-1 bg-white text-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-sm border border-blue-200 shadow-sm animate-pulse flex items-center gap-1">
              <Gift size={10} />
              免费 x{availableFreePulls}
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center justify-center h-full">
            <span className={`text-lg font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${hasInfoBook || hasFree ? 'text-white' : 'text-black'}`}>
              {hasInfoBook ? '情报书十连' : hasFree ? '免费十连' : '十连寻访'}
              <Star size={16} className={hasInfoBook || hasFree ? 'fill-white' : 'fill-black'} />
            </span>
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-none border ${
              hasInfoBook || hasFree
                ? 'bg-white/20 border-white/30 line-through opacity-60'
                : 'bg-black/10 border-black/10'
            }`}>
              {tenCostIcon ? (
                <img src={tenCostIcon} alt="" className="w-5 h-5 object-contain shrink-0" loading="lazy" />
              ) : (
                <Hexagon size={14} className={`${hasInfoBook || hasFree ? 'text-white' : 'text-black'} fill-current`} />
              )}
              <span className={`text-base font-mono font-bold ${hasInfoBook || hasFree ? 'text-white' : 'text-black'}`}>{getCostDisplay(tenCost)}</span>
            </div>
          </div>
        </button>
      </PullButtonWrapper>
    </div>
  );
};

export default SimulatorControls;
