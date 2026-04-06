import { GROUP_TYPE_LABELS, POOL_GROUP_PREFIX } from '../stores/usePoolStore.js';

const TYPE_ORDER = ['limited', 'standard', 'weapon_limited', 'weapon_standard', 'beginner'];

function normalizeDateInput(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizePoolGroupType(pool) {
  let type = pool?.type || 'standard';
  if (type === 'limited_character') type = 'limited';

  if (type === 'limited_weapon' || type === 'weapon') {
    return pool?.isLimitedWeapon === false ? 'weapon_standard' : 'weapon_limited';
  }

  if (type === 'limited') return 'limited';
  if (type === 'beginner') return 'beginner';
  return 'standard';
}

export function getPoolTypeLabel(groupType) {
  return GROUP_TYPE_LABELS[groupType] || '其他';
}

export function getPoolGroupId(groupType) {
  return `${POOL_GROUP_PREFIX}${groupType}`;
}

export function getPoolTimingMeta(pool, referenceDate = new Date()) {
  const now = normalizeDateInput(referenceDate) || new Date();
  const start = normalizeDateInput(pool?.start_time);
  const end = normalizeDateInput(pool?.end_time);

  if (!start || !end) {
    return {
      isTimed: false,
      isActive: false,
      isUpcoming: false,
      isExpired: false,
      remainingLabel: '',
      orderBucket: 3,
      orderTime: 0
    };
  }

  const isActive = now >= start && now < end;
  const isUpcoming = now < start;
  const isExpired = now >= end;
  const remainingMs = isActive ? Math.max(end.getTime() - now.getTime(), 0) : 0;
  const startsInMs = isUpcoming ? Math.max(start.getTime() - now.getTime(), 0) : 0;

  const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const startsInDays = Math.floor(startsInMs / (1000 * 60 * 60 * 24));
  const startsInHours = Math.floor((startsInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return {
    isTimed: true,
    isActive,
    isUpcoming,
    isExpired,
    start,
    end,
    remainingDays,
    remainingHours,
    startsInDays,
    startsInHours,
    remainingLabel: isActive
      ? `剩 ${remainingDays}天${remainingHours}小时`
      : isUpcoming
        ? `${startsInDays}天${startsInHours}小时后开启`
        : '已结束',
    orderBucket: isActive ? 0 : isUpcoming ? 1 : 2,
    orderTime: isActive || isUpcoming ? start.getTime() : -start.getTime()
  };
}

function matchesQuery(pool, query) {
  if (!query) return true;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystacks = [
    pool?.name,
    pool?.up_character,
    pool?.upCharacter
  ];
  return haystacks.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
}

function sortPoolsForDisplay(pools, referenceDate) {
  return [...pools]
    .map((pool) => ({
      pool,
      timing: getPoolTimingMeta(pool, referenceDate)
    }))
    .sort((left, right) => {
      if (left.timing.orderBucket !== right.timing.orderBucket) {
        return left.timing.orderBucket - right.timing.orderBucket;
      }

      if (left.timing.orderTime !== right.timing.orderTime) {
        return left.timing.orderTime - right.timing.orderTime;
      }

      const leftCreated = normalizeDateInput(left.pool?.created_at)?.getTime() || 0;
      const rightCreated = normalizeDateInput(right.pool?.created_at)?.getTime() || 0;
      if (leftCreated !== rightCreated) {
        return rightCreated - leftCreated;
      }

      return String(left.pool?.name || '').localeCompare(String(right.pool?.name || ''), 'zh-Hans-CN');
    })
    .map(({ pool, timing }) => ({
      ...pool,
      selectorTiming: timing
    }));
}

export function buildPoolSelectorGroups({
  pools,
  poolPullCounts = {},
  searchQuery = '',
  referenceDate = new Date()
}) {
  const filteredPools = (Array.isArray(pools) ? pools : []).filter((pool) => matchesQuery(pool, searchQuery));
  const grouped = {
    limited: [],
    standard: [],
    weapon_limited: [],
    weapon_standard: [],
    beginner: []
  };

  filteredPools.forEach((pool) => {
    const groupType = normalizePoolGroupType(pool);
    if (!grouped[groupType]) {
      grouped.standard.push(pool);
      return;
    }
    grouped[groupType].push(pool);
  });

  return TYPE_ORDER
    .map((groupType) => {
      const orderedPools = sortPoolsForDisplay(grouped[groupType], referenceDate).map((pool) => ({
        ...pool,
        pullCount: poolPullCounts[pool.id] || 0
      }));
      if (orderedPools.length === 0) {
        return null;
      }

      return {
        type: groupType,
        label: getPoolTypeLabel(groupType),
        groupId: getPoolGroupId(groupType),
        totalPulls: orderedPools.reduce((sum, pool) => sum + (pool.pullCount || 0), 0),
        disableCollapse: Boolean(searchQuery?.trim()),
        pools: orderedPools
      };
    })
    .filter(Boolean);
}

export function getSelectorVisiblePools({
  pools,
  currentPoolId = null,
  expanded = false,
  limit = 5
}) {
  if (!Array.isArray(pools) || pools.length <= limit || expanded) {
    return {
      visiblePools: pools || [],
      hiddenPools: [],
      autoExpanded: false
    };
  }

  const selectedIndex = pools.findIndex((pool) => pool.id === currentPoolId);
  const autoExpanded = selectedIndex >= limit;
  return {
    visiblePools: autoExpanded ? pools : pools.slice(0, limit),
    hiddenPools: autoExpanded ? [] : pools.slice(limit),
    autoExpanded
  };
}
