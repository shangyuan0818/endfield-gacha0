import React from 'react';
import { Calculator, FileText, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import { localizeEntityName, localizePoolName } from '../../utils/gameDataI18n.js';

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
const WeaponGifts = ({ stats, locale, t }) => {
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

  const formatCount = (value) => new Intl.NumberFormat(locale).format(Number(value) || 0);
  const nextGiftTypeLabel =
    nextWeaponGiftType === 'limited' ? t('dashboard.analysis.limitedShort') : t('dashboard.analysis.standardShort');

  return (
    <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-red-500 flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-700 dark:text-endfield-text font-bold flex items-center gap-2">
          {t('dashboard.analysis.nextGift')}
          <span className={`px-1 rounded text-[8px] font-bold text-black ${nextWeaponGiftType === 'limited' ? 'rainbow-bg' : 'bg-red-500'}`}>
            {nextGiftTypeLabel}
          </span>
        </span>
        <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">
          {formatCount(stats.total)} / {formatCount(nextWeaponGift)}
        </span>
      </div>
      <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
        <div
          className={`h-full ${nextWeaponGiftType === 'limited' ? 'rainbow-progress' : 'bg-red-500'}`}
          style={{ width: `${Math.min((stats.total / nextWeaponGift) * 100, 100)}%` }}
        />
      </div>
      <div className="flex gap-2 text-[9px] text-slate-500 dark:text-endfield-muted font-mono mt-1">
        <span>{t('dashboard.analysis.obtainedSummary')}</span>
        <span className="text-red-500 dark:text-red-400">
          {formatCount(stats.gifts?.standardCount || 0)} {t('dashboard.analysis.standardShort')}
        </span>
        <span className="text-blue-500 dark:text-cyan-400">
          {formatCount(stats.gifts?.limitedCount || 0)} {t('dashboard.analysis.limitedShort')}
        </span>
      </div>
    </div>
  );
};

const LimitedPoolAnalysis = ({ currentPool, stats, effectivePity, pityInfo, multipleFreeTen = false }) => {
  const { t, locale } = useI18n();
  const isLimited = currentPool.type === 'limited';
  const isWeapon = currentPool.type === 'weapon';
  const isStandard = currentPool.type === 'standard';
  const targetProbabilityInfo = stats.targetProbabilityInfo;
  const currentTargetProbabilityPercent = targetProbabilityInfo
    ? (targetProbabilityInfo.probability * 100).toFixed(2)
    : null;
  const targetRatePercent = targetProbabilityInfo
    ? (targetProbabilityInfo.targetRate * 100).toFixed(1)
    : null;
  const targetLabel = isWeapon ? t('simulator.analysis.targetWeapon') : t('simulator.analysis.targetCharacter');
  const targetRateLabel = isWeapon ? t('simulator.analysis.targetRate') : t('simulator.analysis.upRate');
  const targetProbabilityFooter = targetProbabilityInfo
    ? targetProbabilityInfo.isHardGuaranteeNextPull
      ? t('simulator.analysis.targetGuaranteed', { label: targetLabel })
      : t('simulator.analysis.targetProbabilityDetail', {
          label: targetLabel,
          current: currentTargetProbabilityPercent,
          rateLabel: targetRateLabel,
          rate: targetRatePercent,
        })
    : t('simulator.analysis.noTargetProbability');

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
  const formatCount = (value) => new Intl.NumberFormat(locale).format(Number(value) || 0);
  const formatProgress = (current, target) => `${formatCount(current)} / ${formatCount(target)}`;
  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '-') return '-';
    const val = parseFloat(num);
    if (Number.isNaN(val)) return num;
    return val.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(val) ? 0 : 1,
    });
  };
  const localizedCurrentPoolName = localizePoolName(currentPool, { locale }) || currentPool?.name || '-';
  const localizedUpCharacter = localizeEntityName(currentPool?.up_character || '', {
    locale,
    type: isWeapon ? 'weapon' : 'character'
  });

  return (
    <div className="bg-white dark:bg-endfield-dark border border-zinc-200 dark:border-endfield-border p-6 relative overflow-hidden">
      {/* Decorative Side Bar */}
      <div className={`absolute top-0 left-0 w-1 h-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-600 dark:bg-slate-700' : 'bg-yellow-500 dark:bg-endfield-yellow'}`}></div>
      
      {/* Header */}
      <div className="flex justify-between items-end mb-6 pl-2">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-endfield-text flex items-center gap-2 uppercase tracking-wide">
            <Calculator size={20} className={accentColor} />
            {isWeapon
              ? t('dashboard.analysis.title.weapon')
              : isLimited
                ? t('dashboard.analysis.title.limited')
                : t('dashboard.analysis.title.standard')}
          </h3>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs text-slate-500 dark:text-endfield-muted uppercase">{t('dashboard.analysis.currentPool')}</span>
             <span className={`text-xs font-bold ${accentColor} uppercase`}>{localizedCurrentPoolName}</span>
          </div>
        </div>
        {(isLimited || isWeapon) && localizedUpCharacter && (
           <div className="text-right">
             <div className="text-[10px] text-slate-500 dark:text-endfield-muted uppercase">{t('pool.card.currentUp')}</div>
             <div className="text-sm font-bold text-slate-800 dark:text-endfield-text">{localizedUpCharacter}</div>
           </div>
        )}
      </div>

      {/* Pity Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard 
           label={t('dashboard.analysis.pity6', { max: maxPity })}
           value={formatCount(Math.max(maxPity - stats.currentPity, 0))}
           subValue={t('simulator.analysis.pullUnit')}
           progress={(stats.currentPity / maxPity) * 100}
           progressColor={progressClass}
           warning={
             stats.probabilityInfo?.hasSoftPity && stats.probabilityInfo?.isInSoftPity
               ? t('simulator.analysis.currentSixChance', {
                   percent: (stats.probabilityInfo.probability * 100).toFixed(1),
                 })
               : null
           }
           footer={
             <div className="flex justify-between">
                <span>{t('dashboard.analysis.currentPity', { count: formatCount(stats.currentPity) })}</span>
                {effectivePity?.isInherited && isLimited && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Sparkles size={10} />
                    {t('simulator.analysis.inheritedPity', { count: formatCount(effectivePity.pity6) })}
                  </span>
                )}
             </div>
           }
        />
        <StatCard 
           label={t('dashboard.analysis.pity5')}
           value={formatCount(Math.max(10 - stats.currentPity5, 0))}
           subValue={t('simulator.analysis.pullUnit')}
           progress={(stats.currentPity5 / 10) * 100}
           progressColor="bg-amber-500"
           footer={
             <div className="flex justify-between">
                <span>{t('dashboard.analysis.currentPity', { count: formatCount(stats.currentPity5) })}</span>
                {effectivePity?.isInherited && isLimited && effectivePity.pity5 > 0 && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Sparkles size={10} />
                    {t('simulator.analysis.inheritedPity', { count: formatCount(effectivePity.pity5) })}
                  </span>
                )}
             </div>
           }
        />
      </div>

      {/* Analytics Grid */}
      {(isLimited || isWeapon) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
           <StatCard 
             label={t('simulator.analysis.target6Chance')}
             extraLabel={targetProbabilityInfo?.isHardGuaranteeNextPull ? t('simulator.analysis.hardGuarantee') : t('simulator.analysis.dynamic')}
             value={targetProbabilityInfo ? `${currentTargetProbabilityPercent}%` : '-'}
             progress={targetProbabilityInfo ? parseFloat(currentTargetProbabilityPercent) : 0}
             progressColor={isLimited ? 'rainbow-progress' : 'bg-blue-500'}
             footer={
               stats.sixStarCount > 0
                 ? `${targetProbabilityFooter} · ${t('dashboard.analysis.winRate')} ${stats.winRate}%`
                 : targetProbabilityFooter
             }
           />
           <StatCard 
             label={t('simulator.analysis.averageTitle')}
             extraLabel={isLimited ? t('simulator.analysis.averageBadgeLimited') : isWeapon ? t('simulator.analysis.averageBadgeWeapon') : null}
             value={stats.upSixStarCount > 0 ? formatNumber(stats.avgPullCost?.[6] || stats.avgPullsPerSixStar) : '-'}
             subValue={stats.upSixStarCount > 0 ? t('simulator.analysis.averageUnitUp') : null}
             progress={0}
             progressColor="bg-transparent"
             footer={stats.upSixStarCount > 0 ? t('simulator.analysis.averageBasedOnUp') : t('simulator.analysis.noUpData')}
           />
        </div>
      )}

      {/* Special Progress Section (Technical List Style) */}
      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-endfield-border">
         <div className="text-[10px] uppercase text-slate-500 dark:text-endfield-muted font-bold tracking-wider mb-2">{t('dashboard.analysis.specialProgress')}</div>
         
         {/* Limited Pool Specials */}
         {isLimited && (
           <>
             {/* 30 Pulls Gift */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-blue-500 flex flex-col gap-1">
               <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">
                   {multipleFreeTen ? t('simulator.analysis.repeatedFreeTen') : t('dashboard.analysis.freeTenOnce')}
                 </span>
                 <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">
                   {!multipleFreeTen && stats.freeTenPulls?.received >= 1
                     ? t('dashboard.analysis.completed')
                     : formatProgress(stats.total % 30, 30)}
                 </span>
               </div>
               <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                 <div className={`h-full ${!multipleFreeTen && stats.freeTenPulls?.received >= 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{width: `${!multipleFreeTen && stats.freeTenPulls?.received >= 1 ? 100 : ((stats.total % 30) / 30) * 100}%`}}></div>
               </div>
               <div className="flex justify-between items-center mt-1">
                 <span className="text-[9px] text-slate-500 dark:text-endfield-muted">{t('dashboard.analysis.notCountPity')}</span>
                 {multipleFreeTen && stats.freeTenPulls?.count > 0 && (
                   <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold">
                     {t('dashboard.analysis.obtained', {
                       count: `${formatCount(stats.freeTenPulls?.received || 0)} / ${formatCount(stats.freeTenPulls?.count || 0)}`,
                     })}
                   </span>
                 )}
                 {!multipleFreeTen && stats.freeTenPulls?.received >= 1 && (
                   <span className="text-[9px] text-green-600 dark:text-green-400 font-bold">
                     {t('dashboard.analysis.completed')} ({t('simulator.analysis.oneTimeOnly')})
                   </span>
                 )}
               </div>
             </div>

             {/* 120 Spark */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-green-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">{t('dashboard.analysis.guaranteedLimited120')}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">
                    {pityInfo?.guaranteedUp?.hasReceived ? t('dashboard.analysis.reached') : formatProgress(Math.min(stats.total, 120), 120)}
                  </span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                  <div className={`h-full ${pityInfo?.guaranteedUp?.hasReceived ? 'bg-green-500' : 'rainbow-progress'}`} 
                       style={{width: `${pityInfo?.guaranteedUp?.hasReceived ? 100 : Math.min((stats.total / 120) * 100, 100)}%`}}></div>
                </div>
             </div>

             {/* 240 Potential */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-purple-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">{t('dashboard.analysis.potential240')}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{formatProgress(stats.total % 240, 240)}</span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                  <div className="h-full bg-purple-500" style={{width: `${((stats.total % 240) / 240) * 100}%`}}></div>
                </div>
                {Math.floor(stats.total / 240) > 0 && (
                  <div className="text-right text-[9px] text-purple-600 dark:text-purple-400 font-bold">
                    {t('dashboard.analysis.obtained', { count: formatCount(Math.floor(stats.total / 240)) })}
                  </div>
                )}
             </div>

             {/* 60 Info Book */}
             <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-cyan-500 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold flex items-center gap-1"><FileText size={10}/> {t('dashboard.analysis.infoBook60')}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">
                    {stats.hasInfoBook ? t('dashboard.analysis.reached') : formatProgress(Math.min(stats.total, 60), 60)}
                  </span>
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
                   <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">{t('dashboard.analysis.guaranteedWeapon80')}</span>
                   <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">
                     {pityInfo?.guaranteedUp?.hasReceived ? t('dashboard.analysis.reached') : formatProgress(Math.min(stats.total, 80), 80)}
                   </span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 w-full overflow-hidden">
                   <div className={`h-full ${pityInfo?.guaranteedUp?.hasReceived ? 'bg-green-500' : 'bg-slate-500'}`}
                        style={{width: `${pityInfo?.guaranteedUp?.hasReceived ? 100 : Math.min((stats.total / 80) * 100, 100)}%`}}></div>
                </div>
             </div>
             
             {/* Weapon Gifts */}
             {currentPool.isLimitedWeapon !== false && <WeaponGifts stats={stats} locale={locale} t={t} />}
           </>
         )}

         {/* Standard Pool Specials */}
         {isStandard && (
            <div className="bg-zinc-50 dark:bg-endfield-panel p-2 border-l-2 border-green-500 flex flex-col gap-1">
               <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 dark:text-endfield-text font-bold">{t('dashboard.analysis.firstSelector300')}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-endfield-muted">{formatProgress(Math.min(stats.total, 300), 300)}</span>
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
