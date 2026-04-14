import React from 'react';
import {
  RESOURCE_ICON_URLS,
  formatOriginiteEquivalent
} from '../../utils/resourceEconomy';
import { useI18n } from '../../i18n/index.js';

function formatCompactNumber(value, locale) {
  const numericValue = Number(value) || 0;
  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue < 10000) {
    return null;
  }

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numericValue);
}

function getItems(resources, variant, t, formatNumber) {
  if (!resources) {
    return [];
  }

  const baseItems = {
    jadeSpent: {
      key: 'jadeSpent',
      label: t('dashboard.resources.jadeSpent'),
      rawValue: Number(resources.jadeSpent || 0),
      fullValue: formatNumber(resources.jadeSpent || 0),
      icon: RESOURCE_ICON_URLS.jade,
      tone: 'text-cyan-600 dark:text-cyan-400'
    },
    originiteEquivalent: {
      key: 'originiteEquivalent',
      label: t('dashboard.resources.originiteEquivalent'),
      rawValue: Number(resources.originiteEquivalent || 0),
      fullValue: formatNumber(Number(formatOriginiteEquivalent(resources.originiteEquivalent || 0)), {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }),
      icon: RESOURCE_ICON_URLS.originite,
      tone: 'text-amber-600 dark:text-amber-400'
    },
    arsenalGained: {
      key: 'arsenalGained',
      label: t('dashboard.resources.arsenalGained'),
      rawValue: Number(resources.arsenalGained || 0),
      fullValue: formatNumber(resources.arsenalGained || 0),
      icon: RESOURCE_ICON_URLS.arsenalQuota,
      tone: 'text-blue-600 dark:text-blue-400'
    },
    arsenalSpent: {
      key: 'arsenalSpent',
      label: t('dashboard.resources.arsenalSpent'),
      rawValue: Number(resources.arsenalSpent || 0),
      fullValue: formatNumber(resources.arsenalSpent || 0),
      icon: RESOURCE_ICON_URLS.arsenalQuota,
      tone: 'text-rose-600 dark:text-rose-400'
    },
    arsenalNet: {
      key: 'arsenalNet',
      label: t('dashboard.resources.arsenalNet'),
      rawValue: Number(resources.arsenalNet || 0),
      fullValue: formatNumber(resources.arsenalNet || 0),
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
  layout = 'grid',
  mobile = false,
  className = ''
}) => {
  const { locale, t, formatNumber } = useI18n();
  const items = getItems(resources, variant, t, formatNumber);

  if (items.length === 0) {
    return null;
  }

  const gridClass = (compact || stacked)
    ? 'grid-cols-1'
    : items.length === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  const renderItem = (item) => {
    const compactValue = formatCompactNumber(item.rawValue, locale);
    return (
      <div
        key={item.key}
        className={`min-w-0 flex items-center gap-3 px-3 py-2.5 ${
          mobile
            ? 'mobile-ux-card-inset'
            : 'border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-black/20'
        }`}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${mobile ? 'mobile-ux-card-chip' : 'rounded-lg border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/70'}`}>
          <img src={item.icon} alt={item.label} loading="lazy" className="h-7 w-7 object-contain shrink-0" />
        </div>
        <div className="min-w-0">
          <div className={`text-[10px] uppercase tracking-wider font-bold ${mobile ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-600 dark:text-zinc-500 dark:text-slate-500 dark:text-zinc-400'}`}>
            {item.label}
          </div>
          <div
            className={`text-base sm:text-lg xl:text-xl font-bold font-mono leading-tight ${item.tone}`}
            title={item.fullValue}
          >
            {compactValue || item.fullValue}
          </div>
          {compactValue && (
            <div className={`mt-1 text-[11px] font-mono break-all ${mobile ? 'text-slate-600 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-500 dark:text-slate-500 dark:text-zinc-400'}`}>
              {item.fullValue}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${mobile ? 'mobile-ux-card' : 'border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/30'} ${mobile ? 'p-4' : 'p-5'} ${className}`}>
      <div className={`mb-3 flex items-center gap-2 pb-2 border-b border-dashed ${mobile ? 'border-zinc-200/90 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
        <span className={`${mobile ? 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-zinc-500' : 'text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300'}`}>{title}</span>
      </div>
      {layout === 'two-plus-one' && items.length === 3 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {items.slice(0, 2).map(renderItem)}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {items.slice(2).map(renderItem)}
          </div>
        </div>
      ) : (
        <div className={`grid ${gridClass} gap-2.5`}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
};

export default ResourceSummaryPanel;
