function normalizePoolType(type) {
  if (type === 'extra') return 'extra';
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type;
}

function isGiftPull(item) {
  return item?.specialType === 'gift' || item?.special_type === 'gift';
}

function isFreePull(item) {
  return item?.isFree === true || item?.is_free === true;
}

function getHistoryPoolId(item) {
  return item?.poolId || item?.pool_id || null;
}

function calculatePity(history = [], rarityThreshold = 6) {
  let pity = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (isGiftPull(item) || isFreePull(item)) {
      continue;
    }

    if (Number(item?.rarity) >= rarityThreshold) {
      break;
    }

    pity += 1;
  }

  return pity;
}

function getHistorySeq(item) {
  const value = Number(item?.seqId || item?.seq_id || 0);
  return Number.isFinite(value) ? value : 0;
}

function getHistoryTimestamp(item) {
  if (typeof item?.timestamp === 'number' && Number.isFinite(item.timestamp)) {
    return item.timestamp;
  }

  const parsed = new Date(item?.timestamp || item?.gacha_time || item?.created_at || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortHistoryAsc(left, right) {
  const timeDiff = getHistoryTimestamp(left) - getHistoryTimestamp(right);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return getHistorySeq(left) - getHistorySeq(right);
}

function buildLimitedTerminalPityMap(allLimitedHistory = []) {
  const terminalMap = new Map();
  const validLimitedPulls = [...allLimitedHistory]
    .filter((item) => !isGiftPull(item) && !isFreePull(item))
    .sort(sortHistoryAsc);
  let pity6 = 0;
  let pity5 = 0;

  validLimitedPulls.forEach((item) => {
    const rarity = Number(item?.rarity) || 0;
    pity6 = rarity >= 6 ? 0 : pity6 + 1;
    pity5 = rarity >= 5 ? 0 : pity5 + 1;

    const poolId = getHistoryPoolId(item);
    if (!poolId) {
      return;
    }

    terminalMap.set(poolId, {
      pity6,
      pity5,
      isInherited: false
    });
  });

  return terminalMap;
}

export function getPoolAnalysisPityState(currentPool, stats = {}, effectivePity = null) {
  const normalizedType = normalizePoolType(currentPool?.type);
  const isLimited = normalizedType === 'limited';
  const isExtra = normalizedType === 'extra';
  const isWeapon = normalizedType === 'weapon';
  const maxPity6 = isWeapon ? 40 : 80;
  const displayPity6 = isLimited ? (effectivePity?.pity6 ?? stats.currentPity ?? 0) : (stats.currentPity ?? 0);
  const displayPity5 = isLimited ? (effectivePity?.pity5 ?? stats.currentPity5 ?? 0) : (stats.currentPity5 ?? 0);

  return {
    normalizedType,
    isLimited,
    isExtra,
    isWeapon,
    maxPity6,
    maxPity5: 10,
    displayPity6,
    displayPity5,
    isInherited6: Boolean(effectivePity?.isInherited && isLimited && displayPity6 > 0),
    isInherited5: Boolean(effectivePity?.isInherited && isLimited && displayPity5 > 0)
  };
}

export function buildOverviewPoolAnalysisPityMap({
  pools = [],
  history = [],
  allLimitedHistory = []
}) {
  const historyByPoolId = new Map();
  history.forEach((item) => {
    const poolId = item?.poolId || item?.pool_id || null;
    if (!poolId) {
      return;
    }

    if (!historyByPoolId.has(poolId)) {
      historyByPoolId.set(poolId, []);
    }
    historyByPoolId.get(poolId).push(item);
  });

  const limitedTerminalPityMap = buildLimitedTerminalPityMap(allLimitedHistory);

  return new Map(
    (Array.isArray(pools) ? pools : []).map((pool) => {
      const poolHistory = historyByPoolId.get(pool.id) || [];
      const stats = {
        currentPity: calculatePity(poolHistory, 6),
        currentPity5: calculatePity(poolHistory, 5)
      };
      const normalizedType = normalizePoolType(pool?.type);
      const terminalLimitedPity = normalizedType === 'limited'
        ? limitedTerminalPityMap.get(pool.id)
        : null;

      return [
        pool.id,
        getPoolAnalysisPityState(
          pool,
          terminalLimitedPity
            ? {
              currentPity: terminalLimitedPity.pity6,
              currentPity5: terminalLimitedPity.pity5
            }
            : stats,
          null
        )
      ];
    })
  );
}

export default {
  getPoolAnalysisPityState,
  buildOverviewPoolAnalysisPityMap
};
