import React from 'react';
import { Star, Trash2 } from 'lucide-react';

const BatchCard = React.memo(({ group, onEdit, onDeleteGroup, poolType, canEdit }) => {
  // 统计该组信息
  const counts = { 6: 0, 5: 0, 4: 0 };
  group.forEach(i => {
    if (i.rarity >= 6) counts[6]++;
    else if (i.rarity === 5) counts[5]++;
    else counts[4]++;
  });

  const isBatch = group.length >= 5; // 5连以上视为Batch展示

  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-slate-50 dark:bg-zinc-950 transition-colors group">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
         {/* Header Info */}
         <div className="w-32 shrink-0">
           <div className="text-sm font-black text-slate-700 dark:text-zinc-300 font-mono mb-1">
             {group.length === 1 ? (
               <>No.{group[0].globalIndex}</>
             ) : (
               <>No.{group[0].globalIndex} - {group[group.length - 1].globalIndex}</>
             )}
           </div>
           <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mb-2">
             {new Date(group[0].timestamp).toLocaleString()}
           </div>
           <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-slate-100 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded">
                 {isBatch ? '十连/多抽' : '单抽'}
              </span>
              {isBatch && canEdit && (
                <button
                  onClick={() => onDeleteGroup(group)}
                  className="text-slate-300 hover:text-red-500 transition-colors p-1 z-10 relative cursor-pointer"
                  title="删除整组"
                >
                  <Trash2 size={14} />
                </button>
              )}
           </div>
         </div>

         {/* Items Grid */}
         <div className="flex-1">
            <div className="flex flex-wrap gap-2">
              {group.map((item, idx) => {
                const isLimitedUp = item.rarity === 6 && !item.isStandard;
                const isStandardSpook = item.rarity === 6 && item.isStandard;
                const isGift = item.specialType === 'gift';
                const isGuaranteed = item.specialType === 'guaranteed';

                return (
                  <div
                    key={item.id}
                    onClick={canEdit ? () => onEdit(item) : undefined}
                    className={`
                      relative w-10 h-10 rounded-none flex items-center justify-center border-2 transition-all
                      ${canEdit ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                      ${isGift ? 'bg-purple-50 border-purple-400 text-purple-600 ring-2 ring-purple-100' : ''}
                      ${!isGift && isLimitedUp ? 'bg-orange-50 border-orange-600 text-white shadow-md glow-border overflow-hidden' : ''}
                      ${!isGift && isStandardSpook ? 'bg-red-100 border-red-300 text-red-700' : ''}
                      ${item.rarity === 5 ? 'bg-amber-50 border-amber-200 text-amber-600' : ''}
                      ${item.rarity === 4 ? 'bg-purple-50 border-purple-200 text-purple-600' : ''}
                    `}
                    title={canEdit ? "点击修改" : undefined}
                  >
                    {!isGift && isLimitedUp && <div className="absolute inset-0 shine-effect"></div>}

                    <Star size={item.rarity >= 5 ? 14 : 12} fill="currentColor" className="relative z-10" />

                    {item.rarity === 6 && poolType !== 'standard' && (
                       <div className={`absolute -top-1 -right-1 px-1 h-3 flex items-center justify-center rounded-sm text-[8px] font-bold border border-white relative z-10
                         ${isGift ? 'bg-purple-500 text-white' :
                           isGuaranteed ? 'bg-green-500 text-white' :
                           isLimitedUp ? 'bg-white dark:bg-zinc-900 text-orange-600' : 'bg-red-500 text-white'
                         }`}>
                         {isGift ? '赠送' : isGuaranteed ? '保底' : isLimitedUp ? 'UP' : '歪'}
                       </div>
                    )}
                    {item.rarity === 6 && poolType === 'standard' && (isGift || isGuaranteed) && (
                       <div className={`absolute -top-1 -right-1 px-1 h-3 flex items-center justify-center rounded-sm text-[8px] font-bold border border-white relative z-10
                         ${isGift ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
                         }`}>
                         {isGift ? '赠送' : '保底'}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
         </div>
      </div>
    </div>
  );
});

export default BatchCard;
