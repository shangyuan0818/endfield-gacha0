import { useMemo, useState } from 'react';
import { useAuthStore } from '../../stores';
import { getCurrentUpPoolInfo } from '../../utils/poolTimeUtils';
import { characterCache } from '../../utils/characterUtils';
import { isInfoBookHistoryPull } from '../../utils/historyInfoBook';
import { buildResourceSummaryFromAggregates } from '../../utils/resourceEconomy';
import { buildCharacterStats } from '../../utils/dashboardCharacterStats';
import { useCurrentPoolData } from './useCurrentPoolData';
import { usePoolStats } from './usePoolStats';

function normalizePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type;
}

export function useDashboardViewState() {
  const user = useAuthStore(state => state.user);
  const [charViewMode, setCharViewMode] = useState('waterfall');

  const {
    poolsArray,
    selectedPools,
    currentPool,
    currentPoolHistory,
    normalizedCurrentPoolHistory: normalizedPoolHistory,
    allLimitedHistory,
    crossPoolPityMap,
    hasMergedAccountView,
    groupType
  } = useCurrentPoolData();

  const normalizedPoolType = normalizePoolType(currentPool?.type);
  const isLimited = normalizedPoolType === 'limited';
  const isWeapon = normalizedPoolType === 'weapon';
  const isStandard = normalizedPoolType === 'standard';
  const maxPity = isWeapon ? 40 : 80;
  const hasPoolData = poolsArray.length > 0;
  const isGroupMode = currentPool?.isGroupMode === true;
  const isAllPoolsOverview = currentPool?.isAllPoolsOverview === true;

  const { stats, effectivePity, groupedHistory } = usePoolStats({
    normalizedCurrentPoolHistory: normalizedPoolHistory,
    currentPool,
    allLimitedHistory,
    currentPoolId: currentPool?.id
  });

  const characterStats = useMemo(() => (
    buildCharacterStats({
      history: normalizedPoolHistory,
      isLimitedPool: isLimited,
      crossPoolPityMap
    })
  ), [crossPoolPityMap, isLimited, normalizedPoolHistory]);

  const totalCharacterCount = useMemo(() => {
    return characterStats.reduce((sum, char) => sum + char.count, 0);
  }, [characterStats]);

  const checkLimitedInFirstN = useMemo(() => {
    const sortedHistory = [...normalizedPoolHistory].sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    let pullCount = 0;
    let firstLimitedIndex120 = 0;
    let firstLimitedIndex80 = 0;

    for (const item of sortedHistory) {
      if (item.specialType === 'gift' || item.special_type === 'gift' || item.isFree || item.is_free) {
        continue;
      }

      pullCount++;
      if (item.rarity === 6 && !item.isStandard) {
        if (firstLimitedIndex120 === 0 && pullCount <= 120) firstLimitedIndex120 = pullCount;
        if (firstLimitedIndex80 === 0 && pullCount <= 80) firstLimitedIndex80 = pullCount;
      }
    }

    return { firstLimitedIndex120, firstLimitedIndex80, validPullCount: pullCount };
  }, [normalizedPoolHistory]);

  const hasReceivedFreeTen = useMemo(() => {
    return normalizedPoolHistory.some(item => item.isFree || item.is_free);
  }, [normalizedPoolHistory]);

  const weaponGifts = useMemo(() => {
    if (normalizedPoolType !== 'weapon') {
      return null;
    }

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
  }, [normalizedPoolType, stats.total]);

  const currentUpPool = useMemo(() => {
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
        remainingHours: isActive ? Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0
      };
    }

    return getCurrentUpPoolInfo(poolsArray);
  }, [currentPool, isLimited, poolsArray]);

  const getProgressClass = () => {
    if (isLimited) return 'rainbow-progress';
    if (isWeapon) return 'bg-slate-500';
    return 'bg-amber-500';
  };

  const getCharacterAvatar = (name) => {
    const charData = characterCache.searchByName(name, false);
    return charData?.avatar_url;
  };

  const dashboardResourceSummary = useMemo(() => {
    if (!isAllPoolsOverview) {
      return stats.resourceSummary;
    }

    const poolTypeById = new Map(selectedPools.map((pool) => [pool.id, normalizePoolType(pool.type)]));
    const counts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    const arsenalGainCounts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    let characterPulls = 0;
    let weaponPulls = 0;
    let chargedCharacterPulls = 0;
    let chargedWeaponPulls = 0;

    currentPoolHistory.forEach((item) => {
      const isGift = item?.specialType === 'gift' || item?.special_type === 'gift';
      const isFree = item?.isFree === true || item?.is_free === true;
      if (isGift || isFree) {
        return;
      }

      const poolId = item?.poolId || item?.pool_id || null;
      const poolType = poolTypeById.get(poolId) || 'standard';
      const rarity = Number(item?.rarity) || 0;
      const targetCounts = poolType === 'weapon' ? counts : arsenalGainCounts;

      if (poolType === 'weapon') {
        weaponPulls += 1;
        if (!isInfoBookHistoryPull(item)) {
          chargedWeaponPulls += 1;
        }
      } else {
        characterPulls += 1;
        if (!isInfoBookHistoryPull(item)) {
          chargedCharacterPulls += 1;
        }
      }

      if (rarity >= 6) {
        if (item?.isStandard) {
          targetCounts['6_std'] += 1;
        } else {
          targetCounts[6] += 1;
        }
      } else if (rarity === 5) {
        targetCounts[5] += 1;
      } else if (rarity >= 1) {
        targetCounts[4] += 1;
      }
    });

    return buildResourceSummaryFromAggregates({
      characterPulls,
      weaponPulls,
      chargedCharacterPulls,
      chargedWeaponPulls,
      counts: {
        6: arsenalGainCounts[6] + counts[6],
        '6_std': arsenalGainCounts['6_std'] + counts['6_std'],
        5: arsenalGainCounts[5] + counts[5],
        4: arsenalGainCounts[4] + counts[4]
      },
      arsenalGainCounts
    });
  }, [currentPoolHistory, isAllPoolsOverview, selectedPools, stats.resourceSummary]);

  const resourceSummaryVariant = useMemo(() => {
    if (isAllPoolsOverview) {
      return 'all';
    }

    return normalizedPoolType === 'weapon' ? 'weapon' : 'character';
  }, [isAllPoolsOverview, normalizedPoolType]);

  return {
    user,
    charViewMode,
    setCharViewMode,
    poolsArray,
    selectedPools,
    currentPool,
    currentPoolHistory,
    normalizedPoolHistory,
    allLimitedHistory,
    crossPoolPityMap,
    hasMergedAccountView,
    normalizedPoolType,
    isLimited,
    isWeapon,
    isStandard,
    isAllPoolsOverview,
    maxPity,
    hasPoolData,
    isGroupMode,
    groupType,
    stats,
    effectivePity,
    groupedHistory,
    characterStats,
    totalCharacterCount,
    checkLimitedInFirstN,
    hasReceivedFreeTen,
    weaponGifts,
    currentUpPool,
    getProgressClass,
    getCharacterAvatar,
    dashboardResourceSummary,
    resourceSummaryVariant
  };
}

export default useDashboardViewState;
