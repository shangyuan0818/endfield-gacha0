import { useMemo } from 'react';
import { DEFAULT_POOL_ID } from '../../constants';
import { useAuthStore, useHistoryStore, usePoolStore } from '../../stores';
import {
  getPoolGroupType,
  getPoolsForGroupType,
  isPoolGroupId
} from '../../stores/usePoolStore';
import {
  annotateInfoBookPulls,
  isFreeHistoryPull,
  isGiftHistoryPull
} from '../../utils/historyInfoBook';
import { normalizeIsStandard } from '../../utils';
import { getPreferredPool } from '../../utils/poolSelectionUtils';
import { buildPoolSelectorGroups, getPoolTypeLabel } from '../../utils/poolSelectorDisplay';
import { useI18n } from '../../i18n/index.js';

const LIMITED_POOL_TYPES = new Set(['limited', 'limited_character']);

function getPoolId(pool) {
  return pool?.id || pool?.pool_id || null;
}

function getHistoryPoolId(item) {
  return item.poolId || item.pool_id || null;
}

function getHistoryGameUid(item) {
  return item.game_uid || item.gameUid || null;
}

function getHistoryRecordKey(item) {
  return item.id || item.record_id || null;
}

function getHistorySeqId(item) {
  return parseInt(item.seqId || item.seq_id || '0', 10) || 0;
}

function sortByTimeline(a, b) {
  const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
  const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  return getHistorySeqId(a) - getHistorySeqId(b);
}

function matchesCurrentGameUid(item, currentGameUid) {
  if (!currentGameUid) {
    return true;
  }

  return getHistoryGameUid(item) === currentGameUid;
}

