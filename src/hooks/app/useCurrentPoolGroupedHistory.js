import { useMemo } from 'react';
import useHistoryStore from '../../stores/useHistoryStore.js';
import {
  compareHistoryTimelineAsc,
  getHistoryTimelineTimestampMs,
} from '../../utils/historyTimelineSort.js';

function getHistorySeqId(item) {
  return parseInt(item?.seqId || item?.seq_id || '0', 10) || 0;
}

function getHistoryStableKey(item) {
  return String(item?.id || item?.record_id || '');
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
export function useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory = []) {
  const historyFilter = useHistoryStore(state => state.historyFilter);

  const currentPoolHistoryWithIndex = useMemo(() => {
    return buildCurrentPoolHistoryWithIndex(normalizedCurrentPoolHistory);
  }, [normalizedCurrentPoolHistory]);

  const groupedHistory = useMemo(() => {
    return buildGroupedHistory(currentPoolHistoryWithIndex);
  }, [currentPoolHistoryWithIndex]);

  const filteredGroupedHistory = useMemo(() => {
    if (historyFilter === 'all') {
      return groupedHistory;
    }

    const result = [];
    groupedHistory.forEach(group => {
      group.forEach(item => {
        const match =
          (historyFilter === '6star' && item.rarity === 6) ||
          (historyFilter === '5star' && item.rarity === 5) ||
          (historyFilter === 'gift' && (item.specialType === 'gift' || item.special_type === 'gift'));

        if (match) {
          result.push([item]);
        }
      });
    });

    return result;
  }, [groupedHistory, historyFilter]);

  return {
    groupedHistory,
    filteredGroupedHistory
  };
}

export default useCurrentPoolGroupedHistory;
