import React, { useRef, useEffect } from 'react';
import { RefreshCw, User } from 'lucide-react';
import { getCharacterAvatarUrl } from '../../utils/characterUtils';
import { useI18n } from '../../i18n/index.js';
import { localizeEntityName } from '../../utils/gameDataI18n.js';
import { bindHorizontalWheelScroll } from '../../utils/horizontalScroll.js';
import { getPoolFeaturedLabel, getPoolSelectorFeaturedCharacters } from '../../utils/poolSelectorDisplay.js';

function getFeaturedTextFontClass(featuredText = '') {
  if (featuredText.length > 42) {
    return 'text-[9px] leading-[1.2]';
  }

  if (featuredText.length > 28) {
    return 'text-[10px] leading-[1.25]';
  }

  return 'text-[11px] leading-4';
}

const RotationScheduleCard = React.memo(function RotationScheduleCard({ poolSchedule, versionSections, now }) {
  const { t, formatDateTime, locale } = useI18n();
  const scrollContainerRef = useRef(null);
  const focusItemRef = useRef(null);

  const tt = (key, fallback, params = {}) => t(key, params, fallback);
  const hasVersionSections = Array.isArray(versionSections) && versionSections.length > 0;
  const scheduleSections = hasVersionSections
    ? versionSections
    : [{ id: 'all', name: tt('home.rotation.title', 'Rotation Schedule'), pools: poolSchedule }];
  const displayPools = scheduleSections.flatMap((section) => section.pools || []);

  const getPoolKey = (pool) => pool?.id || `${pool?.poolType || pool?.poolData?.type || 'pool'}:${pool?.name || ''}:${pool?.startDate || ''}`;
  const limitedTimeline = displayPools
    .map((pool, index) => ({ pool, index, key: getPoolKey(pool) }))
    .filter(({ pool }) => pool.poolType !== 'extra' && pool.poolData?.type !== 'extra');

  let currentActiveIndex = -1;
  let nextUpcomingIndex = -1;
  for (let index = 0; index < displayPools.length; index += 1) {
    const pool = displayPools[index];
    const start = new Date(pool.startDate);
    const end = new Date(pool.endDate);
    if (now >= start && now < end) {
      currentActiveIndex = index;
      break;
    }
    if (nextUpcomingIndex === -1 && now < start) {
      nextUpcomingIndex = index;
    }
  }
  const activeLimitedTimelineIndex = limitedTimeline.findIndex(({ pool }) => {
    const start = new Date(pool.startDate);
    const end = new Date(pool.endDate);
    return now >= start && now < end;
  });
  const hasActiveLimitedPool = activeLimitedTimelineIndex !== -1;
  let currentLimitedTimelineIndex = activeLimitedTimelineIndex;
  if (currentLimitedTimelineIndex === -1) {
    currentLimitedTimelineIndex = limitedTimeline.findIndex(({ pool }) => now < new Date(pool.startDate));
  }
  if (currentLimitedTimelineIndex === -1 && limitedTimeline.length > 0) {
    currentLimitedTimelineIndex = limitedTimeline.length - 1;
  }
  const limitedOffsetByKey = new Map(limitedTimeline.map(({ key }, index) => [
    key,
    currentLimitedTimelineIndex === -1 ? null : index - currentLimitedTimelineIndex,
  ]));

  const focusIndex = currentActiveIndex !== -1
    ? currentActiveIndex
    : nextUpcomingIndex !== -1
      ? nextUpcomingIndex
      : Math.max(displayPools.length - 1, 0);

  useEffect(() => {
    if (focusItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeItem = focusItemRef.current;
      const scrollLeft = activeItem.offsetLeft - container.offsetWidth / 2 + activeItem.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [focusIndex, displayPools.length]);

  useEffect(() => bindHorizontalWheelScroll(scrollContainerRef.current), []);

  if (!displayPools.length) {
    return null;
  }

  const renderPoolNode = (pool, {
    showConnector = true,
  } = {}) => {
    const index = displayPools.findIndex((item) => getPoolKey(item) === getPoolKey(pool));
    const poolStart = new Date(pool.startDate);
    const poolEnd = new Date(pool.endDate);
    const poolData = pool.poolData || pool;
    const isExtraPool = pool.poolType === 'extra' || poolData.type === 'extra';
    const isPast = now >= poolEnd;
    const isActivePool = now >= poolStart && now < poolEnd;
    const offset = isExtraPool ? null : limitedOffsetByKey.get(getPoolKey(pool));
    const displayOffset = !isExtraPool && offset !== null
      ? (hasActiveLimitedPool ? offset : offset + 1)
      : null;
    const isCurrent = isActivePool;
    const isInPool = !isExtraPool && hasActiveLimitedPool && offset !== null && offset >= -2 && offset < 0;

    let statusLabel = null;
    if (isExtraPool) {
      statusLabel = isCurrent
        ? tt('home.rotation.status.extraCurrent', 'Extra Pool Live')
        : tt('home.rotation.status.extraNode', 'Extra Pool');
    } else if (isCurrent) {
      statusLabel = tt('home.rotation.status.current', 'Current UP');
    } else if (hasActiveLimitedPool && offset === -1) {
      statusLabel = tt('home.rotation.status.inPoolSecond', 'Leaves in 2');
    } else if (hasActiveLimitedPool && offset === -2) {
      statusLabel = tt('home.rotation.status.inPoolNext', 'Leaves Next');
    } else if (displayOffset === 1) {
      statusLabel = tt('home.rotation.status.next', 'Next UP');
    } else if (displayOffset === 2) {
      statusLabel = tt('home.rotation.status.nextNext', 'UP After Next');
    }

    const avatarUrl = getCharacterAvatarUrl(pool.name);
    const localizedPoolName = isExtraPool
      ? pool.displayName || pool.name
      : localizeEntityName(pool.name, { locale, type: 'character' }) || pool.name;
    const featuredCharacterNames = isExtraPool
      ? getPoolSelectorFeaturedCharacters(poolData, { locale })
      : [];
    const featuredText = featuredCharacterNames.join(' / ');
    const featuredLabel = isExtraPool ? getPoolFeaturedLabel(poolData, { locale, short: true }) : '';
    const avatarLookupNames = isExtraPool
      ? (Array.isArray(pool.featuredNames) && pool.featuredNames.length > 0
        ? pool.featuredNames
        : featuredCharacterNames).slice(0, 4)
      : [];
    const extraAvatarUrls = avatarLookupNames
      .map((name) => getCharacterAvatarUrl(name))
      .filter(Boolean)
      .slice(0, 4);
    const foldedExtraText = Array.isArray(pool.foldedExtraPools) && pool.foldedExtraPools.length > 0
      ? pool.foldedExtraPools.map((extraPool) => extraPool.displayName || extraPool.name).filter(Boolean).join(' / ')
      : '';

    let containerClass = 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400';
    if (isCurrent) {
      containerClass = 'bg-endfield-yellow/10 border-endfield-yellow text-amber-600 dark:text-endfield-yellow ring-1 ring-endfield-yellow/50 shadow-[0_0_15px_rgba(255,250,0,0.1)]';
    } else if (isExtraPool && !isPast) {
      containerClass = 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-300';
    } else if (isInPool) {
      containerClass = 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400';
    } else if (isPast) {
      containerClass = 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-600 opacity-60';
    }

    return (
      <React.Fragment key={pool.id || pool.name}>
        <div
          ref={index === focusIndex ? focusItemRef : null}
          className={`shrink-0 px-4 py-3 rounded-lg text-xs font-mono transition-all border ${containerClass} ${isExtraPool ? 'min-w-[240px]' : 'min-w-[200px]'} flex flex-col justify-center relative`}
        >
          <div className="font-bold flex items-center gap-3">
            <div className={`${isExtraPool ? 'w-12 h-10 rounded-sm' : 'w-8 h-8 rounded-full'} flex items-center justify-center shrink-0 overflow-hidden ${
              isCurrent
                ? 'bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-endfield-yellow/50'
                : isInPool
                  ? 'bg-blue-200 dark:bg-blue-800/50'
                  : 'bg-zinc-200 dark:bg-zinc-700/50'
            }`}
            >
              {isExtraPool ? (
                extraAvatarUrls.length > 0 ? (
                  <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                    {extraAvatarUrls.map((url, avatarIndex) => (
                      <img
                        key={`${url}-${avatarIndex}`}
                        src={url}
                        alt={featuredCharacterNames[avatarIndex] || localizedPoolName}
                        className={`h-full w-full object-cover object-center ${isPast ? 'grayscale opacity-50' : ''}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full items-center justify-center text-white/80 flex">
                    <User size={14} />
                  </div>
                )
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={localizedPoolName}
                  className={`w-full h-full object-cover ${isPast && !isInPool ? 'grayscale opacity-50' : ''}`}
                  onError={(event) => {
                    event.target.style.display = 'none';
                    event.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              {!isExtraPool && (
                <div className={`w-full h-full items-center justify-center text-white/80 ${avatarUrl ? 'hidden' : 'flex'}`}>
                  <User size={14} />
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate max-w-[100px] ${isPast && !isInPool ? 'line-through opacity-50' : ''}`}>{localizedPoolName}</span>
                {isCurrent && !isExtraPool && <span className="text-[9px] font-bold bg-endfield-yellow/20 px-1 py-0.5 rounded text-amber-500 dark:text-endfield-yellow">UP</span>}
                {isInPool && !isCurrent && <span className="text-[9px] bg-blue-500/10 px-1 py-0.5 rounded opacity-80">{tt('home.rotation.inPoolBadge', 'IN POOL')}</span>}
              </div>
              {statusLabel && (
                <div className={`text-[10px] mt-0.5 font-bold tracking-wide truncate max-w-[120px] ${
                  isCurrent ? 'text-amber-600 dark:text-endfield-yellow' :
                  isInPool ? 'text-blue-500 dark:text-blue-400' :
                  'text-zinc-400 dark:text-zinc-500'
                }`}
                >
                  {statusLabel}
                </div>
              )}
              {isExtraPool && featuredText && (
                <div className="mt-0.5 border-l-2 border-cyan-500/40 pl-1.5 max-w-[150px]">
                  <span className="block text-[9px] leading-3 text-cyan-600 dark:text-cyan-300 opacity-80">{featuredLabel}</span>
                  <span className={`block line-clamp-2 text-zinc-700 dark:text-zinc-200 ${getFeaturedTextFontClass(featuredText)}`}>
                    {featuredText}
                  </span>
                </div>
              )}
              {foldedExtraText && (
                <div className="mt-1 max-w-[150px] truncate text-[10px] font-medium text-cyan-600 dark:text-cyan-300">
                  已合并：{foldedExtraText}
                </div>
              )}
            </div>
          </div>

          <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800/50 my-2"></div>

          <div className="text-[10px] opacity-70 flex justify-between items-center gap-2">
            <span className="truncate">
              {formatDateTime(poolStart, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
              <span className="mx-1 opacity-50">-</span>
              {formatDateTime(poolEnd, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
        </div>
        {showConnector && <div className="w-6 h-px shrink-0 bg-zinc-200 dark:bg-zinc-800"></div>}
      </React.Fragment>
    );
  };

  const renderVersionDivider = (section, sectionIndex) => {
    const sectionName = section.name || tt('home.rotation.versionFallback', 'Version');
    const poolCount = Array.isArray(section.pools) ? section.pools.length : 0;

    return (
      <div
        className="relative flex min-h-[132px] w-[158px] shrink-0 overflow-hidden border-2 border-zinc-950 bg-endfield-yellow text-zinc-950 shadow-[10px_0_0_rgba(24,24,27,0.16)] dark:border-zinc-100 dark:shadow-[10px_0_0_rgba(255,255,255,0.08)]"
        aria-label={`${sectionName} ${tt('home.rotation.versionDivider', 'Version Section')}`}
      >
        <div className="absolute inset-y-0 left-0 w-4 bg-zinc-950"></div>
        <div className="absolute inset-y-0 right-0 w-2 bg-zinc-950"></div>
        <div className="absolute right-2 top-2 h-9 w-9 border-2 border-zinc-950"></div>
        <div className="absolute bottom-0 left-0 h-8 w-full bg-zinc-950"></div>
        <div className="absolute -right-10 top-0 h-full w-20 bg-[repeating-linear-gradient(135deg,rgba(24,24,27,0.22)_0,rgba(24,24,27,0.22)_2px,transparent_2px,transparent_8px)]"></div>
        <div className="relative flex h-full w-full flex-col justify-between px-4 py-3 pl-7">
          <div className="min-w-0">
            <div className="inline-flex bg-zinc-950 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-endfield-yellow">
              VERSION {String(sectionIndex + 1).padStart(2, '0')}
            </div>
            <div className="mt-3 max-w-[112px] break-words text-xl font-black leading-tight tracking-normal text-zinc-950">
              {sectionName}
            </div>
          </div>
          <div className="relative z-10 flex min-h-8 items-end justify-between gap-2 text-[10px] font-black text-endfield-yellow">
            <div className="pb-1">
              {poolCount} 个卡池
            </div>
            {section.hiddenExtraCount > 0 ? (
              <div className="mb-1 inline-flex border border-cyan-300 px-1.5 py-0.5 text-cyan-200">
                折叠 {section.hiddenExtraCount}
              </div>
            ) : null}
          </div>
        </div>
        <div className="absolute right-[-22px] top-1/2 hidden h-2 w-[22px] -translate-y-1/2 bg-zinc-950 dark:bg-zinc-100 sm:block"></div>
      </div>
    );
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
      <div className="relative z-10 px-6 py-4">
        <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-4 flex items-center gap-2 uppercase tracking-widest">
          <RefreshCw size={12} />
          {tt('home.rotation.title', 'Rotation Schedule')}
        </h4>
        <div 
          ref={scrollContainerRef}
          className="pool-card-rail-scrollbar flex flex-nowrap items-stretch gap-6 overflow-x-scroll overflow-y-hidden pb-4 pt-2 -mx-6 px-6"
        >
          {scheduleSections.map((section, sectionIndex) => {
            const pools = section.pools || [];
            if (pools.length === 0) {
              return null;
            }

            return (
              <div
                key={`version-section-${section.id || sectionIndex}`}
                className="flex shrink-0 items-stretch gap-3"
              >
                {hasVersionSections ? renderVersionDivider(section, sectionIndex) : null}
                {pools.map((pool, poolIndex) => renderPoolNode(pool, {
                  showConnector: poolIndex < pools.length - 1,
                }))}
              </div>
            );
          })}
          <div className="w-6 h-px shrink-0 bg-zinc-200 dark:bg-zinc-800"></div>
          <div className="shrink-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-600 rounded-lg text-xs font-mono min-w-[150px] flex items-center justify-center border-dashed">
            {tt('home.rotation.pending', 'TBA...')}
          </div>
          
          {/* Spacer to allow active item to center even if it's the last item */}
          <div className="shrink-0 w-[30vw]"></div>
        </div>
      </div>
    </div>
  );
});

export default RotationScheduleCard;
