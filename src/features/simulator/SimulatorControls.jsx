import React from 'react';
import { Star, Hexagon, Gift } from 'lucide-react';

const SimulatorControls = ({ onPullOne, onPullTen, disabled, jadeCost, availableFreePulls = 0 }) => {
  const hasFree = availableFreePulls > 0;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 单抽按钮 */}
      <button
        onClick={onPullOne}
        disabled={disabled}
        className="group relative h-20 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:border-endfield-yellow active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
      >
        <div className="absolute inset-0 bg-white dark:bg-zinc-800 opacity-0 group-hover:opacity-10 transition-opacity" />
        <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rotate-45 transform group-hover:scale-110 transition-transform" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-1 group-hover:text-endfield-yellow transition-colors">
            单次寻访
          </span>
          <div className="flex items-center gap-1.5 bg-zinc-200 dark:bg-black/50 px-3 py-1 rounded-none border border-zinc-300 dark:border-zinc-700">
             <Hexagon size={12} className="text-endfield-yellow fill-current" />
             <span className="text-sm font-mono font-bold text-slate-800 dark:text-zinc-200">500</span>
          </div>
        </div>
      </button>

      {/* 十连按钮 */}
      <button
        onClick={onPullTen}
        disabled={disabled}
        className={`group relative h-20 border ${
          hasFree
            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 border-blue-400 dark:border-blue-600'
            : 'bg-endfield-yellow border-yellow-400 dark:border-transparent'
        } hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden`}
      >
        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
        {/* 斜线装饰 */}
        <div className="absolute top-0 right-0 w-20 h-full bg-black/10 -skew-x-12 transform translate-x-10 group-hover:translate-x-6 transition-transform duration-500" />

        {/* 免费标签 */}
        {hasFree && (
          <div className="absolute top-1 right-1 bg-white text-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-sm border border-blue-200 shadow-sm animate-pulse flex items-center gap-1">
            <Gift size={10} />
            免费 x{availableFreePulls}
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className={`text-lg font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${hasFree ? 'text-white' : 'text-black'}`}>
            {hasFree ? '免费十连' : '十连寻访'}
            <Star size={16} className={hasFree ? 'fill-white' : 'fill-black'} />
          </span>
          <div className={`flex items-center gap-1.5 px-4 py-1 rounded-none border ${
            hasFree
              ? 'bg-white/20 border-white/30 line-through opacity-60'
              : 'bg-black/10 border-black/10'
          }`}>
             <Hexagon size={12} className={`${hasFree ? 'text-white' : 'text-black'} fill-current`} />
             <span className={`text-sm font-mono font-bold ${hasFree ? 'text-white' : 'text-black'}`}>5000</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default SimulatorControls;
