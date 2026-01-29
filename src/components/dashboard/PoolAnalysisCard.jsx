import React, { useState, useEffect } from 'react';
import { Calculator, Sparkles, FileText, Clock } from 'lucide-react';
import { getCurrentUpPool } from '../../constants';

/**
 * 卡池时间信息组件 - 实时更新 (内部组件)
 */
const PoolTimeInfo = () => {
  const [currentUpPool, setCurrentUpPool] = useState(() => getCurrentUpPool());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUpPool(getCurrentUpPool());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const startDate = new Date(currentUpPool.startDate);
  const endDate = currentUpPool.endDate instanceof Date ? currentUpPool.endDate : new Date(currentUpPool.endDate);

  const formatDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`;
  };

  const isExpired = currentUpPool.isExpired;
  const remainingDays = currentUpPool.remainingDays ?? 0;
  const remainingHours = currentUpPool.remainingHours ?? 0;
  const isEndingSoon = remainingDays <= 3 && currentUpPool.isActive && !isExpired;
  const isNotStarted = !currentUpPool.isActive && !isExpired && (currentUpPool.startsIn !== undefined || currentUpPool.startsInHours !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-500 font-mono mt-1">
      <Clock size={10} />
      <span className="flex items-center gap-1">
        {isNotStarted ? (
          <span className="text-slate-400">即将开始</span>
        ) : isExpired ? (
          <span className="text-red-400">已结束</span>
        ) : (
          <span className="text-green-600 dark:text-green-400">UP中</span>
        )}
      </span>
      <span className="text-slate-300 dark:text-zinc-700">|</span>
      <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
      <span className="text-slate-300 dark:text-zinc-700">|</span>
      {isNotStarted ? (
        <span className="text-blue-500">{currentUpPool.startsIn}天{currentUpPool.startsInHours}小时后开始</span>
      ) : isExpired ? (
        <span className="text-red-500 font-medium">已结束</span>
      ) : isEndingSoon ? (
        <span className="text-amber-500 font-medium animate-pulse">剩 {remainingDays}天{remainingHours}小时</span>
      ) : (
        <span className="text-green-500">剩 {remainingDays}天{remainingHours}小时</span>
      )}
    </div>
  );
};

/**
 * 通用统计卡片组件
 */
const StatCard = ({ label, value, subValue, footer, progress, progressColor, extraLabel, warning }) => (
  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 relative group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
    <div className="flex justify-between items-start mb-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-bold flex items-center gap-2">
        {label}
        {extraLabel && <span className="bg-zinc-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1 py-0.5 text-[9px] rounded-sm">{extraLabel}</span>}
      </div>
      {warning && (
        <div className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-[9px] font-mono animate-pulse rounded-sm">
          {warning}
        </div>
      )}
    </div>
    
    <div className="flex items-baseline gap-2 mb-3">
      <span className="text-3xl font-bold font-mono text-slate-800 dark:text-zinc-100">{value}</span>
      {subValue && <span className="text-sm font-mono text-slate-500 dark:text-zinc-500">{subValue}</span>}
    </div>

    <div className="relative h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden rounded-sm">
      <div 
        className={`absolute top-0 left-0 h-full transition-all duration-500 ${progressColor}`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      ></div>
    </div>

    {footer && <div className="mt-2 text-[10px] text-slate-500 dark:text-zinc-500 font-mono flex justify-between items-center">{footer}</div>}
  </div>
);

/**
 * 武器池赠送进度组件
 */
const WeaponGifts = ({ stats }) => {
  // 计算下一档赠送阈值
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

  // 超过500抽循环计算
  if (nextWeaponGift === 0) {
    const cycle = Math.floor((stats.total - 180) / 160);
    nextWeaponGift = 180 + (cycle + 1) * 160;
    nextWeaponGiftType = nextWeaponGift % 160 === 20 ? 'limited' : 'standard';
  }

  return (
      <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-red-500 flex flex-col gap-2">
          <div className="flex justify-between items-center">
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold flex items-center gap-2">
                  下一档赠送
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${nextWeaponGiftType === 'limited' ? 'rainbow-bg' : 'bg-red-500'}`}>
                    {nextWeaponGiftType === 'limited' ? '限定' : '常驻'}
                  </span>
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">{stats.total} / {nextWeaponGift}</span>
          </div>
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
             <div className={`h-full ${nextWeaponGiftType === 'limited' ? 'rainbow-progress' : 'bg-red-500'}`}
                  style={{ width: `${Math.min((stats.total / nextWeaponGift) * 100, 100)}%` }}></div>
          </div>
          <div className="flex gap-3 text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
              <span>已获得:</span>
              <span className="text-red-600 dark:text-red-400 font-medium">{stats.gifts?.standardCount || 0} 常驻</span>
              <span className="text-blue-600 dark:text-cyan-400 font-medium">{stats.gifts?.limitedCount || 0} 限定</span>
          </div>
      </div>
  );
};

