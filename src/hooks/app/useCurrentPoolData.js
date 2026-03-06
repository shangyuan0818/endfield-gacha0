import { useMemo } from 'react';
import { DEFAULT_POOL_ID } from '../../constants';
import { useAuthStore, useHistoryStore, usePoolStore } from '../../stores';
import {
  GROUP_TYPE_LABELS,
  getPoolGroupType,
  getPoolsForGroupType,
  isPoolGroupId
} from '../../stores/usePoolStore';
import { normalizeIsStandard } from '../../utils';

const LIMITED_POOL_TYPES = new Set(['limited', 'limited_character']);

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
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const history = useHistoryStore(state => state.history);

  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);
  const historyArray = useMemo(() => (Array.isArray(history) ? history : []), [history]);

  const isGroupMode = isPoolGroupId(currentPoolId);
  const groupType = isGroupMode ? getPoolGroupType(currentPoolId) : null;

  const currentPool = useMemo(() => {
    if (isGroupMode) {
      const baseType = groupType === 'weapon_limited' || groupType === 'weapon_standard'
        ? 'weapon'
        : groupType === 'limited'
          ? 'limited'
          : groupType;

      return {
        id: currentPoolId,
        name: `全部${GROUP_TYPE_LABELS[groupType] || ''}池`,
        type: baseType,
        isGroupMode: true,
        up_character: null,
        locked: true
      };
    }

    const byId = poolsArray.find(pool => pool.id === currentPoolId);
    if (byId) {
      return byId;
    }

    const defaultPool = poolsArray.find(pool => pool.id === DEFAULT_POOL_ID);
    if (defaultPool) {
      return defaultPool;
    }

    if (poolsArray[0]) {
      return poolsArray[0];
    }

    return {
      id: DEFAULT_POOL_ID,
      name: '默认卡池',
      type: 'limited',
      locked: false
    };
  }, [currentPoolId, groupType, isGroupMode, poolsArray]);

  const currentPoolHistory = useMemo(() => {
    if (!user?.id) {
      return [];
    }

    if (isGroupMode) {
      const groupPools = getPoolsForGroupType(poolsArray, groupType);
      const groupPoolIds = new Set(groupPools.map(pool => pool.id));

      return historyArray.filter(item =>
        groupPoolIds.has(getHistoryPoolId(item)) &&
        item.user_id === user.id &&
        matchesCurrentGameUid(item, currentGameUid)
      );
    }

    const activePoolId = currentPool?.id || currentPoolId;
    if (!activePoolId) {
      return [];
    }

    return historyArray.filter(item =>
      getHistoryPoolId(item) === activePoolId &&
      item.user_id === user.id &&
      matchesCurrentGameUid(item, currentGameUid)
    );
  }, [currentGameUid, currentPool?.id, currentPoolId, groupType, historyArray, isGroupMode, poolsArray, user?.id]);

  const normalizedCurrentPoolHistory = useMemo(() => {
    if (isGroupMode) {
      const poolMap = new Map(poolsArray.map(pool => [pool.id, pool]));

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
        .map(pool => pool.id)
    );

    return historyArray
      .filter(item =>
        limitedPoolIds.has(getHistoryPoolId(item)) &&
        item.user_id === user.id &&
        matchesCurrentGameUid(item, currentGameUid)
      )
      .sort(sortByTimeline);
  }, [currentGameUid, historyArray, poolsArray, user?.id]);

  const crossPoolPityMap = useMemo(() => {
    if (isGroupMode || !LIMITED_POOL_TYPES.has(currentPool?.type)) {
      return null;
    }

    const map = new Map();
    let sixPity = 0;
    let fivePity = 0;

    allLimitedHistory
      .filter(item => item.specialType !== 'gift' && item.special_type !== 'gift')
      .forEach(item => {
        const isFree = item.isFree || item.is_free;
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
    historyArray,
    currentPool,
    currentPoolHistory,
    normalizedCurrentPoolHistory,
    allLimitedHistory,
    crossPoolPityMap,
    isGroupMode,
    groupType
  };
}

export default useCurrentPoolData;
