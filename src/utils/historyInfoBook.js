function getHistoryPoolId(item) {
  return item?.poolId || item?.pool_id || null;
}

function getHistorySeqId(item) {
  return parseInt(item?.seqId || item?.seq_id || '0', 10) || 0;
}

function getHistoryTimestamp(item) {
  if (typeof item?.timestamp === 'number') {
    return item.timestamp;
  }

  const parsed = new Date(item?.timestamp || item?.gacha_time || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortByTimeline(left, right) {
  const timeDiff = getHistoryTimestamp(left) - getHistoryTimestamp(right);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return getHistorySeqId(left) - getHistorySeqId(right);
}

function normalizePoolType(pool) {
  const type = pool?.type;
  if (type === 'extra') return 'extra';
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
}

export function isGiftHistoryPull(item) {
  return item?.specialType === 'gift' || item?.special_type === 'gift';
}

export function isFreeHistoryPull(item) {
  return item?.isFree === true
    || item?.is_free === true
    || item?.isFreePull === true
    || item?.is_free_pull === true;
}

export function isInfoBookHistoryPull(item) {
  return item?.isInfoBook === true || item?.is_info_book === true;
}

function isPaidHistoryPull(item) {
  return !isGiftHistoryPull(item) && !isFreeHistoryPull(item);
}

export function annotateInfoBookPulls(history = [], pools = []) {
  if (!Array.isArray(history) || history.length === 0 || !Array.isArray(pools) || pools.length === 0) {
    return Array.isArray(history) ? history : [];
  }

  const limitedPools = pools
    .filter(pool => normalizePoolType(pool) === 'limited')
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left?.start_time || left?.created_at || 0).getTime() || 0;
      const rightTime = new Date(right?.start_time || right?.created_at || 0).getTime() || 0;
      return leftTime - rightTime;
    });

  if (limitedPools.length < 2) {
    return history;
  }

  const nextPoolById = new Map();
  for (let index = 0; index < limitedPools.length - 1; index += 1) {
    nextPoolById.set(limitedPools[index].id, limitedPools[index + 1].id);
  }

  const paidPullsByPool = new Map();
  history.forEach(item => {
    const poolId = getHistoryPoolId(item);
    if (!poolId || !isPaidHistoryPull(item)) {
      return;
    }

    if (!paidPullsByPool.has(poolId)) {
      paidPullsByPool.set(poolId, []);
    }
    paidPullsByPool.get(poolId).push(item);
  });

  const infoBookCreditsByPool = new Map();
  limitedPools.forEach(pool => {
    const paidPulls = paidPullsByPool.get(pool.id) || [];
    const nextPoolId = nextPoolById.get(pool.id);
    if (!nextPoolId || paidPulls.length < 60) {
      return;
    }

    infoBookCreditsByPool.set(nextPoolId, (infoBookCreditsByPool.get(nextPoolId) || 0) + 10);
  });

  if (infoBookCreditsByPool.size === 0) {
    return history;
  }

  const infoBookRecordKeys = new Set();
  infoBookCreditsByPool.forEach((creditCount, poolId) => {
    const paidPulls = (paidPullsByPool.get(poolId) || []).slice().sort(sortByTimeline);
    paidPulls.slice(0, creditCount).forEach(item => {
      const key = item?.id || item?.record_id || `${getHistoryPoolId(item)}:${getHistorySeqId(item)}:${getHistoryTimestamp(item)}`;
      infoBookRecordKeys.add(key);
    });
  });

  if (infoBookRecordKeys.size === 0) {
    return history;
  }

  return history.map(item => {
    const key = item?.id || item?.record_id || `${getHistoryPoolId(item)}:${getHistorySeqId(item)}:${getHistoryTimestamp(item)}`;
    if (!infoBookRecordKeys.has(key)) {
      return item;
    }

    return {
      ...item,
      isInfoBook: true,
      is_info_book: true
    };
  });
}

export default {
  annotateInfoBookPulls,
  isGiftHistoryPull,
  isFreeHistoryPull,
  isInfoBookHistoryPull
};
