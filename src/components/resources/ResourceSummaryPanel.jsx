import React from 'react';
import {
  RESOURCE_ICON_URLS,
  RESOURCE_LABELS,
  formatOriginiteEquivalent
} from '../../utils/resourceEconomy';

function formatCompactNumber(value) {
  const numericValue = Number(value) || 0;
  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue < 10000) {
    return null;
  }

  const units = absoluteValue >= 100000000
    ? { divisor: 100000000, suffix: '亿' }
    : { divisor: 10000, suffix: '万' };
  const compactValue = (numericValue / units.divisor).toFixed(absoluteValue >= units.divisor * 100 ? 0 : 1);

  return `${compactValue.replace(/\.0$/, '')}${units.suffix}`;
}

function getItems(resources, variant) {
  if (!resources) {
    return [];
  }

  const baseItems = {
    jadeSpent: {
      key: 'jadeSpent',
      label: `总消耗${RESOURCE_LABELS.jade}`,
      rawValue: Number(resources.jadeSpent || 0),
      fullValue: Number(resources.jadeSpent || 0).toLocaleString(),
      icon: RESOURCE_ICON_URLS.jade,
      tone: 'text-cyan-600 dark:text-cyan-400'
    },
    originiteEquivalent: {
      key: 'originiteEquivalent',
      label: `${RESOURCE_LABELS.originite}等价`,
      rawValue: Number(resources.originiteEquivalent || 0),
      fullValue: formatOriginiteEquivalent(resources.originiteEquivalent || 0),
      icon: RESOURCE_ICON_URLS.originite,
      tone: 'text-amber-600 dark:text-amber-400'
    },
    arsenalGained: {
      key: 'arsenalGained',
      label: `共获得${RESOURCE_LABELS.arsenalQuota}`,
      rawValue: Number(resources.arsenalGained || 0),
      fullValue: Number(resources.arsenalGained || 0).toLocaleString(),
      icon: RESOURCE_ICON_URLS.arsenalQuota,
      tone: 'text-blue-600 dark:text-blue-400'
    },
    arsenalSpent: {
      key: 'arsenalSpent',
      label: `总消耗${RESOURCE_LABELS.arsenalQuota}`,
      rawValue: Number(resources.arsenalSpent || 0),
      fullValue: Number(resources.arsenalSpent || 0).toLocaleString(),
      icon: RESOURCE_ICON_URLS.arsenalQuota,
      tone: 'text-rose-600 dark:text-rose-400'
    },
    arsenalNet: {
      key: 'arsenalNet',
      label: `${RESOURCE_LABELS.arsenalQuota}净变动`,
      rawValue: Number(resources.arsenalNet || 0),
      fullValue: Number(resources.arsenalNet || 0).toLocaleString(),
      icon: RESOURCE_ICON_URLS.arsenalQuota,
      tone: Number(resources.arsenalNet || 0) >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400'
    }
  };

  if (variant === 'character') {
    return [
      baseItems.jadeSpent,
      baseItems.originiteEquivalent,
      baseItems.arsenalGained
    ];
  }

  if (variant === 'weapon') {
    return [
      baseItems.arsenalSpent
    ];
  }

  return [
    baseItems.jadeSpent,
    baseItems.originiteEquivalent,
    baseItems.arsenalGained,
    baseItems.arsenalSpent
  ];
}

const ResourceSummaryPanel = ({
  title = '资源换算',
  resources,
  variant = 'all',
  compact = false,
  stacked = false,
  className = ''
}) => {
  const items = getItems(resources, variant);

  if (items.length === 0) {
    return null;
  }

  const gridClass = (compact || stacked)
    ? 'grid-cols-1'
    : items.length === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className={`bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
        <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{title}</span>
      </div>
      <div className={`grid ${gridClass} gap-3`}>
        {items.map((item) => {
          const compactValue = formatCompactNumber(item.rawValue);
          return (
          <div key={item.key} className="min-w-0 flex items-center gap-3 border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/20 px-3 py-3">
            <img src={item.icon} alt={item.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                {item.label}
              </div>
              <div
                className={`text-base sm:text-lg xl:text-xl font-bold font-mono leading-tight ${item.tone}`}
                title={item.fullValue}
              >
                {compactValue || item.fullValue}
              </div>
              {compactValue && (
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono break-all">
                  {item.fullValue}
                </div>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};

export default ResourceSummaryPanel;
