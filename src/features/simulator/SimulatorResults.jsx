import React from 'react';
import { X, Star, Share2, Download } from 'lucide-react';

const RarityCard = ({ rarity, isUp, isLimited, isStandard, characterName, index }) => {
  // 延迟动画
  const delay = `${index * 100}ms`;

  // 颜色定义
  let bgColor = 'bg-slate-200 dark:bg-zinc-800';
  let borderColor = 'border-zinc-300 dark:border-zinc-700';
  let textColor = 'text-slate-500 dark:text-zinc-500';
  let glowClass = '';

  if (rarity === 6) {
    bgColor = 'bg-orange-50 dark:bg-orange-500/10';
    borderColor = 'border-orange-500';
    textColor = 'text-orange-600 dark:text-orange-500';
    if (isUp) { // 限定UP
        borderColor = 'border-yellow-500 dark:border-endfield-yellow';
        textColor = 'text-yellow-600 dark:text-endfield-yellow';
        glowClass = 'shadow-[0_0_15px_rgba(255,250,0,0.2)] dark:shadow-[0_0_15px_rgba(255,250,0,0.4)]';
    } else if (isStandard) { // 常驻
        borderColor = 'border-red-500';
        textColor = 'text-red-600 dark:text-red-500';
    }
  } else if (rarity === 5) {
    bgColor = 'bg-yellow-50 dark:bg-yellow-500/5';
    borderColor = 'border-yellow-500 dark:border-yellow-600';
    textColor = 'text-yellow-700 dark:text-yellow-600';
  } else if (rarity === 4) {
    bgColor = 'bg-purple-50 dark:bg-purple-500/5';
    borderColor = 'border-purple-400 dark:border-purple-500';
    textColor = 'text-purple-700 dark:text-purple-500';
  }

  return (
    <div
      className={`relative h-32 md:h-48 w-full border-2 ${borderColor} ${bgColor} ${glowClass} flex flex-col items-center justify-center animate-fade-in-up hover:scale-105 transition-transform duration-300`}
      style={{ animationDelay: delay }}
    >
      {/* 顶部装饰 */}
      <div className="absolute top-0 right-0 p-1">
        <div className={`text-[10px] font-mono font-bold ${textColor}`}>0{index + 1}</div>
      </div>

      {/* 稀有度图标 */}
      <div className="flex gap-0.5 mb-1">
        {Array.from({ length: rarity }).map((_, i) => (
          <Star key={i} size={8} className={`${textColor} fill-current`} />
        ))}
      </div>

      {/* 文本内容 */}
      <div className={`text-xl md:text-2xl font-black ${textColor}`}>
        {rarity}★
      </div>

      {/* 角色名称 */}
      {characterName && (
        <div className={`mt-1 text-xs md:text-sm font-bold ${textColor} px-2 text-center line-clamp-2 max-w-full`}>
          {characterName}
        </div>
      )}

      {/* 类型标记 */}
      <div className="mt-1 text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded text-white/80">
        {isUp ? 'UP' : isLimited ? 'LIMITED' : isStandard ? 'STANDARD' : 'NORMAL'}
      </div>
    </div>
  );
};

const SimulatorResults = ({ results, onClose }) => {
  // 统计本次结果
  const sixStars = results.filter(r => r.rarity === 6).length;
  const fiveStars = results.filter(r => r.rarity === 5).length;
  const isSingle = results.length === 1;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col h-full py-4">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">
            寻访结果
          </h2>
          <div className="flex gap-4 text-sm font-mono text-zinc-400 mt-2">
             <span>6★: <span className="text-endfield-yellow">{sixStars}</span></span>
             <span>5★: <span className="text-white">{fiveStars}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
           <button className="p-2 bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">
              <Share2 size={20} />
           </button>
           {/* Close button kept for manual closing if needed, but Confirm button below removed */}
           <button onClick={onClose} className="p-2 bg-endfield-yellow text-black hover:bg-yellow-400 transition-colors">
              <X size={20} />
           </button>
        </div>
      </div>

      {/* 结果网格 - 固定高度显示所有内容 */}
      <div className={`${isSingle ? 'flex justify-center items-center h-full' : 'grid grid-cols-5 gap-3 md:gap-4'} mb-6 flex-1`}>
        {results.map((result, index) => (
           <div key={index} className={isSingle ? 'w-full max-w-xs' : 'w-full'}>
             <RarityCard
               {...result}
               index={index}
             />
           </div>
        ))}
      </div>
    </div>
  );
};

export default SimulatorResults;
