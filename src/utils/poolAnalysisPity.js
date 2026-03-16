function normalizePoolType(type) {
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

function buildLimitedEffectivePityState(allLimitedHistory = [], currentPoolId = null) {
  const validLimitedPulls = allLimitedHistory.filter((item) => !isGiftPull(item) && !isFreePull(item));

  if (validLimitedPulls.length === 0) {
    return {
      pity6: 0,
      pity5: 0,
      isInherited: false
    };
  }

  let lastSixStarPoolId = null;
  for (let index = validLimitedPulls.length - 1; index >= 0; index -= 1) {
    if (Number(validLimitedPulls[index]?.rarity) >= 6) {
      lastSixStarPoolId = getHistoryPoolId(validLimitedPulls[index]);
      break;
    }
  }

  const pity6 = calculatePity(validLimitedPulls, 6);
  const pity5 = calculatePity(validLimitedPulls, 5);

  return {
    pity6,
    pity5,
    isInherited: pity6 > 0 && lastSixStarPoolId !== currentPoolId
  };
}

export function getPoolAnalysisPityState(currentPool, stats = {}, effectivePity = null) {
  const normalizedType = normalizePoolType(currentPool?.type);
  const isLimited = normalizedType === 'limited';
  const isWeapon = normalizedType === 'weapon';
  const maxPity6 = isWeapon ? 40 : 80;
  const displayPity6 = isLimited ? (effectivePity?.pity6 ?? stats.currentPity ?? 0) : (stats.currentPity ?? 0);
  const displayPity5 = isLimited ? (effectivePity?.pity5 ?? stats.currentPity5 ?? 0) : (stats.currentPity5 ?? 0);

  return {
    normalizedType,
    isLimited,
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

  return new Map(
    (Array.isArray(pools) ? pools : []).map((pool) => {
      const poolHistory = historyByPoolId.get(pool.id) || [];
      const stats = {
        currentPity: calculatePity(poolHistory, 6),
        currentPity5: calculatePity(poolHistory, 5)
      };
      const normalizedType = normalizePoolType(pool?.type);

      return [
        pool.id,
        getPoolAnalysisPityState(
          pool,
          stats,
          normalizedType === 'limited'
            ? buildLimitedEffectivePityState(allLimitedHistory, pool.id)
            : null
        )
      ];
    })
  );
}

export default {
  getPoolAnalysisPityState,
  buildOverviewPoolAnalysisPityMap
};
