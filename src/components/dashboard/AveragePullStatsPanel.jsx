import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';

function formatAverage(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '--';
  }

  return `${numericValue.toFixed(2)} 抽`;
}

function buildAverageItems({ stats, poolType, isAllPoolsOverview }) {
  const items = [
    {
      id: 'avg-5',
      label: '5★ 平均',
      value: formatAverage(stats?.avgPullCost?.[5]),
      tone: 'text-amber-600 dark:text-amber-400'
    },
    {
      id: 'avg-6-all',
      label: '全部 6★',
      value: formatAverage(stats?.avgPullCost?.['6_all']),
      tone: 'text-slate-700 dark:text-zinc-200'
    }
  ];

  if (poolType !== 'standard') {
    items.push({
      id: 'avg-6-target',
      label: isAllPoolsOverview ? '目标 6★' : 'UP 6★',
      value: formatAverage(stats?.avgPullCost?.[6]),
      tone: poolType === 'weapon'
        ? 'text-slate-700 dark:text-zinc-300'
        : 'text-fuchsia-600 dark:text-fuchsia-400'
    });
  }

  if (poolType === 'limited' || isAllPoolsOverview) {
    items.push({
      id: 'avg-6-limited',
      label: '限定 6★',
      value: formatAverage(stats?.avgPullCost?.['6_limited']),
      tone: 'text-violet-600 dark:text-violet-400'
    });
  }

  return items;
}

function buildNote({ stats, poolType, isAllPoolsOverview }) {
  const baseNote = '口径：排除赠送与免费十连；情报书计入有效抽数。';
  if (poolType === 'standard') {
    return `${baseNote} 常驻池仅展示 5★ 与全部 6★ 平均。`;
  }

  if (stats?.sparkCount > 0 && stats?.avgPullCost?.['6_with_spark']) {
    const sparkAverage = formatAverage(stats.avgPullCost['6_with_spark']);
    return `${baseNote} ${isAllPoolsOverview ? '目标 6★' : 'UP 6★'}默认不含井；含井口径为 ${sparkAverage}。`;
  }

  return `${baseNote} ${isAllPoolsOverview ? '目标 6★' : 'UP 6★'}默认不含井。`;
}

const AveragePullStatsPanel = ({
  stats,
  poolType,
  isAllPoolsOverview = false,
  compact = false,
  className = ''
}) => {
  const totalPulls = Number(stats?.total) || 0;
  const items = useMemo(
    () => buildAverageItems({ stats, poolType, isAllPoolsOverview }),
    [isAllPoolsOverview, poolType, stats]
  );

  if (totalPulls <= 0) {
    return null;
  }

  const note = buildNote({ stats, poolType, isAllPoolsOverview });

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm ${compact ? 'p-4' : 'p-5'} ${className}`.trim()}>
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <TrendingUp size={16} className="text-slate-400 dark:text-zinc-500" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">平均出货</h3>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-2' : items.length >= 4 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3'}`}>
        {items.map((item) => (
          <div
            key={item.id}
            className="border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              {item.label}
            </div>
            <div className={`mt-2 text-xl font-black font-mono ${item.tone}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
        {note}
      </div>
    </div>
  );
};

export default AveragePullStatsPanel;
