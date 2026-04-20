import React, { useMemo } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';
import {
  buildDashboardTimelineSections,
  countDashboardTimelineNodes
} from '../../utils/dashboardTimelineSections.js';
import { useI18n } from '../../i18n/index.js';
import { getTimelineBarColor, getTimelineTextBadgeStyle } from '../../utils/timelineVisuals.js';

function formatAverage(value, t) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(1)} ${t('dashboard.unit.pull')}`;
}

function getTimelineTone(type) {
  if (type === 'extra') {
    return {
      rail: 'bg-cyan-400 dark:bg-cyan-500',
      chip: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-300/60 dark:border-cyan-500/30',
      accent: 'text-cyan-700 dark:text-cyan-300'
    };
  }

  if (type === 'weapon') {
    return {
      rail: 'bg-amber-400 dark:bg-amber-500',
      chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/30',
      accent: 'text-amber-700 dark:text-amber-300'
    };
  }

  if (type === 'standard') {
    return {
      rail: 'bg-blue-400 dark:bg-blue-500',
      chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-500/30',
      accent: 'text-blue-700 dark:text-blue-300'
    };
  }

  return {
    rail: 'bg-fuchsia-400 dark:bg-fuchsia-500',
    chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/60 dark:border-fuchsia-500/30',
    accent: 'text-fuchsia-700 dark:text-fuchsia-300'
  };
}

function getSectionTypeLabel(type, t) {
  if (type === 'extra') {
    return t('dashboard.timeline.section.extra');
  }

  if (type === 'weapon') {
    return t('dashboard.timeline.section.weapon');
  }

  if (type === 'standard') {
    return t('dashboard.timeline.section.standard');
  }

  return t('dashboard.timeline.section.limited');
}

function getStatusText(status, t) {
  if (!status?.isTimed) {
    return t('dashboard.timeline.status.alwaysOn');
  }

  if (status.isActive) {
    return status.remainingLabel || t('dashboard.timeline.status.active');
  }

  if (status.isUpcoming) {
    return status.remainingLabel || t('dashboard.timeline.status.upcoming');
  }

  return t('dashboard.timeline.status.ended');
}

function getLeadBadge(entry, featured) {
  return entry.leadBadge || entry.dropBadges[0] || {
    label: featured || '?',
    rarity: 0
  };
}

function getStampConfig(entry, sectionType, t) {
  if (entry.stageKind === 'gift') {
    return {
      label: t('dashboard.timeline.badge.free'),
      className: 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-300'
    };
  }

  if (entry.stageKind === 'up') {
    return {
      label: 'UP',
      className: 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-300'
    };
  }

  if (entry.stageKind === 'offStandard' || entry.stageKind === 'offLimited') {
    if (sectionType === 'limited' || sectionType === 'extra' || sectionType === 'weapon') {
      return {
        label: t('dashboard.timeline.badge.offrate'),
        className: 'border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-500/70 dark:bg-rose-500/10 dark:text-rose-400'
      };
    }

    if (sectionType === 'standard') {
      return null;
    }

    return {
      label: t('dashboard.timeline.badge.offrate'),
      className: 'border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-500/70 dark:bg-rose-500/10 dark:text-rose-400'
    };
  }

  if (entry.stageKind === 'fiveStar') {
    return {
      label: '5★',
      className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-300'
    };
  }

  if (entry.isCurrentStage) {
    return {
      label: t('dashboard.timeline.badge.progress'),
      className: 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300'
    };
  }

  return null;
}

function getVisibleDropBadges(entry, showFiveStarDrops) {
  const badges = Array.isArray(entry?.dropBadges) ? entry.dropBadges : [];
  return showFiveStarDrops ? badges : badges.filter((badge) => Number(badge?.rarity) >= 6);
}

function getVisibleResultSummary(entry, showFiveStarDrops) {
  if (showFiveStarDrops) {
    return entry.resultSummary;
  }

  return entry.resultSummaryWithoutFiveStar || entry.resultSummary;
}

function renderResultSummary(entry, summary, mobile = false) {
  const segments = String(summary || '').split(/(6★|5★)/g);
  return segments.map((segment, index) => {
    if (segment !== '6★' && segment !== '5★') {
      return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
    }

    const style = getTimelineTextBadgeStyle(entry, segment === '6★' ? 6 : 5, mobile ? 'dark' : 'light');
    return (
      <span
        key={`${segment}-${index}`}
        className="mx-0.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.88em] font-black leading-none"
        style={style || undefined}
      >
        {segment}
      </span>
    );
  });
}

function StagePortrait({ entry, featured, compact = false, t }) {
  const leadBadge = getLeadBadge(entry, featured);
  const isSixStar = leadBadge.rarity >= 6;
  const portraitTone = isSixStar
    ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400'
    : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400';
  const sizeClass = compact ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-12 w-12 sm:h-14 sm:w-14';

  return (
    <div className={`relative ${sizeClass} shrink-0 overflow-hidden border ${portraitTone} flex flex-col items-center justify-center`}>
      {leadBadge.avatarUrl ? (
        <img
          src={leadBadge.avatarUrl}
          alt={leadBadge.label}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} mt-1 font-black tracking-tight`}>
          {leadBadge.label.slice(0, 1) || '?'}
        </div>
      )}
      <div className="absolute top-0 right-0 bg-zinc-900 px-1 py-[1px] text-[8px] font-bold leading-none text-white dark:bg-zinc-100 dark:text-zinc-900">
        {leadBadge.rarity > 0 ? `${leadBadge.rarity}★` : t('dashboard.timeline.badge.stage')}
      </div>
    </div>
  );
}

