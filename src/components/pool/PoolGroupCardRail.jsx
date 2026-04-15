import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Layers, Lock, Star, Swords, User } from 'lucide-react';
import { getPoolTimingMeta, getSelectorVisiblePools } from '../../utils/poolSelectorDisplay';
import { useI18n } from '../../i18n/index.js';
import { characterCache } from '../../utils/characterUtils.js';

const TYPE_CONFIG = {
  limited: { icon: Star, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20' },
  standard: { icon: Layers, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
  beginner: { icon: User, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
  weapon_limited: { icon: Swords, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-zinc-800' },
  weapon_standard: { icon: Swords, color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' }
};

function GroupLabel({ groupType, label, collapsed, onToggle, t }) {
  const accentClass = groupType === 'limited'
    ? 'bg-orange-500 text-orange-600 dark:text-orange-400'
    : groupType === 'weapon_limited'
      ? 'bg-slate-500 text-slate-600 dark:text-slate-300'
      : groupType === 'standard'
        ? 'bg-yellow-500 text-yellow-600 dark:text-yellow-400'
        : groupType === 'weapon_standard'
          ? 'bg-zinc-400 text-zinc-500 dark:text-zinc-400'
          : 'bg-green-500 text-green-600 dark:text-green-400';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex-shrink-0 flex flex-col items-center justify-end h-full pb-3 group"
      title={collapsed ? t('pool.card.groupToggleExpand', { label }) : t('pool.card.groupToggleCollapse', { label })}
    >
      <div className="flex flex-col items-center gap-1.5" style={{ writingMode: 'vertical-rl' }}>
        <span className={`w-1 h-6 flex-shrink-0 ${accentClass.split(' ')[0]}`} style={{ writingMode: 'horizontal-tb' }} />
        <span className={`text-xs font-bold tracking-widest uppercase ${accentClass.split(' ').slice(1).join(' ')}`}>
          {label}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform ${accentClass.split(' ').slice(1).join(' ')} ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          style={{ writingMode: 'horizontal-tb' }}
        />
      </div>
    </button>
  );
}

function GroupCard({ group, isSelected, onClick, interactive, locale, t }) {
  const config = TYPE_CONFIG[group.type] || TYPE_CONFIG.standard;
  const TypeIcon = config.icon;
  const formattedPoolCount = new Intl.NumberFormat(locale).format(group.pools.length);
  const formattedPullCount = new Intl.NumberFormat(locale).format(group.totalPulls || 0);

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`
        relative flex-shrink-0 w-44 p-3 border-2 border-dashed transition-all
        ${interactive ? 'cursor-pointer group hover:border-zinc-400 dark:hover:border-zinc-500' : 'cursor-default'}
        ${isSelected
          ? 'bg-zinc-50 dark:bg-zinc-900/50 border-yellow-500 dark:border-yellow-600 shadow-sm'
          : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
        }
      `}
    >
      <div className={`absolute top-2 left-2 p-1 ${config.bg}`}>
        <TypeIcon size={12} className={config.color} />
      </div>
      <div className={`text-sm font-bold truncate mb-1 mt-6 ${isSelected ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400'}`}>
        {t('pool.card.allGroupTitle', { label: group.label })}
      </div>
      <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
        {t('pool.card.groupStats', { pools: formattedPoolCount, pulls: formattedPullCount })}
      </div>
    </div>
  );
}

function CollapseCard({ count, expanded, onClick, locale, t }) {
  const formattedCount = new Intl.NumberFormat(locale).format(count);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-shrink-0 w-36 p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-endfield-yellow hover:text-endfield-yellow transition-colors text-left"
    >
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        {expanded ? t('pool.card.collapseOld') : t('pool.card.expandOld')}
      </div>
      <div className="mt-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
        {expanded ? t('pool.card.keepLatest') : t('pool.card.hasMore', { count: formattedCount })}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? t('pool.card.clickCollapse') : t('pool.card.clickExpand')}
      </div>
    </button>
  );
}

function OverviewCard({ title, totalPools, totalPulls, isSelected, onClick, locale, t }) {
  const formattedPoolCount = new Intl.NumberFormat(locale).format(totalPools);
  const formattedPullCount = new Intl.NumberFormat(locale).format(totalPulls);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-shrink-0 w-48 p-3 border transition-all text-left
        hover:border-zinc-400 dark:hover:border-zinc-500
        ${isSelected
          ? 'bg-zinc-50 dark:bg-zinc-900/50 border-yellow-500 dark:border-yellow-600 shadow-sm'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }
      `}
    >
      <div className="absolute top-2 left-2 p-1 bg-zinc-100 dark:bg-zinc-800">
        <Layers size={12} className="text-slate-600 dark:text-zinc-300" />
      </div>
      <div className={`mt-6 text-sm font-bold ${isSelected ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400'}`}>
        {title}
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400 font-mono">
        {t('pool.card.groupStats', { pools: formattedPoolCount, pulls: formattedPullCount })}
      </div>
      <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-500">
        {t('pool.card.overviewDesc')}
      </div>
    </button>
  );
}

