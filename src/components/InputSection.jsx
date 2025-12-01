import React, { useState } from 'react';
import { Plus, Star, Save, Trash2 } from 'lucide-react';

const InputSection = React.memo(({ currentPool, poolStatsTotal, onAddSingle, onSubmitBatch, onDeletePool }) => {
  const [batchInput, setBatchInput] = useState(Array(10).fill({ rarity: 4, isStandard: false }));

  const cycleBatchItem = (index) => {
    setBatchInput(prev => {
      const next = [...prev];
      const current = next[index];
      const isLimitedOrWeapon = currentPool.type === 'limited' || currentPool.type === 'weapon';

      let newItem;
      if (current.rarity === 4) {
        newItem = { rarity: 5, isStandard: false };
      } else if (current.rarity === 5) {
        if (isLimitedOrWeapon) {
          newItem = { rarity: 6, isStandard: false };
        } else {
          newItem = { rarity: 6, isStandard: true };
        }
      } else if (current.rarity === 6) {
        if (isLimitedOrWeapon && !current.isStandard) {
           newItem = { rarity: 6, isStandard: true };
        } else {
           newItem = { rarity: 4, isStandard: false };
        }
      } else {
        newItem = { rarity: 4, isStandard: false };
      }

      next[index] = newItem;
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmitBatch(batchInput);
    setBatchInput(Array(10).fill({ rarity: 4, isStandard: false })); // Reset
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
         <Star size={120} />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
         <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
          <Plus size={20} className="text-indigo-500"/>
          <span>录入数据</span>
          <span className="text-xs font-normal text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-sm">
            当前: {currentPool.name}
          </span>
        </h2>
        <div className="text-xs text-slate-400 dark:text-zinc-500">
          样本数: <span className="font-mono text-slate-600 dark:text-zinc-400 text-sm font-bold">{poolStatsTotal}</span>
        </div>
      </div>

      {/* 十连编辑器 - 横向一排 */}
      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-none border border-zinc-200 dark:border-zinc-800 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-slate-600 dark:text-zinc-400">十连编辑器</span>
          <span className="text-xs text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">点击切换星级</span>
        </div>

        {/* 十连按钮 - 一排显示 */}
        <div className="flex gap-2 mb-4">
          {batchInput.map((item, idx) => (
            <button
              key={idx}
              onClick={() => cycleBatchItem(idx)}
              className={`
                flex-1 aspect-square min-w-0 rounded-none flex flex-col items-center justify-center transition-all transform active:scale-95 border-2 relative overflow-hidden
                ${item.rarity === 4 ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400 shadow-sm' : ''}
                ${item.rarity === 5 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800' : ''}
                ${item.rarity === 6 && !item.isStandard ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600 text-orange-600 dark:text-orange-400 shadow-md ring-2 ring-orange-100 dark:ring-orange-800' : ''}
                ${item.rarity === 6 && item.isStandard ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 shadow-md ring-2 ring-red-100 dark:ring-red-800' : ''}
              `}
            >
              <Star size={16} fill={item.rarity >= 5 ? "currentColor" : "none"} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-bold mt-0.5">
                {item.rarity}星
              </span>
              {item.rarity === 6 && (
                <span className="absolute bottom-0 w-full text-[8px] sm:text-[9px] bg-black/10 dark:bg-white/10 text-center leading-3 py-0.5">
                  {item.isStandard ? '常驻' : '限定'}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          className="w-full bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider py-3 rounded-none flex items-center justify-center gap-2 transition-colors shadow-sm active:translate-y-0.5"
        >
          <Save size={18} />
          确认保存这十连
        </button>
      </div>

      {/* 单抽快速入口 - 横向排列 */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="flex-1">
          <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2 font-medium">单抽补录：</p>
          <div className="flex gap-2">
            <button onClick={() => onAddSingle(4)} className="flex-1 h-10 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-none hover:bg-purple-100 dark:hover:bg-purple-900/40 font-bold transition-colors text-sm">
              4星
            </button>
            <button onClick={() => onAddSingle(5)} className="flex-1 h-10 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-none hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold transition-colors text-sm">
              5星
            </button>
            {currentPool.type === 'limited' || currentPool.type === 'weapon' ? (
              <>
                <button onClick={() => onAddSingle(6, false)} className="flex-1 h-10 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300 rounded-none hover:bg-orange-100 dark:hover:bg-orange-900/40 font-bold transition-colors shadow-sm text-sm">
                  6星限定
                </button>
                <button onClick={() => onAddSingle(6, true)} className="flex-1 h-10 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-none hover:bg-red-100 dark:hover:bg-red-900/40 font-bold transition-colors shadow-sm text-sm">
                  6星常驻
                </button>
              </>
            ) : (
              <button onClick={() => onAddSingle(6, true)} className="flex-1 h-10 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-none hover:bg-red-100 dark:hover:bg-red-900/40 font-bold transition-colors shadow-sm text-sm">
                6星常驻
              </button>
            )}
          </div>
        </div>

        {/* 清空按钮 */}
        <div className="flex items-end">
          <button onClick={onDeletePool} className="h-10 px-4 text-xs text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-none transition-colors">
            <Trash2 size={14}/> 清空当前池
          </button>
        </div>
      </div>
    </section>
  );
});

export default InputSection;
