import React from 'react';
import { Star, Hexagon } from 'lucide-react';

const SimulatorControls = ({ onPullOne, onPullTen, disabled, jadeCost }) => {
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
             <span className="text-sm font-mono font-bold text-slate-800 dark:text-zinc-200">600</span>
          </div>
        </div>
      </button>

      {/* 十连按钮 */}
      <button
        onClick={onPullTen}
        disabled={disabled}
        className="group relative h-20 bg-endfield-yellow border border-yellow-400 dark:border-transparent hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
      >
        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
        {/* 斜线装饰 */}
        <div className="absolute top-0 right-0 w-20 h-full bg-black/10 -skew-x-12 transform translate-x-10 group-hover:translate-x-6 transition-transform duration-500" />
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className="text-lg font-black text-black uppercase tracking-widest mb-1 flex items-center gap-2">
            十连寻访
            <Star size={16} className="fill-black" />
          </span>
          <div className="flex items-center gap-1.5 bg-black/10 px-4 py-1 rounded-none border border-black/10">
             <Hexagon size={12} className="text-black fill-current" />
             <span className="text-sm font-mono font-bold text-black">6000</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default SimulatorControls;