function PoolCard({ pool, isSelected, onClick, locale, t }) {
  const groupType = pool.selectorGroupType || 'standard';
  const config = TYPE_CONFIG[groupType] || TYPE_CONFIG.standard;
  const TypeIcon = config.icon;
  const isActive = pool.selectorTiming?.isActive;
  const remainingLabel = pool.selectorTiming?.remainingLabel;
  const formattedPullCount = new Intl.NumberFormat(locale).format(pool.pullCount || 0);
  const upCharacterName = pool.displayUpCharacter || pool.up_character || pool.upCharacter || '';
  const avatarLookupName = pool.up_character || pool.upCharacter || '';
  const upCharacterAvatarUrl = useMemo(() => {
    if (!avatarLookupName) {
      return null;
    }

    return characterCache.searchByName(avatarLookupName, false)?.avatar_url || null;
  }, [avatarLookupName]);

  return (
    <div
      onClick={onClick}
      className={`
        relative flex-shrink-0 w-44 p-3 cursor-pointer transition-all border overflow-hidden
        group hover:border-zinc-400 dark:hover:border-zinc-500
        ${isSelected
          ? 'bg-zinc-50 dark:bg-zinc-900/50 border-yellow-500 dark:border-yellow-600 shadow-sm'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }
        ${isActive ? 'shadow-[0_0_0_1px_rgba(234,179,8,0.35),0_0_18px_rgba(234,179,8,0.12)]' : ''}
      `}
    >
      {upCharacterAvatarUrl && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-0 w-[60%] opacity-48 dark:opacity-36">
            <img
              src={upCharacterAvatarUrl}
              alt={upCharacterName}
              className="h-full w-full object-cover object-[72%_center]"
            />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-0 w-[68%] bg-gradient-to-r from-white/92 via-white/68 to-transparent dark:from-zinc-900/92 dark:via-zinc-900/68 dark:to-transparent" />
        </>
      )}

      <div className={`absolute top-2 left-2 z-10 p-1 ${config.bg}`}>
        <TypeIcon size={12} className={config.color} />
      </div>

      {pool.locked && (
        <div className="absolute top-2 right-2 z-10">
          <Lock size={12} className="text-amber-500" />
        </div>
      )}

      {isActive && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 border border-amber-600/60 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:border-yellow-500/60 dark:bg-yellow-500/10 dark:text-endfield-yellow">
          <span className="w-1.5 h-1.5 rounded-full bg-endfield-yellow animate-pulse" />
          {t('pool.card.currentUp')}
        </div>
      )}

      <div className={`relative z-10 text-sm font-bold truncate mb-1 mt-6 ${isSelected ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400'}`}>
        {pool.displayName || pool.name}
      </div>

      {upCharacterName && (
        <div className="relative z-10 text-xs text-slate-500 dark:text-zinc-400 truncate mb-1 font-mono">
          <span className="text-slate-600 dark:text-zinc-300">{t('pool.card.upShort')}:</span> {upCharacterName}
          {isActive && remainingLabel ? <span className="font-semibold text-amber-700 dark:text-endfield-yellow"> · {remainingLabel}</span> : null}
        </div>
      )}

      {!upCharacterName && isActive && remainingLabel && (
        <div className="relative z-10 text-xs font-semibold text-amber-700 dark:text-endfield-yellow truncate mb-1 font-mono">{remainingLabel}</div>
      )}

      <div className="relative z-10 text-xs text-slate-500 dark:text-zinc-400 font-mono">
        {t('pool.card.pulls', { count: formattedPullCount })}
      </div>

      {pool.selectorTiming?.isTimed && (
        <div className="relative z-10 mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/90">
          <div
            className={`h-full transition-all ${
              isActive
                ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500'
                : pool.selectorTiming?.isUpcoming
                  ? 'bg-blue-400'
                  : 'bg-zinc-400 dark:bg-zinc-600'
            }`}
            style={{ width: `${Math.max(Number(pool.selectorTiming?.progressPercent || 0), 4)}%` }}
          />
        </div>
      )}
    </div>
  );
}

