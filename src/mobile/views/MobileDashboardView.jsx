import React, { useState, useMemo } from 'react';
import {
  Star, TrendingUp, Calculator, Clock, Sparkles, FileText,
  ChevronDown, ChevronUp, Layers, Swords, User, PieChart as PieChartIcon,
  BarChart3, LayoutGrid
} from 'lucide-react';
import { usePoolStore, useHistoryStore, useAuthStore } from '../../stores';
import { LIMITED_POOL_RULES, RARITY_CONFIG } from '../../constants';
import { getCurrentUpPoolInfo } from '../../utils/poolTimeUtils';
import { calculateCurrentProbability, calculateInheritedPity } from '../../utils';
import { characterCache } from '../../utils/characterUtils';
import MobileChartContainer from '../components/MobileChartContainer';
import MobilePoolSelector from '../components/MobilePoolSelector';
import MobileCharacterWaterfallChart from '../components/MobileCharacterWaterfallChart';

/**
 * 移动端卡池分析视图 - 工业风重构版 (中文)
 */
function MobileDashboardView() {
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const history = useHistoryStore(state => state.history);

  // 角色出货视图模式: 'card' | 'waterfall'
  const [charViewMode, setCharViewMode] = useState('card');

  const poolsArray = Array.isArray(pools) ? pools : [];
  const historyArray = Array.isArray(history) ? history : [];

  const currentPool = useMemo(() => {
    if (!poolsArray.length) return null;
    return poolsArray.find(p => p.id === currentPoolId) || poolsArray[0];
  }, [poolsArray, currentPoolId]);

  const currentPoolHistory = useMemo(() => {
    if (!currentPool) return [];

    let poolHistory = historyArray.filter(h => {
      const hPoolId = h.poolId || h.pool_id;
      return hPoolId === currentPool.id && h.user_id === user?.id;
    });

    if (currentGameUid) {
      poolHistory = poolHistory.filter(h =>
        h.game_uid === currentGameUid || h.gameUid === currentGameUid
      );
    }

    return poolHistory.sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  }, [historyArray, currentPool, currentGameUid, user]);

  const normalizedPoolHistory = useMemo(() => {
    const poolType = currentPool?.type;
    const upCharacter = currentPool?.up_character;

    return currentPoolHistory.map(h => {
      const characterName = h.character_name || h.item_name || h.name || '';
      let isStd;

      if (poolType === 'standard' || poolType === 'beginner') {
        isStd = true;
      } else if (poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') {
        if (upCharacter && h.rarity === 6) {
          isStd = !characterName.includes(upCharacter) && !upCharacter.includes(characterName);
        } else if (h.rarity === 6) {
          isStd = false;
        } else {
          isStd = h.isStandard ?? false;
        }
      } else {
        isStd = h.isStandard ?? false;
      }

      return { ...h, isStandard: isStd };
    });
  }, [currentPoolHistory, currentPool]);

  // 限定池跨池 pity 映射：recordId → { sixStarPity, fiveStarPity }
  const crossPoolPityMap = useMemo(() => {
    const isLimitedPool = currentPool?.type === 'limited' || currentPool?.type === 'limited_character';
    if (!isLimitedPool) return null;

    const allLimitedPoolIds = poolsArray
      .filter(p => p.type === 'limited' || p.type === 'limited_character')
      .map(p => p.id);

    let allLimitedPulls = historyArray.filter(h =>
      allLimitedPoolIds.includes(h.poolId || h.pool_id) &&
      h.user_id === user?.id &&
      h.specialType !== 'gift'
    );
    if (currentGameUid) {
      allLimitedPulls = allLimitedPulls.filter(h =>
        h.game_uid === currentGameUid || h.gameUid === currentGameUid
      );
    }
    // 注意：不能用 record_id(id) 排序，因为不同池的 record_id 前缀不同，跨池时大小不代表时间顺序
    allLimitedPulls.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (parseInt(a.seqId || a.seq_id || '0', 10)) - (parseInt(b.seqId || b.seq_id || '0', 10));
    });

    const map = new Map();
    let sixPity = 0;
    let fivePity = 0;

    allLimitedPulls.forEach(item => {
      const isFree = item.isFree || item.is_free;
      if (!isFree) {
        sixPity++;
        fivePity++;
      }

      if (item.rarity >= 5) {
        map.set(item.id, {
          sixStarPity: isFree ? 'free' : (item.rarity === 6 ? sixPity : null),
          fiveStarPity: isFree ? 'free' : (item.rarity >= 5 ? fivePity : null),
        });
      }

      if (!isFree) {
        if (item.rarity === 6) sixPity = 0;
        if (item.rarity >= 5) fivePity = 0;
      }
    });

    return map;
  }, [currentPool?.type, poolsArray, historyArray, user, currentGameUid]);

  const characterStats = useMemo(() => {
    const isLimitedPool = currentPool?.type === 'limited' || currentPool?.type === 'limited_character';
    const characters = new Map();
    let pullIndex = 0;
    let sixStarPityCounter = 0;
    let fiveStarPityCounter = 0;

    normalizedPoolHistory.forEach(item => {
      if (item.specialType === 'gift') return;
      const isFree = item.isFree || item.is_free;
      if (!isFree) {
        pullIndex++;
        sixStarPityCounter++;
        fiveStarPityCounter++;
      }

      if (item.rarity >= 5) {
        const name = item.character_name || item.item_name || item.name || '未知';

        let pityValue;
        if (isFree) {
          pityValue = 'free';
        } else if (isLimitedPool && crossPoolPityMap) {
          const crossPity = crossPoolPityMap.get(item.id);
          pityValue = crossPity
            ? (item.rarity === 6 ? crossPity.sixStarPity : crossPity.fiveStarPity)
            : (item.rarity === 6 ? sixStarPityCounter : fiveStarPityCounter);
        } else {
          pityValue = item.rarity === 6 ? sixStarPityCounter : fiveStarPityCounter;
        }

        const existing = characters.get(name);
        if (existing) {
          existing.count++;
          existing.pullIndices.push(isFree ? 'free' : pullIndex);
          existing.pities.push(pityValue);
          existing.freeCount = (existing.freeCount || 0) + (isFree ? 1 : 0);
        } else {
          characters.set(name, {
            name,
            count: 1,
            rarity: item.rarity,
            isStandard: item.isStandard,
            isLimited: !item.isStandard && item.rarity === 6,
            pullIndices: [isFree ? 'free' : pullIndex],
            pities: [pityValue],
            freeCount: isFree ? 1 : 0
          });
        }

        if (!isFree) {
          if (item.rarity === 6) sixStarPityCounter = 0;
          if (item.rarity >= 5) fiveStarPityCounter = 0;
        }
      }
    });

    return Array.from(characters.values()).sort((a, b) => {
      if (a.rarity === 6 && !a.isStandard && (b.rarity !== 6 || b.isStandard)) return -1;
      if (b.rarity === 6 && !b.isStandard && (a.rarity !== 6 || a.isStandard)) return 1;
      if (a.rarity === 6 && a.isStandard && b.rarity !== 6) return -1;
      if (b.rarity === 6 && b.isStandard && a.rarity !== 6) return 1;
      if (a.rarity === b.rarity && a.isStandard === b.isStandard) return b.count - a.count;
      return b.rarity - a.rarity;
    });
  }, [normalizedPoolHistory, currentPool?.type, crossPoolPityMap]);

  const stats = useMemo(() => {
    if (!currentPool || normalizedPoolHistory.length === 0) {
      return {
        total: 0, currentPity: 0, currentPity5: 0,
        counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
        sixStarCount: 0, upSixStarCount: 0, winRate: '0',
        avgPullCost: { 6: '-', 5: '-' },
        probabilityInfo: null, hasInfoBook: false
      };
    }

    const validPulls = normalizedPoolHistory.filter(
      item => item.specialType !== 'gift' && !item.isFree && !item.is_free
    );
    const total = validPulls.length;

    let currentPity = 0;
    let currentPity5 = 0;
    for (let i = normalizedPoolHistory.length - 1; i >= 0; i--) {
      const item = normalizedPoolHistory[i];
      if (item.specialType === 'gift' || item.isFree || item.is_free) continue;
      if (item.rarity === 6) break;
      currentPity++;
    }
    for (let i = normalizedPoolHistory.length - 1; i >= 0; i--) {
      const item = normalizedPoolHistory[i];
      if (item.specialType === 'gift' || item.isFree || item.is_free) continue;
      if (item.rarity >= 5) break;
      currentPity5++;
    }

    const counts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    let upSixStarCount = 0;
    let upSixStarTotalPity = 0;
    let limitedSixStarTotalPity = 0;
    let limitedSixStarCount = 0;
    let offStandardCount = 0;
    let offLimitedCount = 0;
    let fiveStarTotalPity = 0;
    let fiveStarCount = 0;
    let sixStarPityCounter = 0;
    let fiveStarPityCounter = 0;

    normalizedPoolHistory.forEach(item => {
      if (item.specialType === 'gift') return;
      const isFree = item.isFree || item.is_free;

      if (!isFree) {
        sixStarPityCounter++;
        fiveStarPityCounter++;
      }

      if (item.rarity === 6 && !isFree) {
        if (item.isStandard) {
          counts['6_std']++;
          // 区分歪常驻 vs 歪限定
          const charName = item.character_name || item.item_name || item.name || '';
          const charInfo = characterCache.searchByName(charName);
          if (charInfo && charInfo.is_limited) {
            offLimitedCount++;
            limitedSixStarCount++;
            limitedSixStarTotalPity += sixStarPityCounter;
          } else {
            offStandardCount++;
          }
        } else {
          counts[6]++;
          upSixStarCount++;
          upSixStarTotalPity += sixStarPityCounter;
          limitedSixStarCount++;
          limitedSixStarTotalPity += sixStarPityCounter;
        }
        sixStarPityCounter = 0;
      }
      if (item.rarity === 5 && !isFree) {
        counts[5]++;
        fiveStarCount++;
        fiveStarTotalPity += fiveStarPityCounter;
        fiveStarPityCounter = 0;
      }
      if (item.rarity === 4 && !isFree) counts[4]++;
    });

    const sixStarCount = counts[6] + counts['6_std'];
    const winRate = sixStarCount > 0 ? ((counts[6] / sixStarCount) * 100).toFixed(1) : '0';

    const avgPullCost = {
      6: upSixStarCount > 0 ? (upSixStarTotalPity / upSixStarCount).toFixed(1) : '-',
      '6_limited': limitedSixStarCount > 0 ? (limitedSixStarTotalPity / limitedSixStarCount).toFixed(1) : '-',
      5: fiveStarCount > 0 ? (fiveStarTotalPity / fiveStarCount).toFixed(1) : '-'
    };

    const probabilityInfo = calculateCurrentProbability(currentPity, currentPool?.type);
    const hasInfoBook = currentPool?.type === 'limited' && total >= LIMITED_POOL_RULES.infoBookThreshold;

    return {
      total, currentPity, currentPity5, counts,
      sixStarCount, upSixStarCount, offStandardCount, offLimitedCount,
      winRate, avgPullCost,
      probabilityInfo, hasInfoBook
    };
  }, [normalizedPoolHistory, currentPool]);

  // 跨池保底继承（限定池）
  const crossPoolPity = useMemo(() => {
    if (!isLimited) return null;
    const allLimitedPools = poolsArray.filter(p => p.type === 'limited');
    const { inheritedPity, inheritedPity5, isInherited } = calculateInheritedPity(
      allLimitedPools,
      history,
      currentPoolId
    );
    return { pity6: inheritedPity, pity5: inheritedPity5, isInherited };
  }, [isLimited, poolsArray, history, currentPoolId]);

  const checkLimitedInFirstN = useMemo(() => {
    let pullCount = 0;
    let firstLimitedIndex120 = 0;
    let firstLimitedIndex80 = 0;

    for (const item of normalizedPoolHistory) {
      if (item.specialType === 'gift' || item.isFree || item.is_free) continue;
      pullCount++;
      if (item.rarity === 6 && !item.isStandard) {
        if (firstLimitedIndex120 === 0 && pullCount <= 120) firstLimitedIndex120 = pullCount;
        if (firstLimitedIndex80 === 0 && pullCount <= 80) firstLimitedIndex80 = pullCount;
      }
    }
    return { firstLimitedIndex120, firstLimitedIndex80, validPullCount: pullCount };
  }, [normalizedPoolHistory]);

  const hasReceivedFreeTen = useMemo(() => {
    return normalizedPoolHistory.some(h => h.isFree || h.is_free);
  }, [normalizedPoolHistory]);

  const weaponGifts = useMemo(() => {
    if (currentPool?.type !== 'weapon') return null;

    const giftThresholds = [100, 180, 260, 340, 420, 500];
    let nextGift = 0;
    let nextGiftType = 'standard';
    let standardCount = 0;
    let limitedCount = 0;

    for (const threshold of giftThresholds) {
      if (stats.total >= threshold) {
        if (threshold === 180 || threshold === 340 || threshold === 500) {
          limitedCount++;
        } else {
          standardCount++;
        }
      }
    }

    for (const threshold of giftThresholds) {
      if (stats.total < threshold) {
        nextGift = threshold;
        nextGiftType = (threshold === 180 || threshold === 340 || threshold === 500) ? 'limited' : 'standard';
        break;
      }
    }

    if (nextGift === 0 && stats.total >= 500) {
      const cycle = Math.floor((stats.total - 180) / 160);
      nextGift = 180 + (cycle + 1) * 160;
      nextGiftType = nextGift % 160 === 20 ? 'limited' : 'standard';
    }

    return { nextGift, nextGiftType, standardCount, limitedCount };
  }, [currentPool?.type, stats.total]);

  const isLimited = currentPool?.type === 'limited' || currentPool?.type === 'limited_character';
  const isWeapon = currentPool?.type === 'weapon' || currentPool?.type === 'limited_weapon';
  const isStandard = currentPool?.type === 'standard';
  const maxPity = isWeapon ? 40 : 80;

  const currentUpPool = useMemo(() => {
    // 如果当前查看的是限定池且有自身时间数据，优先使用
    if (isLimited && currentPool?.start_time && currentPool?.end_time) {
      const now = new Date();
      const start = new Date(currentPool.start_time);
      const end = new Date(currentPool.end_time);
      const isActive = now >= start && now < end;
      const isExpired = now >= end;
      const remainingMs = end - now;
      return {
        name: currentPool.up_character || currentPool.name,
        isActive,
        isExpired,
        remainingDays: isActive ? Math.floor(remainingMs / (1000 * 60 * 60 * 24)) : 0,
        remainingHours: isActive ? Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0,
      };
    }
    return getCurrentUpPoolInfo(poolsArray);
  }, [poolsArray, currentPool, isLimited]);

  const getProgressClass = () => {
    if (isLimited) return 'rainbow-progress';
    if (isWeapon) return 'bg-slate-500';
    return 'bg-amber-500';
  };

  const getCharacterAvatar = (name) => {
    const charData = characterCache.searchByName(name, false);
    return charData?.avatar_url;
  };

  if (!currentPool) {
    return (
      <div className="px-4 py-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 text-center rounded-none shadow-sm">
          <Calculator size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <p className="text-zinc-500 dark:text-zinc-400">请先选择或创建一个卡池</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 卡池选择器 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between rounded-none shadow-sm">
        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">目标卡池</span>
        <MobilePoolSelector />
      </div>

      {/* 卡池标题卡片 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden rounded-none shadow-md">
        <div className={`h-1.5 w-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-500' : 'bg-amber-500'}`} />
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-none border border-current ${
                isLimited ? 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/10' :
                isWeapon ? 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/10' :
                'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10'
              }`}>
                {isWeapon ? <Swords size={20} /> : isLimited ? <Star size={20} /> : <Layers size={20} />}
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                  {currentPool.name}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                  <span className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">
                    {isLimited ? '限定' : isWeapon ? '武器' : '常驻'}
                  </span>
                  <span>总计: {stats.total} 抽</span>
                </p>
              </div>
            </div>

            {currentPool.up_character && (
              <div className="text-right bg-zinc-50 dark:bg-zinc-800/50 p-1.5 border border-zinc-100 dark:border-zinc-700">
                <div className="text-[9px] text-zinc-400 uppercase font-mono mb-0.5">当前UP</div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
                  {currentPool.up_character}
                </div>
              </div>
            )}
          </div>

          {isLimited && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500 font-mono bg-zinc-50 dark:bg-zinc-900/50 p-2 border-l-2 border-endfield-yellow">
              <Clock size={10} className="text-endfield-yellow" />
              <span className="text-zinc-700 dark:text-zinc-300 font-bold uppercase">活动状态</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="uppercase">
                剩余时间: {currentUpPool.remainingDays || 0}天 {currentUpPool.remainingHours || 0}时
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 总投入 Banner */}
      <div className="bg-zinc-900 text-white border-l-4 border-endfield-yellow p-4 flex items-center justify-between rounded-none shadow-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]" />
        
        <div className="relative z-10">
          <h3 className="text-[10px] text-endfield-yellow font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
             <Calculator size={10} /> 总投入资源
          </h3>
          <div className="text-4xl font-black font-mono flex items-baseline gap-2">
            {stats.total}
            <span className="text-xs font-bold text-zinc-500">抽</span>
          </div>
        </div>
        <div className="relative z-10 h-12 w-12 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500">
          <Layers size={24} />
        </div>
      </div>

      {/* 保底进度 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 6星保底 */}
        {(() => {
          const displayPity = isLimited && crossPoolPity ? crossPoolPity.pity6 : stats.currentPity;
          return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wide">6★ 保底 ({maxPity})</span>
                {stats.probabilityInfo?.isInSoftPity && (
                  <span className="text-[9px] px-1 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono font-bold animate-pulse">
                    概率提升 {(stats.probabilityInfo.probability * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold font-mono text-zinc-800 dark:text-zinc-100">
                  {Math.max(maxPity - displayPity, 0)}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase">剩余</span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full">
                <div
                  className={`h-full transition-all ${getProgressClass()}`}
                  style={{ width: `${(displayPity / maxPity) * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500 font-mono">
                 <span>当前: {displayPity}{crossPoolPity?.isInherited && isLimited ? ' (跨池)' : ''}</span>
                 <span>上限: {maxPity}</span>
              </div>
            </div>
          );
        })()}

        {/* 5星保底 */}
        {(() => {
          const displayPity5 = isLimited && crossPoolPity ? crossPoolPity.pity5 : stats.currentPity5;
          return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none">
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wide mb-2">5★ 保底 (10)</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold font-mono text-zinc-800 dark:text-zinc-100">
                  {Math.max(10 - displayPity5, 0)}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase">剩余</span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${(displayPity5 / 10) * 100}%` }}
                />
              </div>
               <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500 font-mono">
                 <span>当前: {displayPity5}{crossPoolPity?.isInherited && isLimited ? ' (跨池)' : ''}</span>
                 <span>上限: 10</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 核心数据网格 */}
      <div className={`grid ${currentPool.type !== 'standard' ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
        {currentPool.type !== 'standard' && (
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
            <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-tight mb-1">限定 6★</div>
            <div className={`text-xl font-bold font-mono ${isLimited ? 'rainbow-text' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {stats.counts[6]}
            </div>
          </div>
        )}
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
          <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-tight mb-1">常驻 6★</div>
          <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{stats.counts['6_std']}</div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
          <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-tight mb-1">5★</div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{stats.counts[5]}</div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
          <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-tight mb-1">4★</div>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{stats.counts[4]}</div>
        </div>
      </div>

      {/* 不歪率和平均出货（限定/武器池） */}
      {(isLimited || isWeapon) && (
        <div className="grid grid-cols-2 gap-3">
          {/* 不歪率 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none">
            <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2 flex justify-between">
              <span>不歪率</span>
              {isLimited && <span className="text-[9px] text-zinc-300">(免十不计)</span>}
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100 mb-2">
              {stats.sixStarCount > 0 ? `${stats.winRate}%` : '-'}
            </div>
            <div className="h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full mb-2">
              <div
                className={`h-full ${isLimited ? 'rainbow-progress' : 'bg-blue-500'}`}
                style={{ width: `${parseFloat(stats.winRate) || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono uppercase">
              <span>UP: {stats.counts[6]}</span>
              <span>歪: {stats.counts['6_std']}</span>
            </div>
          </div>

          {/* UP六星平均出货 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none">
            <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2 flex justify-between">
              <span>UP六星造价</span>
              <span className="text-[9px] text-zinc-300">(免十/必出不计)</span>
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100 mb-2">
              {stats.avgPullCost[6]}
              {stats.upSixStarCount > 0 && <span className="text-xs ml-1 font-normal text-zinc-400">抽</span>}
            </div>
            <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 relative">
               <div className="absolute left-0 top-0 bottom-0 bg-zinc-300 dark:bg-zinc-600 w-1/2"></div>
            </div>
             <div className="mt-2 text-[9px] text-zinc-500 font-mono uppercase">
              期望: ~{isWeapon ? '31' : '62'}
            </div>
          </div>
        </div>
      )}

      {/* 限定六星平均出货（仅限定池且有歪限定数据时显示） */}
      {isLimited && stats.offLimitedCount > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none">
          <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2 flex justify-between">
            <span>限定六星造价</span>
            <span className="text-[9px] text-zinc-300">(UP+歪限定)</span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100 mb-2">
            {stats.avgPullCost['6_limited']}
            {stats.avgPullCost['6_limited'] !== '-' && <span className="text-xs ml-1 font-normal text-zinc-400">抽</span>}
          </div>
          <div className="mt-1 text-[9px] text-zinc-500 font-mono uppercase">
            限定六星: {stats.upSixStarCount + stats.offLimitedCount}次 (UP {stats.upSixStarCount} + 歪限定 {stats.offLimitedCount})
          </div>
        </div>
      )}

      {/* 特殊机制进度 */}
      <MobileChartContainer title="特殊机制进度" defaultExpanded={true} className="rounded-none">
        <div className="space-y-3 pt-2">
          {/* 限定池特殊进度 */}
          {isLimited && (
            <>
              {/* 免费十连 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-blue-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">免费十连</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {hasReceivedFreeTen ? '已领取' : '0 / 1'}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${hasReceivedFreeTen ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: hasReceivedFreeTen ? '100%' : '0%' }}
                  />
                </div>
                <div className="mt-1 text-[9px] text-zinc-400 font-mono">30抽后赠送，不计入保底</div>
              </div>

              {/* 120必出限定 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-green-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">井 (硬保底 120)</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {checkLimitedInFirstN.firstLimitedIndex120 > 0 ? '已达成' : `${Math.min(checkLimitedInFirstN.validPullCount, 120)} / 120`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${checkLimitedInFirstN.firstLimitedIndex120 > 0 ? 'bg-green-500' : 'rainbow-progress'}`}
                    style={{ width: checkLimitedInFirstN.firstLimitedIndex120 > 0 ? '100%' : `${Math.min((checkLimitedInFirstN.validPullCount / 120) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* 240赠送潜能 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-purple-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">赠送潜能 (240)</span>
                  <span className="text-xs font-mono text-zinc-500">{stats.total % 240} / 240</span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div className="h-full bg-purple-500" style={{ width: `${((stats.total % 240) / 240) * 100}%` }} />
                </div>
                {Math.floor(stats.total / 240) > 0 && (
                  <div className="mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold font-mono">
                    已获得: {Math.floor(stats.total / 240)}
                  </div>
                )}
              </div>

              {/* 情报书 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-cyan-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 uppercase">
                    <FileText size={12} /> 情报书 (60)
                  </span>
                  <span className="text-xs font-mono text-zinc-500">
                    {stats.hasInfoBook ? '已获得' : `${Math.min(stats.total, 60)} / 60`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${stats.hasInfoBook ? 'bg-green-500' : 'bg-cyan-500'}`}
                    style={{ width: stats.hasInfoBook ? '100%' : `${Math.min((stats.total / 60) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* 武器池特殊进度 */}
          {isWeapon && (
            <>
              {/* 80必出限定 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-slate-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">首轮保底 (80)</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {checkLimitedInFirstN.firstLimitedIndex80 > 0 ? '已达成' : `${Math.min(stats.total, 80)} / 80`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${checkLimitedInFirstN.firstLimitedIndex80 > 0 ? 'bg-green-500' : 'bg-slate-500'}`}
                    style={{ width: checkLimitedInFirstN.firstLimitedIndex80 > 0 ? '100%' : `${Math.min((stats.total / 80) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* 武器赠送 */}
              {weaponGifts && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-red-500 rounded-none">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 uppercase">
                      下个奖励
                      <span className={`px-1 py-0.5 text-[9px] font-bold text-white ${weaponGifts.nextGiftType === 'limited' ? 'rainbow-bg' : 'bg-red-500'}`}>
                        {weaponGifts.nextGiftType === 'limited' ? '限定' : '常驻'}
                      </span>
                    </span>
                    <span className="text-xs font-mono text-zinc-500">{stats.total} / {weaponGifts.nextGift}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                    <div
                      className={`h-full ${weaponGifts.nextGiftType === 'limited' ? 'rainbow-progress' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((stats.total / weaponGifts.nextGift) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex gap-3 text-[9px] text-zinc-500 font-mono uppercase">
                    <span>已获得:</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">{weaponGifts.standardCount} 常驻</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-medium">{weaponGifts.limitedCount} 限定</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 常驻池特殊进度 */}
          {isStandard && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-amber-500 rounded-none">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">自选赠送 (300)</span>
                <span className="text-xs font-mono text-zinc-500">{Math.min(stats.total, 300)} / 300</span>
              </div>
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                <div
                  className={`h-full ${stats.total >= 300 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((stats.total / 300) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </MobileChartContainer>

      {/* 角色出货统计 */}
      <MobileChartContainer
        title={`出货记录 (${characterStats.length})`}
        defaultExpanded={characterStats.length > 0}
        className="rounded-none"
        headerRight={characterStats.length > 0 ? (
          <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
            <button
              onClick={() => setCharViewMode('card')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                charViewMode === 'card'
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <LayoutGrid size={12} />
              卡片
            </button>
            <button
              onClick={() => setCharViewMode('waterfall')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                charViewMode === 'waterfall'
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <BarChart3 size={12} />
              时间线
            </button>
          </div>
        ) : null}
      >
        {characterStats.length > 0 ? (
          charViewMode === 'waterfall' ? (
            <MobileCharacterWaterfallChart characterStats={characterStats} />
          ) : (
          <div className="space-y-2 pt-2">
            {characterStats.map((char, index) => {
              const isSixStar = char.rarity === 6;
              const isLimitedChar = isSixStar && !char.isStandard;
              const isStandardChar = isSixStar && char.isStandard;
              const avatarUrl = getCharacterAvatar(char.name);

              // 生成出货抽数描述
              const pullInfoParts = char.pullIndices.map((idx, i) => {
                const pity = char.pities[i];
                if (idx === 'free' || pity === 'free') return { type: 'free', text: '免费' };
                if (pity) return { type: 'normal', text: `${pity}(#${idx})` };
                return { type: 'normal', text: `#${idx}` };
              });

              return (
                <div
                  key={char.name}
                  className={`relative flex items-center gap-3 p-2 border transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    isLimitedChar
                      ? 'bg-zinc-50 dark:bg-zinc-900/50 border-orange-200 dark:border-orange-900/30'
                      : isStandardChar
                        ? 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/20'
                        : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                  }`}
                >
                  {/* 左侧颜色条 */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isLimitedChar ? 'rainbow-bg' : isStandardChar ? 'bg-red-500' : 'bg-amber-400'
                  }`} />

                  {/* 头像 */}
                  <div className={`ml-2 w-10 h-10 rounded-none flex items-center justify-center shrink-0 overflow-hidden border ${
                    isLimitedChar
                      ? 'border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                      : isStandardChar
                        ? 'border-red-200 dark:border-red-800 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                        : 'border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
                  }`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={char.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold truncate uppercase tracking-tight ${
                        isLimitedChar ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-400'
                      }`}>
                        {char.name}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: char.rarity }).map((_, i) => (
                          <Star key={i} size={8} className={`${isSixStar ? 'text-orange-400' : 'text-amber-400'} fill-current`} />
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                      {pullInfoParts.map((part, i) => (
                        <span key={i}>
                          {part.type === 'free' ? (
                            <span className="text-blue-500 font-bold">{part.text}</span>
                          ) : (
                            <span>{part.text}</span>
                          )}
                          {i < pullInfoParts.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 数量 */}
                  <div className={`text-xs font-mono font-bold px-1.5 py-0.5 border ${
                    isLimitedChar ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 text-orange-600 dark:text-orange-400' :
                    isStandardChar ? 'bg-red-50 dark:bg-red-900/10 border-red-200 text-red-600 dark:text-red-400' :
                    'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 text-zinc-500'
                  }`}>
                    x{char.count}
                  </div>
                </div>
              );
            })}
          </div>
          )
        ) : (
          <p className="text-xs text-zinc-400 font-mono text-center py-4 uppercase tracking-widest">暂无记录</p>
        )}
      </MobileChartContainer>

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}

export default MobileDashboardView;