function StageBadge({ badge, compact = false, mobile = false }) {
  const isSixStar = badge.rarity >= 6;
  return (
    <div className={`flex items-center gap-1.5 p-0.5 ${mobile ? 'mobile-ux-card-chip' : 'border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900'} ${compact ? 'pr-1.5' : 'pr-2'}`}>
      <div className={`relative flex items-center justify-center overflow-hidden font-black ${compact ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'} ${isSixStar ? 'bg-yellow-400/80 text-yellow-900 dark:bg-yellow-500/80' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'}`}>
        {badge.avatarUrl ? (
          <img
            src={badge.avatarUrl}
            alt={badge.label}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          badge.label.slice(0, 1)
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold leading-none text-zinc-700 dark:text-zinc-300`}>{badge.label}</span>
        {(badge.rarity < 6 || badge.count > 1) && (
          <span className="text-[10px] font-black font-mono text-zinc-400 dark:text-zinc-500">x{badge.count}</span>
        )}
      </div>
    </div>
  );
}

function MetricItem({ label, value, mobile = false }) {
  return (
      <div className={`min-w-0 border-l pl-3 ${mobile ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${mobile ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-500 dark:text-zinc-500'}`}>{label}</div>
      <div className={`mt-1 text-sm font-black font-mono ${mobile ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-800 dark:text-zinc-100'}`}>{value}</div>
    </div>
  );
}

function TimelineStageCard({ entry, sectionType, featured, t, mobile = false, showFiveStarDrops = true }) {
  const compact = entry.stageKind === 'fiveStar';
  const visibleBadges = getVisibleDropBadges(entry, showFiveStarDrops);
  const resultSummary = getVisibleResultSummary(entry, showFiveStarDrops);
  const stamp = getStampConfig(entry, sectionType, t);
  const widthPercent = entry.stageKind === 'gift'
    ? 100
    : Math.max(
    compact ? 10 : 12,
    Math.min(100, (entry.pulls / Math.max(entry.targetPulls || 1, 1)) * 100)
  );

  return (
    <div className="relative flex gap-3 sm:gap-5 group">
      <div className={`flex flex-col items-center shrink-0 relative z-10 ${compact ? 'w-10 sm:w-12' : 'w-12 sm:w-16'}`}>
        <StagePortrait entry={entry} featured={featured} compact={compact} t={t} />
        <span className={`mt-2 font-black font-mono ${mobile ? 'text-slate-500 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'} ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-[11px]'}`}>
          {entry.dateLabel}
        </span>
      </div>

      <div className={`flex-1 min-w-0 border-b ${mobile ? 'border-zinc-200/90 dark:border-zinc-800/70' : 'border-zinc-100 dark:border-zinc-800/60'} group-last:border-0 group-last:pb-0 ${compact ? 'pb-4 sm:pb-5' : 'pb-6 sm:pb-8'}`}>
        <div className={`flex items-start gap-2 ${compact ? 'mb-1.5 sm:mb-2' : 'mb-2 sm:mb-3'}`}>
          <span className={`${mobile ? 'mobile-ux-card-chip text-slate-500 dark:text-zinc-400' : 'border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'} font-bold uppercase ${compact ? 'px-1.5 py-0.5 text-[8px] sm:text-[9px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'}`}>
            {entry.stageLabel}
          </span>
            <span className={`min-w-0 break-words font-bold leading-snug ${mobile ? 'text-slate-700 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-300'} ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
              {renderResultSummary(entry, resultSummary, mobile)}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`relative flex-1 overflow-hidden ${mobile ? 'rounded-2xl bg-zinc-100/90 dark:bg-zinc-950/75' : 'border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800/50'} ${compact ? 'h-6 sm:h-7 max-w-[70%] sm:max-w-[60%]' : 'h-8 sm:h-10 max-w-[90%] sm:max-w-[85%]'}`}>
              <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${widthPercent}%`, background: getTimelineBarColor(sectionType, entry) }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent_100%)] bg-[length:12px_12px]" />
            </div>
            <div className={`absolute inset-y-0 left-2 sm:left-3 flex items-center font-black font-mono tracking-tight ${mobile ? 'text-slate-900 dark:text-zinc-100' : 'text-zinc-900 dark:text-zinc-100'} ${compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'}`}>
              {entry.pulls}
              <span className={`ml-0.5 font-bold ${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}>{t('dashboard.unit.pull')}</span>
            </div>
          </div>

          {stamp && (
            <div className={`shrink-0 flex items-center justify-center rotate-[14deg] rounded-full border-2 font-black shadow-sm ${compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs sm:text-sm'} ${stamp.className}`}>
              {stamp.label}
            </div>
          )}
        </div>

        {visibleBadges.length > 0 && (
          <div className={`mt-2.5 sm:mt-3 flex flex-wrap ${compact ? 'gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
            {visibleBadges.map((badge) => (
              <StageBadge key={`${entry.id}-${badge.label}`} badge={badge} compact={compact} mobile={mobile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSectionCard({ section, isOverview, embedded, t, mobile = false, showFiveStarDrops = true }) {
  const tone = getTimelineTone(section.type);
  const pityValue = section.hidePityState
    ? t('dashboard.timeline.multiAccount')
    : `${section.currentPity}`;

  return (
    <div className={`relative overflow-hidden ${mobile ? (embedded ? 'mobile-ux-card-inset' : 'mobile-ux-soft-card mobile-ux-soft-card--muted') : 'rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900'}`}>
      <div className={`absolute left-0 top-0 h-1 w-full ${tone.rail}`} />

      <div className={`border-b ${mobile ? 'border-zinc-200/90 dark:border-zinc-800' : 'border-zinc-100 dark:border-zinc-800'} ${mobile ? (embedded ? 'p-3.5' : 'p-4') : (embedded ? 'p-4' : 'p-5')}`}>
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`${embedded ? 'text-base' : 'text-lg'} font-bold tracking-tight ${mobile ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-900 dark:text-zinc-100'}`}>{section.title}</h3>
              <span className={`inline-flex border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${tone.chip}`}>
                {getSectionTypeLabel(section.type, t)}
              </span>
              {section.featured && (
                <span className={`inline-flex border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${tone.chip}`}>
                  {section.featured}
                </span>
              )}
              {isOverview && (
                <span className={`border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${mobile ? 'border-zinc-200 text-slate-500 dark:border-zinc-700 dark:text-zinc-400' : 'border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'}`}>
                  {t('dashboard.timeline.overview')}
                </span>
              )}
            </div>

            <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono ${mobile ? 'text-slate-500 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
              <span>{section.period}</span>
              <span className={mobile ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-300 dark:text-zinc-700'}>|</span>
              <span className={tone.accent}>{getStatusText(section.status, t)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricItem label={t('dashboard.timeline.metric.total')} value={t('dashboard.unit.pulls', { count: section.totalPulls })} mobile={mobile} />
            <MetricItem label={t('dashboard.timeline.metric.pity')} value={pityValue} mobile={mobile} />
            <MetricItem label={t('dashboard.timeline.metric.avgSix')} value={formatAverage(section.avgSixStarPulls, t)} mobile={mobile} />
            <MetricItem
              label={section.type === 'standard' ? t('dashboard.timeline.metric.avgFive') : t('dashboard.timeline.metric.avgUp')}
              value={section.type === 'standard' ? formatAverage(section.avgFiveStarPulls, t) : formatAverage(section.avgUpPulls, t)}
              mobile={mobile}
            />
          </div>
        </div>
      </div>

      <div className={mobile ? (embedded ? 'p-3.5' : 'p-4') : (embedded ? 'p-4' : 'p-5')}>
        {section.entries.length === 0 ? (
          <div className={`border border-dashed px-4 py-8 text-center text-sm ${mobile ? 'rounded-2xl border-zinc-200 bg-zinc-50/70 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-500' : 'border-zinc-200 text-slate-400 dark:border-zinc-800 dark:text-zinc-500'}`}>
            {t('dashboard.timeline.noStageNodes')}
          </div>
        ) : (
          <div className="space-y-0">
            {section.entries.map((entry) => (
              <TimelineStageCard
                key={entry.id}
                entry={entry}
                sectionType={section.type}
                featured={section.featured}
                t={t}
                mobile={mobile}
                showFiveStarDrops={showFiveStarDrops}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PoolTimelinePanel = ({
  currentPool,
  currentPoolHistory = [],
  groupedHistory = [],
  selectedPools = [],
  isGroupMode = false,
  isAllPoolsOverview = false,
  crossPoolPityMap = null,
  effectivePity = null,
  analysisPity = null,
  overviewAnalysisPityMap = null,
  overviewPoolFilter = 'all',
  hasMergedAccountView = false,
  embedded = false,
  mobile = false,
  showFiveStarDrops = true,
  onToggleShowFiveStarDrops = null
}) => {
  const { t, locale } = useI18n();
  const sections = useMemo(() => {
    return buildDashboardTimelineSections({
      currentPool,
      currentPoolHistory,
      groupedHistory,
      selectedPools,
      crossPoolPityMap,
      isGroupMode,
      isAllPoolsOverview,
      effectivePity,
      analysisPity,
      overviewAnalysisPityMap,
      overviewPoolFilter,
      hasMergedAccountView,
      locale
    });
  }, [analysisPity, crossPoolPityMap, currentPool, currentPoolHistory, effectivePity, groupedHistory, hasMergedAccountView, isAllPoolsOverview, isGroupMode, locale, overviewAnalysisPityMap, overviewPoolFilter, selectedPools]);

  const totalNodes = countDashboardTimelineNodes(sections);
  const title = isAllPoolsOverview
    ? t('dashboard.timeline.title.overview')
    : isGroupMode
      ? t('dashboard.timeline.title.group', { name: currentPool?.name || t('dashboard.timeline.overview') })
      : t('dashboard.timeline.title.single');
  const subtitle = isAllPoolsOverview
    ? t('dashboard.timeline.subtitle.overview')
    : isGroupMode
      ? t('dashboard.timeline.subtitle.group')
      : t('dashboard.timeline.subtitle.single');

  return (
    <div className={embedded ? 'space-y-3.5' : `space-y-4 ${mobile ? 'mobile-ux-card p-4' : 'border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'}`}>
      <div className={`flex flex-col gap-3 ${embedded ? 'pb-1' : `${mobile ? 'border-b border-zinc-200/90 pb-4 dark:border-zinc-800' : 'border-b border-zinc-100 pb-4 dark:border-zinc-800'}`} lg:flex-row lg:items-end lg:justify-between`}>
        {!embedded ? (
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${mobile ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-500 dark:text-zinc-500'}`}>{t('dashboard.timeline.header')}</div>
            <div className="mt-1 flex items-center gap-2">
              <Layers size={18} className={mobile ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-400 dark:text-zinc-500'} />
              <h2 className={`text-xl font-black tracking-tight ${mobile ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-800 dark:text-zinc-100'}`}>{title}</h2>
            </div>
            <p className={`mt-2 max-w-3xl text-sm ${mobile ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-500 dark:text-zinc-400'}`}>{subtitle}</p>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">{t('dashboard.timeline.mode')}</div>
            <p className={`mt-1 text-[11px] ${mobile ? 'text-slate-500 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-500'}`}>{subtitle}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`border px-3 py-1.5 text-xs font-mono ${mobile ? 'rounded-xl border-zinc-200 bg-zinc-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400' : 'border-zinc-200 text-slate-600 dark:border-zinc-800 dark:text-zinc-400'}`}>
            {t('dashboard.unit.stagePoolCount', { count: sections.length })}
          </div>
          <div className={`border px-3 py-1.5 text-xs font-mono ${mobile ? 'rounded-xl border-zinc-200 bg-zinc-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400' : 'border-zinc-200 text-slate-600 dark:border-zinc-800 dark:text-zinc-400'}`}>
            {t('dashboard.unit.timelineNodeCount', { count: totalNodes })}
          </div>
          {typeof onToggleShowFiveStarDrops === 'function' && (
            <button
              type="button"
              onClick={() => onToggleShowFiveStarDrops(!showFiveStarDrops)}
              className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors ${mobile ? 'rounded-xl border-zinc-200 bg-zinc-50 text-slate-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-900' : 'border-zinc-200 text-slate-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900'}`}
            >
              {showFiveStarDrops ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{showFiveStarDrops ? t('dashboard.timeline.toggle.hideFiveStar') : t('dashboard.timeline.toggle.showFiveStar')}</span>
            </button>
          )}
        </div>
      </div>

      {hasMergedAccountView && (
        <div className={`border border-dashed px-3 py-2 text-[11px] font-mono ${mobile ? 'rounded-2xl border-zinc-200 bg-zinc-50/85 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500' : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}`}>
          {t('dashboard.timeline.mergedViewNote')}
        </div>
      )}

      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className={`border border-dashed px-4 py-10 text-center text-sm ${mobile ? 'rounded-2xl border-zinc-200 bg-zinc-50/85 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500' : 'border-zinc-200 text-slate-400 dark:border-zinc-800 dark:text-zinc-500'}`}>
            {t('dashboard.timeline.noSelection')}
          </div>
        ) : (
          sections.map((section) => (
            <TimelineSectionCard
              key={section.id}
              section={section}
              isOverview={isGroupMode}
              embedded={embedded}
              t={t}
              mobile={mobile}
              showFiveStarDrops={showFiveStarDrops}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PoolTimelinePanel;