const PoolGroupCardRail = ({
  groups = [],
  currentSelectionId = null,
  onSelectGroup,
  onSelectPool,
  leadingOverview = null,
  showGroupOverviewCards = true,
  collapseLimit = 5,
  collapsibleTypes = ['limited'],
  className = ''
}) => {
  const { t, locale } = useI18n();
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [collapsedGroupTypes, setCollapsedGroupTypes] = useState(() => new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  void tick;
  const effectiveGroups = groups.map((group) => ({
    ...group,
    pools: group.pools.map((pool) => ({
      ...pool,
      selectorTiming: getPoolTimingMeta(pool, new Date(), locale)
    }))
  }));

  if (effectiveGroups.length === 0) {
    return null;
  }

  return (
    <div className={`relative border-t border-zinc-100 dark:border-zinc-800 pt-4 ${className}`}>
      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {leadingOverview && showGroupOverviewCards ? (
          <OverviewCard
            title={leadingOverview.title}
            totalPools={leadingOverview.totalPools}
            totalPulls={leadingOverview.totalPulls}
            isSelected={leadingOverview.isSelected}
            onClick={leadingOverview.onClick}
            locale={locale}
            t={t}
          />
        ) : null}

        {effectiveGroups.map((group) => {
          const allowCollapse = collapsibleTypes.includes(group.type) && !group.disableCollapse;
          const expanded = expandedGroups.has(group.type);
          const hasSelectedPool = group.pools.some((pool) => pool.id === currentSelectionId);
          const isGroupCollapsed = collapsedGroupTypes.has(group.type);
          const collapsedPreviewPools = isGroupCollapsed
            ? group.pools.filter((pool) => pool.selectorTiming?.isActive)
            : [];
          if (isGroupCollapsed && hasSelectedPool && currentSelectionId !== group.groupId) {
            const selectedPool = group.pools.find((pool) => pool.id === currentSelectionId);
            if (selectedPool && !collapsedPreviewPools.some((pool) => pool.id === selectedPool.id)) {
              collapsedPreviewPools.push(selectedPool);
            }
          }
          const {
            visiblePools,
            hiddenPools,
            autoExpanded
          } = allowCollapse
            ? getSelectorVisiblePools({
                pools: group.pools,
                currentPoolId: currentSelectionId,
                expanded,
                limit: collapseLimit
              })
            : {
                visiblePools: group.pools,
                hiddenPools: [],
                autoExpanded: false
              };
          const showExpanded = expanded || autoExpanded;

          return (
            <div key={group.type} className="flex flex-nowrap items-end gap-2">
              <GroupLabel
                groupType={group.type}
                label={group.label}
                collapsed={isGroupCollapsed}
                t={t}
                onToggle={() => {
                  setCollapsedGroupTypes((current) => {
                    const next = new Set(current);
                    if (next.has(group.type)) {
                      next.delete(group.type);
                    } else {
                      next.add(group.type);
                    }
                    return next;
                  });
                }}
              />

              {showGroupOverviewCards ? (
                <GroupCard
                  group={group}
                  isSelected={currentSelectionId === group.groupId}
                  interactive={typeof onSelectGroup === 'function'}
                  onClick={() => onSelectGroup?.(group.type)}
                  locale={locale}
                  t={t}
                />
              ) : null}

              {isGroupCollapsed && collapsedPreviewPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={{ ...pool, selectorGroupType: group.type }}
                  isSelected={currentSelectionId === pool.id}
                  onClick={() => onSelectPool?.(pool.id)}
                  locale={locale}
                  t={t}
                />
              ))}

              {!isGroupCollapsed && visiblePools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={{ ...pool, selectorGroupType: group.type }}
                  isSelected={currentSelectionId === pool.id}
                  onClick={() => onSelectPool?.(pool.id)}
                  locale={locale}
                  t={t}
                />
              ))}

              {!isGroupCollapsed && allowCollapse && hiddenPools.length > 0 && !showExpanded && (
                <CollapseCard
                  count={hiddenPools.length}
                  expanded={false}
                  locale={locale}
                  t={t}
                  onClick={() => {
                    setExpandedGroups((current) => {
                      const next = new Set(current);
                      next.add(group.type);
                      return next;
                    });
                  }}
                />
              )}

              {!isGroupCollapsed && allowCollapse && showExpanded && hiddenPools.length > 0 && hiddenPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={{ ...pool, selectorGroupType: group.type }}
                  isSelected={currentSelectionId === pool.id}
                  onClick={() => onSelectPool?.(pool.id)}
                  locale={locale}
                  t={t}
                />
              ))}

              {!isGroupCollapsed && allowCollapse && showExpanded && hiddenPools.length > 0 && (
                <CollapseCard
                  count={hiddenPools.length}
                  expanded={true}
                  locale={locale}
                  t={t}
                  onClick={() => {
                    setExpandedGroups((current) => {
                      const next = new Set(current);
                      next.delete(group.type);
                      return next;
                    });
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PoolGroupCardRail;
