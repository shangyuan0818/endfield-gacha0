import { useMemo } from 'react';
import useHistoryStore from '../../stores/useHistoryStore.js';

/**
 * 当前卡池日志分组 Hook
 * 负责为当前卡池历史记录添加序号，并按时间聚合十连展示。
 */
export function useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory = []) {
  const historyFilter = useHistoryStore(state => state.historyFilter);

  const currentPoolHistoryWithIndex = useMemo(() => {
    return [...normalizedCurrentPoolHistory]
      .sort((a, b) => a.id - b.id)
      .map((item, index) => ({ ...item, globalIndex: index + 1 }));
  }, [normalizedCurrentPoolHistory]);

  const groupedHistory = useMemo(() => {
    const groups = [];
    const sorted = [...currentPoolHistoryWithIndex].reverse();

    if (sorted.length === 0) {
      return [];
    }

    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
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