export function useCurrentPoolData() {
  const { locale, t } = useI18n();
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const history = useHistoryStore(state => state.history);

  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);
  const historyArray = useMemo(() => (Array.isArray(history) ? history : []), [history]);
  const ownedHistoryArray = useMemo(() => {
    if (!user?.id) {
      return [];
    }

    return historyArray.filter((item) => item.user_id === user.id);
  }, [historyArray, user?.id]);
  const mergedAccountCount = useMemo(() => (
    new Set(
      ownedHistoryArray
        .map((item) => getHistoryGameUid(item))
        .filter(Boolean)
    ).size
  ), [ownedHistoryArray]);
  const hasMergedAccountView = !currentGameUid && mergedAccountCount > 1;
  const accountHistoryArray = useMemo(() => {
    if (!user?.id) {
      return [];
    }

    return ownedHistoryArray.filter(item =>
      matchesCurrentGameUid(item, currentGameUid)
    );
  }, [currentGameUid, ownedHistoryArray, user?.id]);
  const annotatedAccountHistoryArray = useMemo(
    () => annotateInfoBookPulls(accountHistoryArray, poolsArray),
    [accountHistoryArray, poolsArray]
  );

  const isGroupMode = isPoolGroupId(currentPoolId);
  const groupType = isGroupMode ? getPoolGroupType(currentPoolId) : null;
  const selectedPools = useMemo(() => {
    if (isGroupMode) {
      const orderedGroups = buildPoolSelectorGroups({ pools: poolsArray, locale });

      if (groupType === 'all') {
        return orderedGroups.flatMap((group) => group.pools);
      }

      return orderedGroups.find((group) => group.type === groupType)?.pools || getPoolsForGroupType(poolsArray, groupType);
    }

    const preferredPool = getPreferredPool(poolsArray, {
      preferredPoolId: currentPoolId,
      includeDefaultPool: true
    });
    return preferredPool ? [preferredPool] : [];
  }, [currentPoolId, groupType, isGroupMode, locale, poolsArray]);

  const currentPool = useMemo(() => {
    if (isGroupMode) {
      if (groupType === 'all') {
        return {
          id: currentPoolId,
          name: t('dashboard.timeline.title.overview'),
          type: 'all',
          isGroupMode: true,
          isAllPoolsOverview: true,
          up_character: null,
          locked: true
        };
      }

      const baseType = groupType === 'weapon_limited' || groupType === 'weapon_standard'
        ? 'weapon'
        : groupType === 'limited'
          ? 'limited'
          : groupType;

      return {
        id: currentPoolId,
        name: t('pool.card.allGroupTitle', { label: getPoolTypeLabel(groupType, locale) }),
        type: baseType,
        isGroupMode: true,
        isAllPoolsOverview: false,
        up_character: null,
        locked: true
      };
    }

    const preferredPool = getPreferredPool(poolsArray, {
      preferredPoolId: currentPoolId,
      includeDefaultPool: true
    });
    if (preferredPool) {
      return preferredPool;
    }

    return {
      id: DEFAULT_POOL_ID,
      name: t('simulator.defaultPoolName'),
      type: 'limited',
      locked: false
    };
  }, [currentPoolId, groupType, isGroupMode, locale, poolsArray, t]);

  const currentPoolHistory = useMemo(() => {
    if (!user?.id) {
      return [];
    }

    if (isGroupMode) {
      const groupPoolIds = new Set(
        selectedPools
          .map(pool => getPoolId(pool))
          .filter(Boolean)
      );

      return annotatedAccountHistoryArray
        .filter(item => groupPoolIds.has(getHistoryPoolId(item)))
        .sort(sortByTimeline);
    }

    const activePoolId = currentPool?.id || currentPoolId;
    if (!activePoolId) {
      return [];
    }

    return annotatedAccountHistoryArray
      .filter(item => getHistoryPoolId(item) === activePoolId)
      .sort(sortByTimeline);
  }, [annotatedAccountHistoryArray, currentPool?.id, currentPoolId, isGroupMode, selectedPools, user?.id]);

  const normalizedCurrentPoolHistory = useMemo(() => {
    if (isGroupMode) {
      const poolMap = new Map(
        poolsArray
          .map(pool => [getPoolId(pool), pool])
          .filter(([poolId]) => Boolean(poolId))
      );

      return currentPoolHistory.map(item => {
        const pool = poolMap.get(getHistoryPoolId(item));
        return {
          ...item,
          isStandard: normalizeIsStandard(item, pool?.type, pool?.up_character)
        };
      });
    }

    return currentPoolHistory.map(item => ({
      ...item,
      isStandard: normalizeIsStandard(item, currentPool?.type, currentPool?.up_character)
    }));
  }, [currentPool?.type, currentPool?.up_character, currentPoolHistory, isGroupMode, poolsArray]);

  const allLimitedHistory = useMemo(() => {
    if (!user?.id) {
      return [];
    }

    const limitedPoolIds = new Set(
      poolsArray
        .filter(pool => LIMITED_POOL_TYPES.has(pool.type))
        .map(pool => getPoolId(pool))
        .filter(Boolean)
    );

    return annotatedAccountHistoryArray
      .filter(item => limitedPoolIds.has(getHistoryPoolId(item)))
      .sort(sortByTimeline);
  }, [annotatedAccountHistoryArray, poolsArray, user?.id]);

  const crossPoolPityMap = useMemo(() => {
    if (isGroupMode || !LIMITED_POOL_TYPES.has(currentPool?.type)) {
      return null;
    }

    const map = new Map();
    let sixPity = 0;
    let fivePity = 0;

    allLimitedHistory
      .filter(item => !isGiftHistoryPull(item))
      .forEach(item => {
        const isFree = isFreeHistoryPull(item);
        const recordKey = getHistoryRecordKey(item);

        if (!isFree) {
          sixPity++;
          fivePity++;
        }

        if (item.rarity >= 5 && recordKey) {
          map.set(recordKey, {
            sixStarPity: isFree ? 'free' : (item.rarity === 6 ? sixPity : null),
            fiveStarPity: isFree ? 'free' : fivePity
          });
        }

        if (!isFree) {
          if (item.rarity === 6) {
            sixPity = 0;
          }
          if (item.rarity >= 5) {
            fivePity = 0;
          }
        }
      });

    return map;
  }, [allLimitedHistory, currentPool?.type, isGroupMode]);

  return {
    poolsArray,
    selectedPools,
    historyArray,
    currentPool,
    currentPoolHistory,
    normalizedCurrentPoolHistory,
    allLimitedHistory,
    crossPoolPityMap,
    hasMergedAccountView,
    isGroupMode,
    groupType
  };
}

export default useCurrentPoolData;
