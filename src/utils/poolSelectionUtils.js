import { DEFAULT_POOL_ID } from '../constants';

const LIMITED_POOL_TYPES = new Set(['limited', 'limited_character']);

function normalizeDateInput(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isTimedLimitedPool(pool) {
  return (
    pool &&
    LIMITED_POOL_TYPES.has(pool.type) &&
    normalizeDateInput(pool.start_time) &&
    normalizeDateInput(pool.end_time)
  );
}

function sortByStartTimeAsc(left, right) {
  return normalizeDateInput(left.start_time).getTime() - normalizeDateInput(right.start_time).getTime();
}

export function getPreferredPool(pools, options = {}) {
  const poolsArray = Array.isArray(pools) ? pools : [];
  if (poolsArray.length === 0) {
    return null;
  }

  const {
    preferredPoolId = null,
    includeDefaultPool = true,
    referenceDate = new Date()
  } = options;

  if (preferredPoolId) {
    const exactPool = poolsArray.find((pool) => pool.id === preferredPoolId);
    if (exactPool) {
      return exactPool;
    }
  }

  const now = normalizeDateInput(referenceDate) || new Date();
  const timedLimitedPools = poolsArray.filter(isTimedLimitedPool).sort(sortByStartTimeAsc);

  const activeLimitedPool = timedLimitedPools.find((pool) => {
    const start = normalizeDateInput(pool.start_time);
    const end = normalizeDateInput(pool.end_time);
    return start && end && now >= start && now < end;
  });
  if (activeLimitedPool) {
    return activeLimitedPool;
  }

  const upcomingLimitedPool = timedLimitedPools.find((pool) => {
    const start = normalizeDateInput(pool.start_time);
    return start && now < start;
  });
  if (upcomingLimitedPool) {
    return upcomingLimitedPool;
  }

  if (includeDefaultPool) {
    const defaultPool = poolsArray.find((pool) => pool.id === DEFAULT_POOL_ID);
    if (defaultPool) {
      return defaultPool;
    }
  }

  return poolsArray[0] || null;
}

export function getPreferredPoolId(pools, options = {}) {
  return getPreferredPool(pools, options)?.id || null;
}

export default {
  getPreferredPool,
  getPreferredPoolId
};
