import { useMemo } from 'react';
import {
  compareHistoryTimelineAsc,
  getHistoryTimelineTimestampMs,
} from '../../utils/historyTimelineSort.js';
import {
  isFreeHistoryPull,
  isGiftHistoryPull,
  isInfoBookHistoryPull,
} from '../../utils/historyInfoBook.js';

const EMPTY_FILTERS = {};
const EMPTY_POOLS_ARRAY = [];

function getHistorySeqId(item) {
  return parseInt(item?.seqId || item?.seq_id || '0', 10) || 0;
}

function getHistoryStableKey(item) {
  return String(item?.id || item?.record_id || '');
}

function getHistoryPoolId(item) {
  return item?.poolId || item?.pool_id || null;
}

function normalizePoolType(type) {
  if (type === 'extra') return 'extra';
  if (type === 'limited' || type === 'limited_character') return 'limited';
  if (type === 'weapon' || type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'unknown';
}

function isGuaranteedHistoryPull(item) {
  return item?.specialType === 'guaranteed' || item?.special_type === 'guaranteed';
}

function getAcquisitionMethod(item) {
  if (isGiftHistoryPull(item)) return 'gift';
  if (isFreeHistoryPull(item)) return 'free';
  if (isInfoBookHistoryPull(item)) return 'infobook';
  if (isGuaranteedHistoryPull(item)) return 'guaranteed';
  return 'normal';
}

function getRecordKey(item) {
  return getHistoryStableKey(item) || `${getHistoryPoolId(item) || 'pool'}:${getHistorySeqId(item)}:${getHistoryTimelineTimestampMs(item)}`;
}

function getDateTimeFilterMs(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPoolTypeMap(poolsArray = []) {
  return new Map(
    poolsArray
      .map(pool => [pool?.id || pool?.pool_id, normalizePoolType(pool?.type)])
      .filter(([poolId]) => Boolean(poolId))
  );
}

function matchesRecordFilters(item, filters, poolTypeMap) {
  const rarityFilter = filters?.rarity || 'all';
  if (rarityFilter !== 'all' && Number(item?.rarity) !== Number(rarityFilter)) {
    return false;
  }

  const methodFilter = filters?.method || 'all';
  if (methodFilter !== 'all' && getAcquisitionMethod(item) !== methodFilter) {
    return false;
  }

  const poolTypeFilter = filters?.poolType || 'all';
  if (poolTypeFilter !== 'all') {
    const itemPoolType = poolTypeMap.get(getHistoryPoolId(item)) || normalizePoolType(item?.poolType || item?._poolType);
    if (itemPoolType !== poolTypeFilter) {
      return false;
    }
  }

  const timestamp = getHistoryTimelineTimestampMs(item);
  const fromMs = getDateTimeFilterMs(filters?.dateFrom);
  const toMs = getDateTimeFilterMs(filters?.dateTo);
  if (fromMs !== null && timestamp < fromMs) {
    return false;
  }
  if (toMs !== null && timestamp > toMs) {
    return false;
  }

  return true;
}

function getOriginalPullMode(item, groupSizeMap) {
  const groupSize = groupSizeMap.get(getRecordKey(item)) || 1;
  return groupSize > 1 ? 'batch' : 'single';
}

export function sortHistoryByTimelineAsc(left, right) {
  const timeDiff = compareHistoryTimelineAsc(left, right);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  const seqDiff = getHistorySeqId(left) - getHistorySeqId(right);
  if (seqDiff !== 0) {
    return seqDiff;
  }

  return getHistoryStableKey(left).localeCompare(getHistoryStableKey(right), 'zh-CN');
}

export function buildCurrentPoolHistoryWithIndex(normalizedCurrentPoolHistory = []) {
  return [...normalizedCurrentPoolHistory]
    .sort(sortHistoryByTimelineAsc)
    .map((item, index) => ({ ...item, globalIndex: index + 1 }));
}

export function buildGroupedHistory(currentPoolHistoryWithIndex = []) {
  const groups = [];
  const sorted = [...currentPoolHistoryWithIndex].reverse();

  if (sorted.length === 0) {
    return [];
  }

  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevTime = getHistoryTimelineTimestampMs(prev);
    const currTime = getHistoryTimelineTimestampMs(curr);
    const timeDiff = Math.abs(currTime - prevTime);

    if (timeDiff <= 2000) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }

  groups.push(currentGroup);

  return groups.map(group => group.reverse());
}

/**
 * 当前卡池日志分组 Hook
 * 负责为当前卡池历史记录添加序号，并按时间聚合十连展示。
 */
export function useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory = [], options = {}) {
  const filters = options?.filters || EMPTY_FILTERS;
  const poolsArray = Array.isArray(options?.poolsArray) ? options.poolsArray : EMPTY_POOLS_ARRAY;
  const currentPoolHistoryWithIndex = useMemo(() => {
    return buildCurrentPoolHistoryWithIndex(normalizedCurrentPoolHistory);
  }, [normalizedCurrentPoolHistory]);

  const groupedHistory = useMemo(() => {
    return buildGroupedHistory(currentPoolHistoryWithIndex);
  }, [currentPoolHistoryWithIndex]);

  const poolTypeMap = useMemo(() => buildPoolTypeMap(poolsArray), [poolsArray]);

  const groupSizeMap = useMemo(() => {
    const map = new Map();
    groupedHistory.forEach(group => {
      group.forEach(item => {
        map.set(getRecordKey(item), group.length);
      });
    });
    return map;
  }, [groupedHistory]);

  const filteredGroupedHistory = useMemo(() => {
    const hasRecordFilters = Boolean(
      (filters.rarity && filters.rarity !== 'all') ||
      (filters.method && filters.method !== 'all') ||
      (filters.poolType && filters.poolType !== 'all') ||
      filters.dateFrom ||
      filters.dateTo
    );

    const hasPullModeFilter = filters.pullMode && filters.pullMode !== 'all';

    if (!hasRecordFilters && !hasPullModeFilter) {
      return groupedHistory;
    }

    const recordFilteredHistory = currentPoolHistoryWithIndex.filter(item =>
      matchesRecordFilters(item, filters, poolTypeMap)
    );

    const recordFilteredGroups = buildGroupedHistory(recordFilteredHistory);

    if (!hasPullModeFilter) {
      return recordFilteredGroups;
    }

    return recordFilteredGroups.filter(group =>
      group.some(item => getOriginalPullMode(item, groupSizeMap) === filters.pullMode)
    );
  }, [currentPoolHistoryWithIndex, filters, groupedHistory, groupSizeMap, poolTypeMap]);

  return {
    groupedHistory,
    filteredGroupedHistory
  };
}

export default useCurrentPoolGroupedHistory;
