import { useMemo, useState } from 'react';
import { useAuthStore } from '../../stores';
import { getCurrentUpPoolInfo } from '../../utils/poolTimeUtils';
import { characterCache } from '../../utils/characterUtils';
import { isInfoBookHistoryPull } from '../../utils/historyInfoBook';
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
  const [charViewMode, setCharViewMode] = useState('card');

  const {
    poolsArray,
    currentPool,
    normalizedCurrentPoolHistory: normalizedPoolHistory,
    allLimitedHistory,
    crossPoolPityMap
  } = useCurrentPoolData();

  const normalizedPoolType = normalizePoolType(currentPool?.type);
  const isLimited = normalizedPoolType === 'limited';
  const isWeapon = normalizedPoolType === 'weapon';
  const isStandard = normalizedPoolType === 'standard';
  const maxPity = isWeapon ? 40 : 80;
  const hasPoolData = poolsArray.length > 0;
  const isGroupMode = currentPool?.isGroupMode === true;

  const { stats, effectivePity } = usePoolStats({
    normalizedCurrentPoolHistory: normalizedPoolHistory,
    currentPool,
    allLimitedHistory,
    currentPoolId: currentPool?.id
  });

  const characterStats = useMemo(() => {
    const characters = new Map();
    let pullIndex = 0;
    let sixStarPityCounter = 0;
    let fiveStarPityCounter = 0;

    const sortedHistory = [...normalizedPoolHistory].sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    sortedHistory.forEach(item => {
      if (item.specialType === 'gift' || item.special_type === 'gift') {
        return;
      }

      const isFree = item.isFree || item.is_free;
      const isInfoBook = isInfoBookHistoryPull(item);
      if (!isFree) {
        pullIndex++;
        sixStarPityCounter++;
        fiveStarPityCounter++;
      }

      if (item.rarity < 5) {
        return;
      }

      const name = item.character_name || item.item_name || item.name || '未知';

      let pityValue;
      if (isFree) {
        pityValue = 'free';
      } else if (isLimited && crossPoolPityMap) {
        const crossPity = crossPoolPityMap.get(item.id || item.record_id);
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
        existing.infoBookCount = (existing.infoBookCount || 0) + (isInfoBook ? 1 : 0);
        existing.infoBookFlags.push(isInfoBook);
      } else {
        characters.set(name, {
          name,
          count: 1,
          rarity: item.rarity,
          isStandard: item.isStandard,
          isLimited: !item.isStandard && item.rarity === 6,
          pullIndices: [isFree ? 'free' : pullIndex],
          pities: [pityValue],
          freeCount: isFree ? 1 : 0,
          infoBookCount: isInfoBook ? 1 : 0,
          infoBookFlags: [isInfoBook]
        });
      }

      if (!isFree) {
        if (item.rarity === 6) {
          sixStarPityCounter = 0;
        }
        if (item.rarity >= 5) {
          fiveStarPityCounter = 0;
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
  }, [crossPoolPityMap, isLimited, normalizedPoolHistory]);

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

  return {
    user,
    charViewMode,
    setCharViewMode,
    poolsArray,
    currentPool,
    normalizedPoolHistory,
    crossPoolPityMap,
    normalizedPoolType,
    isLimited,
    isWeapon,
    isStandard,
    maxPity,
    hasPoolData,
    isGroupMode,
    stats,
    effectivePity,
    characterStats,
    totalCharacterCount,
    checkLimitedInFirstN,
    hasReceivedFreeTen,
    weaponGifts,
    currentUpPool,
    getProgressClass,
    getCharacterAvatar
  };
}

export default useDashboardViewState;
