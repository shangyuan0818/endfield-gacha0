import { useMemo } from 'react';
import { useHistoryStore, usePoolStore } from '../../stores';
import { RARITY_CONFIG, LIMITED_POOL_RULES } from '../../constants';
import { calculateCurrentProbability, calculateInheritedPity } from '../../utils';

/**
 * 卡池统计 Hook
 * 处理统计计算逻辑：stats、groupedHistory、filteredGroupedHistory、effectivePity 等
 */
export function usePoolStats({ normalizedCurrentPoolHistory, currentPool }) {
  const manualPityLimit = useHistoryStore(state => state.manualPityLimit);
  const historyFilter = useHistoryStore(state => state.historyFilter);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const history = useHistoryStore(state => state.history);

  const poolsArray = Array.isArray(pools) ? pools : [];

  // 为当前卡池历史记录添加全局序号
  const currentPoolHistoryWithIndex = useMemo(() => {
    return [...normalizedCurrentPoolHistory]
      .sort((a, b) => a.id - b.id)
      .map((item, index) => ({ ...item, globalIndex: index + 1 }));
  }, [normalizedCurrentPoolHistory]);

  // 将历史记录按时间戳聚合，用于展示十连
  const groupedHistory = useMemo(() => {
    const groups = [];
    const sorted = [...currentPoolHistoryWithIndex].reverse();

    if (sorted.length === 0) return [];

    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
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

    return groups.map(g => g.reverse());
  }, [currentPoolHistoryWithIndex]);

  // 筛选后的历史记录
  const filteredGroupedHistory = useMemo(() => {
    if (historyFilter === 'all') return groupedHistory;

    const result = [];
    groupedHistory.forEach(group => {
      group.forEach(item => {
        const match =
          (historyFilter === '6star' && item.rarity === 6) ||
          (historyFilter === '5star' && item.rarity === 5) ||
          (historyFilter === 'gift' && item.specialType === 'gift');
        if (match) result.push([item]);
      });
    });
    return result;
  }, [groupedHistory, historyFilter]);

  // 主统计计算
  const stats = useMemo(() => {
    const validPullsList = normalizedCurrentPoolHistory.filter(item =>
      item.specialType !== 'gift' && item.isFree !== true
    );
    const total = validPullsList.length;

    const counts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    const giftCounts = { 6: 0 };

    let currentPity = 0;
    let currentPity5 = 0;

    // 计算当前6星保底
    for (let i = normalizedCurrentPoolHistory.length - 1; i >= 0; i--) {
      const item = normalizedCurrentPoolHistory[i];
      if (item.specialType === 'gift' || item.isFree === true) continue;

      if (item.rarity === 6) {
        break;
      }
      currentPity++;
    }

    // 计算当前5星保底
    for (let i = normalizedCurrentPoolHistory.length - 1; i >= 0; i--) {
      const item = normalizedCurrentPoolHistory[i];
      if (item.specialType === 'gift' || item.isFree === true) continue;

      if (item.rarity >= 5) {
        break;
      }
      currentPity5++;
    }

    // 统计各稀有度数量
    normalizedCurrentPoolHistory.forEach(pull => {
      let r = pull.rarity;

      if (pull.specialType === 'gift') {
        if (r === 6) giftCounts[6]++;
      }

      if (r === 6) {
        if (pull.isStandard) {
          counts['6_std']++;
        } else {
          counts[6]++;
        }
      } else {
        if (r < 4) r = 4;
        if (counts[r] !== undefined) counts[r]++;
      }
    });

    const totalSixStar = counts[6] + counts['6_std'];
    const validSixStar = totalSixStar - giftCounts[6];

    // 修正不歪率计算
    let realLimited = 0;
    let realStandard = 0;
    normalizedCurrentPoolHistory.forEach(pull => {
       if (pull.rarity === 6 && pull.specialType !== 'gift' && pull.isFree !== true) {
          if (pull.isStandard) realStandard++;
          else realLimited++;
       }
    });
    const realTotalSix = realLimited + realStandard;
    const winRate = realTotalSix > 0 ? (realLimited / realTotalSix * 100).toFixed(1) : 0;

    // 计算额外赠送机制
    let bonusGiftsLimited = 0;
    let bonusGiftsStandard = 0;

    if (currentPool.type === 'limited') {
      bonusGiftsLimited = Math.floor(total / 240);
    } else if (currentPool.type === 'weapon') {
      if (total >= 100) bonusGiftsStandard++;
      if (total >= 180) {
        bonusGiftsLimited++;
        const extraPulls = total - 180;
        const extraCycles = Math.floor(extraPulls / 80);
        bonusGiftsStandard += Math.ceil(extraCycles / 2);
        bonusGiftsLimited += Math.floor(extraCycles / 2);
      }
    } else if (currentPool.type === 'standard') {
      if (total >= 300) {
        bonusGiftsStandard++;
      }
    }

    counts[6] += bonusGiftsLimited;
    counts['6_std'] += bonusGiftsStandard;

    const displayTotalSixStar = totalSixStar + bonusGiftsLimited + bonusGiftsStandard;

    // 统计历史6星出货分布
    const sixStarPulls = [];
    const upSixStarPulls = [];
    let tempCounter = 0;

    validPullsList.forEach(pull => {
      tempCounter++;
      if (pull.rarity === 6) {
        const pullRecord = {
          count: tempCounter,
          isStandard: pull.isStandard,
          isGuaranteed: pull.specialType === 'guaranteed'
        };
        sixStarPulls.push(pullRecord);
        if (!pull.isStandard) {
          upSixStarPulls.push(pullRecord);
        }
        tempCounter = 0;
      }
    });

    const pullCounts = sixStarPulls.map(s => s.count);
    const maxPityRecorded = pullCounts.length > 0 ? Math.max(...pullCounts) : 0;
    const minPityRecorded = pullCounts.length > 0 ? Math.min(...pullCounts) : 0;
    const avgPityRecorded = pullCounts.length > 0
      ? (pullCounts.reduce((a, b) => a + b, 0) / pullCounts.length).toFixed(1)
      : 0;

    const avgAllSixStar = realTotalSix > 0 ? (total / realTotalSix).toFixed(2) : '0';
    const avgUpSixStar = upSixStarPulls.length > 0
      ? (upSixStarPulls.reduce((sum, p) => sum + p.count, 0) / upSixStarPulls.length).toFixed(2)
      : '0';

    const avgPullCost = {
      6: avgUpSixStar,
      '6_all': avgAllSixStar,
      5: counts[5] > 0 ? (total / counts[5]).toFixed(2) : '0',
    };

    // 饼图数据
    const rawChartData = [
      ...(currentPool.type !== 'standard' ? [{ name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color, originalValue: counts[6] }] : []),
      { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color, originalValue: counts['6_std'] },
      { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color, originalValue: counts[5] },
      { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color, originalValue: counts[4] },
    ].filter(item => item.value > 0);

    const chartData = rawChartData.map(item => {
      const totalValue = rawChartData.reduce((sum, d) => sum + d.value, 0);
      const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
      let minPercent = 0;
      if (item.name.includes('6星')) minPercent = 15;
      else if (item.name.includes('5星')) minPercent = 20;

      if (currentPercent < minPercent && totalValue > 0) {
        return { ...item, displayValue: Math.ceil(totalValue * minPercent / 100) };
      }
      return { ...item, displayValue: item.value };
    });

    // 出货分布直方图
    const distributionData = [];
    if (sixStarPulls.length > 0) {
      const maxRange = Math.ceil(Math.max(manualPityLimit, maxPityRecorded) / 10) * 10;
      for (let i = 0; i < maxRange; i += 10) {
        const rangeStart = i + 1;
        const rangeEnd = i + 10;
        const items = sixStarPulls.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
        distributionData.push({
          range: `${rangeStart}-${rangeEnd}`,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length,
          guaranteed: items.filter(p => p.isGuaranteed).length
        });
      }
    }

    const probabilityInfo = calculateCurrentProbability(currentPity, currentPool.type);

    const infoBookThreshold = LIMITED_POOL_RULES.infoBookThreshold;
    const hasInfoBook = currentPool.type === 'limited' && total >= infoBookThreshold;
    const pullsUntilInfoBook = currentPool.type === 'limited' && !hasInfoBook
      ? infoBookThreshold - total
      : 0;

    return {
      total,
      counts,
      totalSixStar,
      validSixStar,
      winRate,
      sixStarCount: realTotalSix,
      upSixStarCount: realLimited,
      stdSixStarCount: realStandard,
      currentPity,
      currentPity5,
      avgPullCost,
      chartData,
      pityStats: {
        history: sixStarPulls,
        max: maxPityRecorded,
        min: minPityRecorded,
        avg: avgPityRecorded,
        distribution: distributionData
      },
      probabilityInfo,
      hasInfoBook,
      pullsUntilInfoBook
    };
  }, [normalizedCurrentPoolHistory, manualPityLimit, currentPool.type]);

  // 跨池保底继承计算
  const inheritedPityInfo = useMemo(() => {
    if (!currentPool || currentPool.type !== 'limited') {
      return { inheritedPity: 0, inheritedPity5: 0, hasInheritedPity: false };
    }

    const allLimitedPools = poolsArray.filter(p => p.type === 'limited');

    if (normalizedCurrentPoolHistory.length > 0) {
      return { inheritedPity: 0, inheritedPity5: 0, hasInheritedPity: false };
    }

    const { inheritedPity, inheritedPity5 } = calculateInheritedPity(
      allLimitedPools,
      history,
      currentPoolId
    );

    return {
      inheritedPity,
      inheritedPity5,
      hasInheritedPity: inheritedPity > 0 || inheritedPity5 > 0
    };
  }, [currentPool?.type, poolsArray, normalizedCurrentPoolHistory.length, history, currentPoolId]);

  // 计算实际有效的保底数
  const effectivePity = useMemo(() => {
    if (normalizedCurrentPoolHistory.length > 0) {
      return {
        pity6: stats.currentPity,
        pity5: stats.currentPity5,
        isInherited: false
      };
    }
    return {
      pity6: inheritedPityInfo.inheritedPity,
      pity5: inheritedPityInfo.inheritedPity5,
      isInherited: inheritedPityInfo.hasInheritedPity
    };
  }, [normalizedCurrentPoolHistory.length, stats.currentPity, stats.currentPity5, inheritedPityInfo]);

  return {
    currentPoolHistoryWithIndex,
    groupedHistory,
    filteredGroupedHistory,
    stats,
    inheritedPityInfo,
    effectivePity
  };
}

export default usePoolStats;
