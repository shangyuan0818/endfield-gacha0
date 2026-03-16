import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import {
  buildOverviewTimelineSections,
  buildSinglePoolTimelineSection
} from '../../utils/poolTimelineView.js';

function formatAverage(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(1)} 抽`;
}

function getTimelineTone(type) {
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

function getStatusText(status) {
  if (!status?.isTimed) {
    return '长期开放';
  }

  if (status.isActive) {
    return status.remainingLabel || '进行中';
  }

  if (status.isUpcoming) {
    return status.remainingLabel || '即将开启';
  }

  return '已结束';
}

function getLeadBadge(entry, featured) {
  return entry.leadBadge || entry.dropBadges[0] || {
    label: featured || '?',
    rarity: 0
  };
}

function getEntryBarClass(sectionType, entry) {
  if (entry.stageKind === 'gift') {
    return 'bg-emerald-400 dark:bg-emerald-500';
  }

  if (entry.stageKind === 'fiveStar') {
    return 'bg-amber-300 dark:bg-amber-400';
  }

  if (entry.stageKind === 'offStandard') {
    return 'bg-rose-400 dark:bg-rose-500';
  }

  if (entry.stageKind === 'offLimited') {
    return 'bg-slate-400 dark:bg-slate-500';
  }

  if (sectionType === 'weapon') {
    return 'bg-amber-400 dark:bg-amber-500';
  }

  if (sectionType === 'standard') {
    return 'bg-blue-400 dark:bg-blue-500';
  }

  return 'rainbow-progress';
}

function getStampConfig(entry, sectionType) {
  if (entry.stageKind === 'gift') {
    return {
      label: '免',
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
    if (sectionType === 'limited' || sectionType === 'weapon') {
      return {
        label: '歪',
        className: 'border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-500/70 dark:bg-rose-500/10 dark:text-rose-400'
      };
    }

    if (sectionType === 'standard') {
      return null;
    }

    return {
      label: '歪',
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
      label: '进',
      className: 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300'
    };
  }

  return null;
}

function StagePortrait({ entry, featured, compact = false }) {
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
        {leadBadge.rarity > 0 ? `${leadBadge.rarity}★` : '阶段'}
      </div>
    </div>
  );
}

function StageBadge({ badge, compact = false }) {
  const isSixStar = badge.rarity >= 6;
  return (
    <div className={`flex items-center gap-1.5 border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${compact ? 'pr-1.5' : 'pr-2'}`}>
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

function MetricItem({ label, value }) {
  return (
    <div className="min-w-0 border-l border-zinc-200 pl-3 dark:border-zinc-800">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-black font-mono text-slate-800 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function TimelineStageCard({ entry, sectionType, featured }) {
  const compact = entry.stageKind === 'fiveStar';
  const stamp = getStampConfig(entry, sectionType);
  const stageDropCount = entry.dropBadges.reduce((sum, badge) => sum + badge.count, 0);
  const widthPercent = Math.max(
    compact ? 10 : 12,
    Math.min(100, (entry.pulls / Math.max(entry.targetPulls || 1, 1)) * 100)
  );

  return (
    <div className="relative flex gap-3 sm:gap-5 group">
      <div className={`flex flex-col items-center shrink-0 relative z-10 ${compact ? 'w-10 sm:w-12' : 'w-12 sm:w-16'}`}>
        <StagePortrait entry={entry} featured={featured} compact={compact} />
        <span className={`mt-2 font-black font-mono text-zinc-500 dark:text-zinc-400 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-[11px]'}`}>
          {entry.dateLabel}
        </span>
      </div>

      <div className={`flex-1 min-w-0 border-b border-zinc-100 dark:border-zinc-800/60 group-last:border-0 group-last:pb-0 ${compact ? 'pb-4 sm:pb-5' : 'pb-6 sm:pb-8'}`}>
        <div className={`flex items-center gap-2 ${compact ? 'mb-1.5 sm:mb-2' : 'mb-2 sm:mb-3'}`}>
          <span className={`border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 font-bold uppercase ${compact ? 'px-1.5 py-0.5 text-[8px] sm:text-[9px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'}`}>
            {entry.stageLabel}
          </span>
          <span className={`truncate font-bold text-zinc-700 dark:text-zinc-300 ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
            {entry.resultSummary}
          </span>
        </div>

        <div className={`font-mono uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${compact ? 'mb-2 text-[9px] sm:text-[10px]' : 'mb-2 sm:mb-3 text-[10px] sm:text-[11px]'}`}>
          阶段上限 {entry.targetPulls} 抽 · 出货 {stageDropCount} 件
          {entry.metaSummary ? ` · ${entry.metaSummary}` : ''}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`relative flex-1 overflow-hidden border border-zinc-200 bg-zinc-100 dark:border-zinc-700/50 dark:bg-zinc-800/50 shadow-sm ${compact ? 'h-6 sm:h-7 max-w-[70%] sm:max-w-[60%]' : 'h-8 sm:h-10 max-w-[90%] sm:max-w-[85%]'}`}>
            <div
              className={`absolute inset-y-0 left-0 ${getEntryBarClass(sectionType, entry)}`}
              style={{ width: `${widthPercent}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent_100%)] bg-[length:12px_12px]" />
            </div>
            <div className={`absolute inset-y-0 left-2 sm:left-3 flex items-center font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100 ${compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'}`}>
              {entry.pulls}
              <span className={`ml-0.5 font-bold ${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}>抽</span>
            </div>
          </div>

          {stamp && (
            <div className={`shrink-0 flex items-center justify-center rotate-[14deg] rounded-full border-2 font-black shadow-sm ${compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs sm:text-sm'} ${stamp.className}`}>
              {stamp.label}
            </div>
          )}
        </div>

        {entry.dropBadges.length > 0 && (
          <div className={`mt-2.5 sm:mt-3 flex flex-wrap ${compact ? 'gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
            {entry.dropBadges.map((badge) => (
              <StageBadge key={`${entry.id}-${badge.label}`} badge={badge} compact={compact} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSectionCard({ section, isOverview, embedded }) {
  const tone = getTimelineTone(section.type);
  const pityValue = section.hidePityState
    ? '多账号'
    : `${section.currentPity} / ${section.currentPity5}`;

  return (
    <div className="relative overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`absolute left-0 top-0 h-1 w-full ${tone.rail}`} />

      <div className={`border-b border-zinc-100 dark:border-zinc-800 ${embedded ? 'p-4' : 'p-5'}`}>
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`${embedded ? 'text-base' : 'text-lg'} font-bold tracking-tight text-slate-900 dark:text-zinc-100`}>{section.title}</h3>
              {section.featured && (
                <span className={`inline-flex border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${tone.chip}`}>
                  {section.featured}
                </span>
              )}
              {isOverview && (
                <span className="border border-zinc-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  总览
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              <span>{section.period}</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className={tone.accent}>{getStatusText(section.status)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricItem label="合计" value={`${section.totalPulls} 抽`} />
            <MetricItem label="垫刀" value={pityValue} />
            <MetricItem label="平均 6★" value={formatAverage(section.avgSixStarPulls)} />
            <MetricItem
              label={section.type === 'standard' ? '平均 5★' : '平均 UP'}
              value={section.type === 'standard' ? formatAverage(section.avgFiveStarPulls) : formatAverage(section.avgUpPulls)}
            />
          </div>
        </div>
      </div>

      <div className={embedded ? 'p-4' : 'p-5'}>
        {section.entries.length === 0 ? (
          <div className="border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
            暂无可展示的时间线节点
          </div>
        ) : (
          <div className="space-y-0">
            {section.entries.map((entry) => (
              <TimelineStageCard
                key={entry.id}
                entry={entry}
                sectionType={section.type}
                featured={section.featured}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function matchesOverviewPoolFilter(section, overviewPoolFilter) {
  if (overviewPoolFilter === 'all') {
    return true;
  }

  return section.type === overviewPoolFilter;
}

function getOverviewPoolFilterType(pool) {
  if (pool?.type === 'weapon' || pool?.type === 'limited_weapon') {
    return 'weapon';
  }

  if (pool?.type === 'limited' || pool?.type === 'limited_character') {
    return 'limited';
  }

  return 'standard';
}

const PoolTimelinePanel = ({
  currentPool,
  currentPoolHistory = [],
  groupedHistory = [],
  selectedPools = [],
  isGroupMode = false,
  isAllPoolsOverview = false,
  effectivePity = null,
  analysisPity = null,
  overviewAnalysisPityMap = null,
  overviewPoolFilter = 'all',
  hasMergedAccountView = false,
  embedded = false
}) => {
  const sections = useMemo(() => {
    if (isGroupMode) {
      return buildOverviewTimelineSections({
        pools: isAllPoolsOverview
          ? selectedPools.filter((pool) => matchesOverviewPoolFilter({ type: getOverviewPoolFilterType(pool) }, overviewPoolFilter))
          : selectedPools,
        history: currentPoolHistory,
        analysisPityByPoolId: overviewAnalysisPityMap,
        disablePityState: hasMergedAccountView
      });
    }

    const section = buildSinglePoolTimelineSection({
      pool: currentPool,
      history: currentPoolHistory,
      groupedHistory,
      currentPityOverride: hasMergedAccountView ? null : (analysisPity?.displayPity6 ?? effectivePity?.pity6),
      currentPity5Override: hasMergedAccountView ? null : (analysisPity?.displayPity5 ?? effectivePity?.pity5),
      currentTargetPullsOverride: analysisPity?.maxPity6,
      disablePityState: hasMergedAccountView
    });

    return section ? [section] : [];
  }, [analysisPity?.displayPity5, analysisPity?.displayPity6, analysisPity?.maxPity6, currentPool, currentPoolHistory, effectivePity?.pity5, effectivePity?.pity6, groupedHistory, hasMergedAccountView, isAllPoolsOverview, isGroupMode, overviewAnalysisPityMap, overviewPoolFilter, selectedPools]);

  const totalNodes = sections.reduce((sum, section) => sum + section.entries.length, 0);
  const title = isAllPoolsOverview
    ? '全部卡池总览'
    : isGroupMode
      ? `${currentPool?.name || '池组'}时间线`
      : '卡池时间线视图';
  const subtitle = isAllPoolsOverview
    ? '跨类型串联回顾不同卡池的推进、偏移和赠送节点。'
    : isGroupMode
      ? '按同类池顺序串联回顾每一期的重要节点。'
      : '将当前卡池的重要节点按阶段整理，便于和保底分析联动阅读。';

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'}>
      <div className={`flex flex-col gap-3 ${embedded ? 'pb-1' : 'border-b border-zinc-100 pb-4 dark:border-zinc-800'} lg:flex-row lg:items-end lg:justify-between`}>
        {!embedded ? (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">Timeline View</div>
            <div className="mt-1 flex items-center gap-2">
              <Layers size={18} className="text-slate-400 dark:text-zinc-500" />
              <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-zinc-100">{title}</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-zinc-400">{subtitle}</p>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">时间线模式</div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">{subtitle}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="border border-zinc-200 px-3 py-1.5 text-xs font-mono text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
            <span className="font-bold text-slate-800 dark:text-zinc-200">{sections.length}</span> 个阶段卡池
          </div>
          <div className="border border-zinc-200 px-3 py-1.5 text-xs font-mono text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
            <span className="font-bold text-slate-800 dark:text-zinc-200">{totalNodes}</span> 个时间节点
          </div>
        </div>
      </div>

      {hasMergedAccountView && (
        <div className="border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-mono text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          当前为多账号汇总视图。时间线保留阶段回顾，但已隐藏“当前推进 / 当前垫刀”这类账号独立状态。
        </div>
      )}

      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
            当前选择下暂无可展示的时间线数据
          </div>
        ) : (
          sections.map((section) => (
            <TimelineSectionCard
              key={section.id}
              section={section}
              isOverview={isGroupMode}
              embedded={embedded}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PoolTimelinePanel;
