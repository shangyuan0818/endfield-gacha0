import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

function formatAverage(value, t) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '--';
  }

  return `${numericValue.toFixed(2)} ${t('dashboard.unit.pull')}`;
}

function buildAverageItems({ stats, poolType, isAllPoolsOverview, t }) {
  const items = [
    {
      id: 'avg-5',
      label: t('dashboard.average.avg5'),
      value: formatAverage(stats?.avgPullCost?.[5], t),
      tone: 'text-amber-600 dark:text-amber-400'
    },
    {
      id: 'avg-6-all',
      label: t('dashboard.average.allSix'),
      value: formatAverage(stats?.avgPullCost?.['6_all'], t),
      tone: 'text-slate-700 dark:text-zinc-200'
    }
  ];

  if (poolType !== 'standard') {
    items.push({
      id: 'avg-6-target',
      label: poolType === 'weapon'
        ? t('dashboard.average.upWeapon')
        : isAllPoolsOverview ? t('dashboard.average.targetSix') : t('dashboard.average.upSix'),
      value: formatAverage(stats?.avgPullCost?.[6], t),
      tone: poolType === 'weapon'
        ? 'text-slate-700 dark:text-zinc-300'
        : 'text-fuchsia-600 dark:text-fuchsia-400'
    });
  }

  const showLimitedSixAverage = poolType !== 'weapon'
    && (poolType === 'limited' || isAllPoolsOverview);

  if (showLimitedSixAverage) {
    items.push({
      id: 'avg-6-limited',
      label: t('dashboard.average.limitedSix'),
      value: formatAverage(stats?.avgPullCost?.['6_limited'], t),
      tone: 'text-violet-600 dark:text-violet-400'
    });
  }

  return items;
}

function buildNote({ stats, poolType, isAllPoolsOverview, t }) {
  const baseNote = stats?.includeFreePullsInStats
    ? t('dashboard.average.noteBaseWithFree')
    : t('dashboard.average.noteBase');
  if (poolType === 'standard') {
    return t('dashboard.average.noteStandard', { base: baseNote });
  }

  const targetLabel = poolType === 'weapon'
    ? t('dashboard.average.upWeapon')
    : isAllPoolsOverview ? t('dashboard.average.targetSix') : t('dashboard.average.upSix');
  if (stats?.sparkCount > 0 && stats?.avgPullCost?.['6_with_spark']) {
    const sparkAverage = formatAverage(stats.avgPullCost['6_with_spark'], t);
    return t('dashboard.average.noteWithSpark', { base: baseNote, target: targetLabel, value: sparkAverage });
  }

  return t('dashboard.average.noteWithoutSpark', { base: baseNote, target: targetLabel });
}

const AveragePullStatsPanel = ({
  stats,
  poolType,
  isAllPoolsOverview = false,
  compact = false,
  mobile = false,
  className = ''
}) => {
  const { t } = useI18n();
  const totalPulls = Number(stats?.total) || 0;
  const items = useMemo(
    () => buildAverageItems({ stats, poolType, isAllPoolsOverview, t }),
    [isAllPoolsOverview, poolType, stats, t]
  );

  if (totalPulls <= 0) {
    return null;
  }

  const note = buildNote({ stats, poolType, isAllPoolsOverview, t });

  return (
    <div className={`${mobile ? 'mobile-ux-card' : 'border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900'} ${compact ? 'p-4' : 'p-5'} ${className}`.trim()}>
      <div className={`flex items-center gap-2 border-b pb-2 ${mobile ? 'border-zinc-200/90 dark:border-zinc-800' : 'border-zinc-100 dark:border-zinc-800'}`}>
        <TrendingUp size={16} className={mobile ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-400 dark:text-zinc-500'} />
        <h3 className={mobile ? 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500' : 'text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300'}>{t('dashboard.average.title')}</h3>
      </div>

      <div className={`mt-3 grid gap-2.5 ${compact ? 'grid-cols-2' : items.length >= 4 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3'}`}>
        {items.map((item) => (
          <div
            key={item.id}
            className={mobile ? 'mobile-ux-card-inset p-3' : 'border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/60'}
          >
            <div className={`text-[10px] font-bold uppercase tracking-wider ${mobile ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-500 dark:text-zinc-500'}`}>
              {item.label}
            </div>
            <div className={`mt-2 text-xl font-black font-mono ${item.tone}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-2.5 text-[11px] font-mono ${mobile ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-500 dark:text-zinc-400'}`}>
        {note}
      </div>
    </div>
  );
};

export default AveragePullStatsPanel;
