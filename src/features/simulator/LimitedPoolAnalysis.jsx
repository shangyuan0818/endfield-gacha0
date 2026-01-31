import React from 'react';
import { Calculator, Sparkles, FileText, BarChart2, Crosshair } from 'lucide-react';

/**
 * 限定池分析组件
 * 显示保底进度、特殊进度（120抽、240抽、30抽赠送）
 * 风格：Endfield Technical Style (适配深/浅色模式)
 */

// Reusable Card Component
const StatCard = ({ label, value, subValue, footer, progress, progressColor, extraLabel, warning }) => (
  <div className="bg-zinc-50 dark:bg-endfield-panel border border-zinc-200 dark:border-endfield-border p-4 relative group hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">
    <div className="flex justify-between items-start mb-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-endfield-muted font-bold flex items-center gap-2">
        {label}
        {extraLabel && <span className="bg-zinc-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1 py-0.5 text-[8px]">{extraLabel}</span>}
      </div>
      {warning && (
        <div className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-[9px] font-mono animate-pulse">
          {warning}
        </div>
      )}
    </div>
    
    <div className="flex items-baseline gap-2 mb-3">
      <span className="text-3xl font-bold font-mono text-slate-800 dark:text-endfield-text">{value}</span>
      {subValue && <span className="text-sm font-mono text-slate-500 dark:text-endfield-muted">{subValue}</span>}
    </div>

    <div className="relative h-1 w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
      <div 
        className={`absolute top-0 left-0 h-full transition-all duration-500 ${progressColor}`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      ></div>
    </div>

    {footer && <div className="mt-2 text-[10px] text-slate-500 dark:text-endfield-muted font-mono">{footer}</div>}
  </div>
);

// Helper component for Weapon Gifts to keep main component clean
const WeaponGifts = ({ stats }) => {
  // Calculate next gift threshold
  const giftThresholds = [100, 180, 260, 340, 420, 500];
  let nextWeaponGift = 0;
  let nextWeaponGiftType = 'standard';

  for (const threshold of giftThresholds) {
    if (stats.total < threshold) {
      nextWeaponGift = threshold;
      nextWeaponGiftType = threshold === 100 ? 'standard' : (threshold === 180 || threshold === 340 || threshold === 500) ? 'limited' : 'standard';
      break;
    }
  }

  if (nextWeaponGift === 0) {
    const cycle = Math.floor((stats.total - 180) / 160);
    nextWeaponGift = 180 + (cycle + 1) * 160;
    nextWeaponGiftType = nextWeaponGift % 160 === 20 ? 'limited' : 'standard';
  }

  return (
      <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-red-500 flex flex-col gap-1">
          <div className="flex justify-between items-center">
              <span className="text-xs text-slate-700 dark:text-endfield-text font-bold flex items-center gap-2">
                  下一档赠送
                  <span className={`px-1 rounded text-[8px] font-bold text-black ${nextWeaponGiftType === 'limited' ? 'rainbow-bg' : 'bg-red-500'}`}>
                    {nextWeaponGiftType === 'limited' ? '限定' : '常驻'}
                  </span>
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{stats.total} / {nextWeaponGift}</span>
          </div>
          <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
             <div className={`h-full ${nextWeaponGiftType === 'limited' ? 'rainbow-progress' : 'bg-red-500'}`}
                  style={{ width: `${Math.min((stats.total / nextWeaponGift) * 100, 100)}%` }}></div>
          </div>
          <div className="flex gap-2 text-[9px] text-slate-500 dark:text-endfield-muted font-mono mt-1">
              <span>已获得:</span>
              <span className="text-red-500 dark:text-red-400">{stats.gifts?.standardCount || 0} 常驻</span>
              <span className="text-blue-500 dark:text-cyan-400">{stats.gifts?.limitedCount || 0} 限定</span>
          </div>
      </div>
  );
};

const LimitedPoolAnalysis = ({ currentPool, stats, effectivePity, pityInfo, multipleFreeTen = false }) => {
  const isLimited = currentPool.type === 'limited';
  const isWeapon = currentPool.type === 'weapon';
  const isStandard = currentPool.type === 'standard';

  const maxPity = isWeapon ? 40 : 80;
  
  // Theme Colors - Adjusted for Light/Dark mode
  // Light: text-blue-600, text-slate-600, text-yellow-600
  // Dark: text-cyan-400, text-slate-400, text-endfield-yellow
  const accentColor = isLimited 
    ? 'text-blue-600 dark:text-cyan-400' 
    : isWeapon 
      ? 'text-slate-600 dark:text-slate-400' 
      : 'text-yellow-600 dark:text-endfield-yellow';
      
  const progressClass = isLimited 
    ? 'rainbow-progress' 
    : isWeapon 
      ? 'bg-slate-500' 
      : 'bg-yellow-500 dark:bg-endfield-yellow';

  // Format Helper
  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '-') return '-';
    const val = parseFloat(num);
    if (isNaN(val)) return num;
    return Number.isInteger(val) ? val : val.toFixed(1);
  };

  return (
    <div className="bg-white dark:bg-endfield-dark border border-zinc-200 dark:border-endfield-border p-6 relative overflow-hidden">
      {/* Decorative Side Bar */}
      <div className={`absolute top-0 left-0 w-1 h-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-600 dark:bg-slate-700' : 'bg-yellow-500 dark:bg-endfield-yellow'}`}></div>
      
      {/* Header */}
      <div className="flex justify-between items-end mb-6 pl-2">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-endfield-text flex items-center gap-2 uppercase tracking-wide">
            <Calculator size={20} className={accentColor} />
            {isWeapon ? '武器池分析' : isLimited ? '限定池分析' : '常驻池分析'}
          </h3>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs text-slate-500 dark:text-endfield-muted uppercase">当前卡池:</span>
             <span className={`text-xs font-bold ${accentColor} uppercase`}>{currentPool.name}</span>
          </div>
        </div>
        {isLimited && currentPool.up_character && (
           <div className="text-right">
             <div className="text-[10px] text-slate-500 dark:text-endfield-muted uppercase">UP 角色</div>
             <div className="text-sm font-bold text-slate-800 dark:text-endfield-text">{currentPool.up_character}</div>
           </div>
        )}
      </div>

      {/* Pity Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard 
           label={`6星保底 (${maxPity})`}
           value={Math.max(maxPity - stats.currentPity, 0)}
           subValue="抽"
           progress={(stats.currentPity / maxPity) * 100}
           progressColor={progressClass}
           warning={stats.probabilityInfo?.hasSoftPity && stats.probabilityInfo?.isInSoftPity ? `概率UP ${(stats.probabilityInfo.probability * 100).toFixed(1)}%` : null}
           footer={
             <div className="flex justify-between">
                <span>当前垫刀: {stats.currentPity}</span>
                {effectivePity?.isInherited && isLimited && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1"><Sparkles size={10}/> 继承: {effectivePity.pity6}</span>
                )}
             </div>
           }
        />
        <StatCard 
           label="5星保底 (10)"
           value={Math.max(10 - stats.currentPity5, 0)}
           subValue="抽"
           progress={(stats.currentPity5 / 10) * 100}
           progressColor="bg-amber-500"
           footer={
             <div className="flex justify-between">
                <span>当前垫刀: {stats.currentPity5}</span>
                {effectivePity?.isInherited && isLimited && effectivePity.pity5 > 0 && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1"><Sparkles size={10}/> 继承: {effectivePity.pity5}</span>
                )}
             </div>
           }
        />
      </div>

      {/* Analytics Grid */}
      {(isLimited || isWeapon) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
           {/* Win Rate */}
           <StatCard 
             label="不歪率"
             extraLabel={isLimited ? "免十不计" : null}
             value={stats.sixStarCount > 0 ? `${stats.winRate}%` : '-'}
             progress={stats.sixStarCount > 0 ? parseFloat(stats.winRate) : 0}
             progressColor={isLimited ? 'rainbow-progress' : 'bg-blue-500'}
             footer={stats.sixStarCount > 0 ? `UP: ${stats.upSixStarCount} / 歪: ${stats.sixStarCount - stats.upSixStarCount}` : '暂无6星数据'}
           />
           {/* Average */}
           <StatCard 
             label="平均出货"
             extraLabel={isLimited ? "仅UP·免十不计" : isWeapon ? "仅UP" : null}
             value={stats.upSixStarCount > 0 ? formatNumber(stats.avgPullCost?.[6] || stats.avgPullsPerSixStar) : '-'}
             subValue={stats.upSixStarCount > 0 ? "抽/UP" : null}
             progress={0} // No progress bar for Avg, just the line
             progressColor="bg-transparent"
             footer={stats.upSixStarCount > 0 ? "基于UP角色出货统计" : '暂无UP数据'}
           />
        </div>
      )}

      {/* Special Progress Section (Technical List Style) */}
      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-endfield-border">
         <div className="text-[10px] uppercase text-slate-500 dark:text-endfield-muted font-bold tracking-wider mb-2">特殊进度</div>
         
         {/* Limited Pool Specials */}
         {isLimited && (
           <>
             {/* 30 Pulls Gift */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-blue-500 flex flex-col gap-1">
               <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">赠送十连 (每30抽)</span>
                 <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">
                   {!multipleFreeTen && stats.freeTenPulls?.received >= 1
                     ? '已完成'
                     : `${stats.total % 30} / 30`}
                 </span>
               </div>
               <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                 <div className={`h-full ${!multipleFreeTen && stats.freeTenPulls?.received >= 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{width: `${!multipleFreeTen && stats.freeTenPulls?.received >= 1 ? 100 : ((stats.total % 30) / 30) * 100}%`}}></div>
               </div>
               <div className="flex justify-between items-center mt-1">
                 <span className="text-[9px] text-slate-500 dark:text-endfield-muted">不消耗保底次数</span>
                 {multipleFreeTen && stats.freeTenPulls?.count > 0 && (
                   <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold">
                     已获得: {stats.freeTenPulls?.received} / {stats.freeTenPulls?.count}
                   </span>
                 )}
                 {!multipleFreeTen && stats.freeTenPulls?.received >= 1 && (
                   <span className="text-[9px] text-green-600 dark:text-green-400 font-bold">已完成 (仅一次)</span>
                 )}
               </div>
             </div>

             {/* 120 Spark */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-green-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">必出限定 (120抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{pityInfo?.guaranteedUp?.hasReceived ? '已达成' : `${Math.min(stats.total, 120)} / 120`}</span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                  <div className={`h-full ${pityInfo?.guaranteedUp?.hasReceived ? 'bg-green-500' : 'rainbow-progress'}`} 
                       style={{width: `${pityInfo?.guaranteedUp?.hasReceived ? 100 : Math.min((stats.total / 120) * 100, 100)}%`}}></div>
                </div>
             </div>

             {/* 240 Potential */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-purple-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">赠送角色潜能 (每240抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{stats.total % 240} / 240</span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                  <div className="h-full bg-purple-500" style={{width: `${((stats.total % 240) / 240) * 100}%`}}></div>
                </div>
                {Math.floor(stats.total / 240) > 0 && <div className="text-right text-[9px] text-purple-600 dark:text-purple-400 font-bold">已获得: {Math.floor(stats.total / 240)}</div>}
             </div>

             {/* 60 Info Book */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-cyan-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold flex items-center gap-1"><FileText size={10}/> 寻访情报书 (60抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{stats.hasInfoBook ? '已达成' : `${Math.min(stats.total, 60)} / 60`}</span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                  <div className={`h-full ${stats.hasInfoBook ? 'bg-green-500' : 'bg-cyan-500'}`} 
                       style={{width: `${stats.hasInfoBook ? 100 : Math.min((stats.total / 60) * 100, 100)}%`}}></div>
                </div>
             </div>
           </>
         )}

         {/* Weapon Pool Specials */}
         {isWeapon && (
           <>
             {/* 80 Spark */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-slate-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">首轮限定必出 (80抽)</span>
                   <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{pityInfo?.guaranteedUp?.hasReceived ? '已达成' : `${Math.min(stats.total, 80)} / 80`}</span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                   <div className={`h-full ${pityInfo?.guaranteedUp?.hasReceived ? 'bg-green-500' : 'bg-slate-500'}`}
                        style={{width: `${pityInfo?.guaranteedUp?.hasReceived ? 100 : Math.min((stats.total / 80) * 100, 100)}%`}}></div>
                </div>
             </div>
             
             {/* Weapon Gifts */}
             {currentPool.isLimitedWeapon !== false && <WeaponGifts stats={stats} />}
           </>
         )}

         {/* Standard Pool Specials */}
         {isStandard && (
            <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-green-500 flex flex-col gap-1">
               <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">首次赠送自选 (300抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{Math.min(stats.total, 300)} / 300</span>
               </div>
               <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                  <div className={`h-full ${stats.total >= 300 ? 'bg-green-500' : 'bg-green-600/50'}`}
                       style={{width: `${Math.min((stats.total / 300) * 100, 100)}%`}}></div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default LimitedPoolAnalysis;