import { useEffect, useMemo, useState } from 'react';
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
import { compareHistoryTimelineAsc } from '../../utils/historyTimelineSort.js';
import { resolvePoolRosterBuckets } from '../../utils/poolRoster.js';
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
  const timelineDiff = compareHistoryTimelineAsc(a, b);
  if (timelineDiff !== 0) {
    return timelineDiff;
  }

  return getHistorySeqId(a) - getHistorySeqId(b);
}

function matchesCurrentGameUid(item, currentGameUid) {
  if (!currentGameUid) {
    return true;
  }

  return getHistoryGameUid(item) === currentGameUid;
}

function normalizePoolType(type) {
  if (type === 'limited_character') {
    return 'limited';
  }

  if (type === 'limited_weapon') {
    return 'weapon';
  }

  if (type === 'beginner') {
    return 'standard';
  }

  return type;
}

function getRosterExpectedType(poolType) {
  return poolType === 'weapon' ? 'weapon' : 'character';
}

function getRosterPoolType(poolType) {
  if (poolType === 'weapon') {
    return 'weapon';
  }

  if (poolType === 'limited') {
    return 'limited';
  }

  return 'standard';
}

export function useCurrentPoolData() {
  const { locale, t } = useI18n();
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const history = useHistoryStore(state => state.history);

  const rawPoolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);
  const [poolRosterById, setPoolRosterById] = useState(() => new Map());
  const historyArray = useMemo(() => (Array.isArray(history) ? history : []), [history]);
  useEffect(() => {
    let cancelled = false;

    const loadPoolRosters = async () => {
      const rosterCandidates = rawPoolsArray.filter((pool) => getPoolId(pool));
      if (rosterCandidates.length === 0) {
        if (!cancelled) {
          setPoolRosterById(new Map());
        }
        return;
      }

      const rosterEntries = await Promise.all(rosterCandidates.map(async (pool) => {
        const normalizedPoolType = normalizePoolType(pool?.type);
        const currentUpName = pool?.up_character || pool?.upCharacter || null;
        const roster = await resolvePoolRosterBuckets({
          poolId: getPoolId(pool),
          expectedType: getRosterExpectedType(normalizedPoolType),
          currentUpName,
          poolType: getRosterPoolType(normalizedPoolType),
          poolInfo: pool,
          mergeStrategy: normalizedPoolType === 'limited' ? 'fill-missing' : 'append',
        }).catch(() => null);

        const featuredCharacters = Array.isArray(roster?.sixStar) ? roster.sixStar.filter(Boolean) : [];
        return [
          getPoolId(pool),
          featuredCharacters.length > 0
            ? {
                roster,
              }
            : null,
        ];
      }));

      if (cancelled) {
        return;
      }

      setPoolRosterById(new Map(rosterEntries.filter(([, value]) => Boolean(value))));
    };

    loadPoolRosters();

    return () => {
      cancelled = true;
    };
  }, [rawPoolsArray]);

  const poolsArray = useMemo(() => rawPoolsArray.map((pool) => {
    const poolId = getPoolId(pool);
    const rosterMeta = poolId ? poolRosterById.get(poolId) : null;
    if (!rosterMeta) {
      return pool;
    }

    return {
      ...pool,
      resolved_roster: rosterMeta.roster,
    };
  }), [poolRosterById, rawPoolsArray]);

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
    poolRosterById,
    selectedPools,
    historyArray,
    annotatedAccountHistoryArray,
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
