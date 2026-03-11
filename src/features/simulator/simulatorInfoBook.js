export function sortLimitedPoolsByStartTime(pools) {
  return (Array.isArray(pools) ? pools : [])
    .filter((pool) => pool.type === 'limited' || pool.type === 'limited_character')
    .sort((left, right) => {
      const leftTime = left.start_time ? new Date(left.start_time).getTime() : 0;
      const rightTime = right.start_time ? new Date(right.start_time).getTime() : 0;
      return leftTime - rightTime;
    });
}

export function getNextLimitedPoolId(limitedPools, sourcePoolId) {
  const sourceIndex = limitedPools.findIndex((pool) => pool.id === sourcePoolId);
  if (sourceIndex === -1 || sourceIndex + 1 >= limitedPools.length) {
    return null;
  }
  return limitedPools[sourceIndex + 1].id;
}

export function reconcileInfoBookState(infoBooks, limitedPools) {
  const normalized = {};

  Object.entries(infoBooks || {}).forEach(([sourcePoolId, book]) => {
    const targetPoolId = getNextLimitedPoolId(limitedPools, sourcePoolId);
    normalized[sourcePoolId] = {
      ...book,
      targetPoolId,
      activated: false
    };
  });

  const latestPending = Object.entries(normalized)
    .filter(([, book]) => !book.used && book.targetPoolId)
    .sort(([leftId], [rightId]) => {
      const leftIndex = limitedPools.findIndex((pool) => pool.id === leftId);
      const rightIndex = limitedPools.findIndex((pool) => pool.id === rightId);
      return rightIndex - leftIndex;
    })[0];

  if (latestPending) {
    const [sourcePoolId] = latestPending;
    normalized[sourcePoolId] = {
      ...normalized[sourcePoolId],
      activated: Boolean(infoBooks?.[sourcePoolId]?.activated)
    };
  }

  return normalized;
}

export function getLatestPendingInfoBook(infoBooks, limitedPools) {
  const reconciled = reconcileInfoBookState(infoBooks, limitedPools);
  const latestEntry = Object.entries(reconciled)
    .filter(([, book]) => !book.used && book.targetPoolId)
    .sort(([leftId], [rightId]) => {
      const leftIndex = limitedPools.findIndex((pool) => pool.id === leftId);
      const rightIndex = limitedPools.findIndex((pool) => pool.id === rightId);
      return rightIndex - leftIndex;
    })[0];

  if (!latestEntry) {
    return null;
  }

  const [sourcePoolId, book] = latestEntry;
  return {
    sourcePoolId,
    ...book
  };
}