/**
 * 卡池分析卡片 (Dashboard Version)
 */
const PoolAnalysisCard = ({ currentPool, stats, effectivePity, checkLimitedInFirstN, hasReceivedFreeTen }) => {
  const isLimited = currentPool.type === 'limited';
  const isWeapon = currentPool.type === 'weapon';
  const isStandard = currentPool.type === 'standard';

  const maxPity = isWeapon ? 40 : 80;
  
  // 颜色主题
  const accentColor = isLimited 
    ? 'text-blue-600 dark:text-cyan-400' 
    : isWeapon 
      ? 'text-slate-600 dark:text-slate-400' 
      : 'text-yellow-600 dark:text-endfield-yellow';
      
  const progressClass = isLimited 
    ? 'rainbow-progress' 
    : isWeapon 
      ? 'bg-slate-500' 
      : 'bg-yellow-500';

  const validPullCount = checkLimitedInFirstN?.validPullCount || stats.total;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden shadow-sm">
      {/* 侧边装饰条 */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-600 dark:bg-slate-500' : 'bg-yellow-500'}`}></div>
      
      {/* 标题区域 */}
      <div className="mb-6 pl-2">
        <div className="flex justify-between items-start">
           <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wide">
             <Calculator size={20} className={accentColor} />
             {isWeapon ? '武器池分析' : isLimited ? '限定池分析' : '常驻池分析'}
           </h3>
           {/* UP角色显示 */}
           {currentPool.up_character && (
             <div className="text-right">
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-medium">UP 角色</div>
                <div className="text-sm font-bold text-slate-800 dark:text-zinc-200">{currentPool.up_character}</div>
             </div>
           )}
        </div>
        
        <div className="mt-2">
           <div className="flex items-center gap-2">
             <span className="text-xs text-slate-400 dark:text-zinc-500 uppercase font-medium">当前卡池:</span>
             <span className={`text-xs font-bold ${accentColor} uppercase`}>{currentPool.name}</span>
           </div>
           
           {/* 时间信息只在限定池显示 */}
           {isLimited && <PoolTimeInfo />}
        </div>
      </div>

      {/* 保底信息网格 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* 6星保底 */}
        <StatCard 
           label={`6星保底 (${maxPity})`}
           value={Math.max(maxPity - stats.currentPity, 0)}
           subValue="抽"
           progress={(stats.currentPity / maxPity) * 100}
           progressColor={progressClass}
           warning={stats.probabilityInfo?.hasSoftPity && stats.probabilityInfo?.isInSoftPity ? `概率UP ${(stats.probabilityInfo.probability * 100).toFixed(1)}%` : null}
           footer={
             <>
                <span>当前垫刀: {stats.currentPity}</span>
                {effectivePity?.isInherited && isLimited && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1"><Sparkles size={10}/> 继承: {effectivePity.pity6}</span>
                )}
             </>
           }
        />
        {/* 5星保底 */}
        <StatCard 
           label="5星保底 (10)"
           value={Math.max(10 - stats.currentPity5, 0)}
           subValue="抽"
           progress={(stats.currentPity5 / 10) * 100}
           progressColor="bg-amber-500"
           footer={
             <>
                <span>当前垫刀: {stats.currentPity5}</span>
                {effectivePity?.isInherited && isLimited && effectivePity.pity5 > 0 && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1"><Sparkles size={10}/> 继承: {effectivePity.pity5}</span>
                )}
             </>
           }
        />
      </div>

      {/* 数据概览网格 (限定/武器池显示) */}
      {(isLimited || isWeapon) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
           {/* 不歪率 */}
           <StatCard 
             label="不歪率"
             extraLabel={isLimited ? "免十不计" : null}
             value={stats.sixStarCount > 0 ? `${stats.winRate}%` : '-'}
             progress={stats.sixStarCount > 0 ? parseFloat(stats.winRate) : 0}
             progressColor={isLimited ? 'rainbow-progress' : 'bg-blue-500'}
             footer={
               stats.sixStarCount > 0 
                 ? <span className="truncate">UP: {stats.upSixStarCount} / 歪: {stats.sixStarCount - stats.upSixStarCount}</span>
                 : '暂无6星数据'
             }
           />
           {/* 平均出货 */}
           {(() => {
             // 理论期望值：角色池约62.5抽，武器池约31.25抽
             const expectedPulls = isWeapon ? 31.25 : 62.5;
             const avgValue = parseFloat(stats.avgPullCost?.[6]) || 0;
             // 进度条显示：期望值=50%，越低越好（绿色），越高越差（红色）
             const progressPercent = avgValue > 0 ? Math.min((expectedPulls / avgValue) * 50, 100) : 0;
             const isLucky = avgValue > 0 && avgValue < expectedPulls;
             
             return (
               <StatCard 
                 label="平均出货"
                 extraLabel={isLimited ? "仅UP·免十不计" : isWeapon ? "仅UP" : null}
                 value={stats.upSixStarCount > 0 ? stats.avgPullCost?.[6] : '-'}
                 subValue={stats.upSixStarCount > 0 ? "抽" : null}
                 progress={progressPercent}
                 progressColor={isLucky ? 'bg-green-500' : 'bg-amber-500'}
                 footer={
                   stats.upSixStarCount > 0 
                     ? <span className="flex justify-between">
                         <span>期望: ~{expectedPulls}抽</span>
                         {isLucky && <span className="text-green-600 dark:text-green-400">运气不错!</span>}
                       </span>
                     : '暂无UP数据'
                 }
               />
             );
           })()}
        </div>
      )}

      {/* 特殊进度列表 (Technical List Style) */}
      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
         <div className="text-[10px] uppercase text-slate-500 dark:text-zinc-500 font-bold tracking-wider mb-2">特殊机制进度</div>
         
         {/* 限定池特殊进度 */}
         {isLimited && (
           <>
             {/* 免费十连 */}
             <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-blue-500 flex flex-col gap-2">
               <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold">免费十连 (仅一次)</span>
                 <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">
                   {hasReceivedFreeTen ? '已领取' : '0 / 1'}
                 </span>
               </div>
               <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
                 <div className={`h-full ${hasReceivedFreeTen ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{width: `${hasReceivedFreeTen ? 100 : 0}%`}}></div>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 dark:text-zinc-500">不计入保底次数</span>
                 {hasReceivedFreeTen && (
                   <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">已完成</span>
                 )}
               </div>
             </div>

             {/* 120 Spark */}
             <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-green-500 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold">必出限定 (120抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">
                    {checkLimitedInFirstN?.firstLimitedIndex120 > 0 ? '已达成' : `${Math.min(validPullCount, 120)} / 120`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
                  <div className={`h-full ${checkLimitedInFirstN?.firstLimitedIndex120 > 0 ? 'bg-green-500' : 'rainbow-progress'}`} 
                       style={{width: `${checkLimitedInFirstN?.firstLimitedIndex120 > 0 ? 100 : Math.min((validPullCount / 120) * 100, 100)}%`}}></div>
                </div>
             </div>

             {/* 240 Potential */}
             <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-purple-500 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold">赠送角色潜能 (每240抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">{stats.total % 240} / 240</span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
                  <div className="h-full bg-purple-500" style={{width: `${((stats.total % 240) / 240) * 100}%`}}></div>
                </div>
                {Math.floor(stats.total / 240) > 0 && <div className="text-right text-[10px] text-purple-600 dark:text-purple-400 font-bold">已获得: {Math.floor(stats.total / 240)}</div>}
             </div>

             {/* 60 Info Book */}
             <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-cyan-500 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold flex items-center gap-1"><FileText size={12}/> 寻访情报书 (60抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">{stats.hasInfoBook ? '已达成' : `${Math.min(stats.total, 60)} / 60`}</span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
                  <div className={`h-full ${stats.hasInfoBook ? 'bg-green-500' : 'bg-cyan-500'}`} 
                       style={{width: `${stats.hasInfoBook ? 100 : Math.min((stats.total / 60) * 100, 100)}%`}}></div>
                </div>
             </div>
           </>
         )}

         {/* 武器池特殊进度 */}
         {isWeapon && (
           <>
             {/* 80 Spark */}
             <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-slate-500 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold">首轮限定必出 (80抽)</span>
                   <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">
                     {checkLimitedInFirstN?.firstLimitedIndex80 > 0 ? '已达成' : `${Math.min(stats.total, 80)} / 80`}
                   </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
                   <div className={`h-full ${checkLimitedInFirstN?.firstLimitedIndex80 > 0 ? 'bg-green-500' : 'bg-slate-500'}`}
                        style={{width: `${checkLimitedInFirstN?.firstLimitedIndex80 > 0 ? 100 : Math.min((stats.total / 80) * 100, 100)}%`}}></div>
                </div>
             </div>
             
             {/* 武器赠送 */}
             {currentPool.isLimitedWeapon !== false && <WeaponGifts stats={stats} />}
           </>
         )}

         {/* 常驻池特殊进度 */}
         {isStandard && (
            <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-l-2 border-green-500 flex flex-col gap-2">
               <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-zinc-300 font-bold">首次赠送自选 (300抽)</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">{Math.min(stats.total, 300)} / 300</span>
               </div>
               <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden rounded-sm">
                  <div className={`h-full ${stats.total >= 300 ? 'bg-green-500' : 'bg-green-600/50'}`}
                       style={{width: `${Math.min((stats.total / 300) * 100, 100)}%`}}></div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default PoolAnalysisCard;