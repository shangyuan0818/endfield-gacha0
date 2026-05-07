import React, { useRef, useEffect } from 'react';
import { RefreshCw, User } from 'lucide-react';
import { getCharacterAvatarUrl } from '../../utils/characterUtils';
import { useI18n } from '../../i18n/index.js';
import { localizeEntityName } from '../../utils/gameDataI18n.js';
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

const RotationScheduleCard = React.memo(function RotationScheduleCard({ poolSchedule, now }) {
  const { t, formatDateTime, locale } = useI18n();
  const scrollContainerRef = useRef(null);
  const focusItemRef = useRef(null);

  const tt = (key, fallback, params = {}) => t(key, params, fallback);

  let currentActiveIndex = -1;
  let nextUpcomingIndex = -1;
  for (let index = 0; index < poolSchedule.length; index += 1) {
    const pool = poolSchedule[index];
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

  const focusIndex = currentActiveIndex !== -1
    ? currentActiveIndex
    : nextUpcomingIndex !== -1
      ? nextUpcomingIndex
      : Math.max(poolSchedule.length - 1, 0);

  useEffect(() => {
    if (focusItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeItem = focusItemRef.current;
      const scrollLeft = activeItem.offsetLeft - container.offsetWidth / 2 + activeItem.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [focusIndex, poolSchedule.length]);

  if (!poolSchedule.length) {
    return null;
  }

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
          className="pool-card-rail-scrollbar flex flex-nowrap items-center gap-3 overflow-x-scroll overflow-y-hidden pb-4 pt-2 -mx-6 px-6"
        >
          {poolSchedule.map((pool, index) => {
            const poolStart = new Date(pool.startDate);
            const poolEnd = new Date(pool.endDate);
            const poolData = pool.poolData || pool;
            const isExtraPool = pool.poolType === 'extra' || poolData.type === 'extra';
            const isPast = now >= poolEnd;
            const isActivePool = now >= poolStart && now < poolEnd;
            const offset = currentActiveIndex === -1 ? null : index - currentActiveIndex;
            const isCurrent = isActivePool;
            const isInPool = !isExtraPool && offset !== null && offset >= -2 && offset <= 0;

            let statusLabel = null;
            if (isCurrent) {
              statusLabel = isExtraPool
                ? tt('home.rotation.status.currentPool', 'Current Pool')
                : tt('home.rotation.status.current', 'Current UP');
            } else if (offset === -1) {
              statusLabel = tt('home.rotation.status.inPoolSecond', 'Leaves in 2');
            } else if (offset === -2) {
              statusLabel = tt('home.rotation.status.inPoolNext', 'Leaves Next');
            } else if (offset === 1) {
              statusLabel = isExtraPool
                ? tt('home.rotation.status.nextPool', 'Next Pool')
                : tt('home.rotation.status.next', 'Next UP');
            } else if (offset === 2) {
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

            let containerClass = 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400';
            if (isCurrent) {
              containerClass = 'bg-endfield-yellow/10 border-endfield-yellow text-amber-600 dark:text-endfield-yellow ring-1 ring-endfield-yellow/50 shadow-[0_0_15px_rgba(255,250,0,0.1)]';
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
                    }`}>
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
                        }`}>
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
                {index < poolSchedule.length - 1 && <div className="w-6 h-px shrink-0 bg-zinc-200 dark:bg-zinc-800"></div>}
              </React.Fragment>
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
