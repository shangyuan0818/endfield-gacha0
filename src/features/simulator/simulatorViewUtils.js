import { calculateCurrentProbability } from '../../utils/validators';
import { normalizeSimulatorPoolType } from './simulatorInheritance';

export function processHistoryGroups(history) {
  const groups = [];
  let currentTenPull = null;

  for (let index = 0; index < history.length; index += 1) {
    const record = history[index];

    if (record.isTenPull) {
      if (record.batchIndex === 0) {
        if (currentTenPull && currentTenPull.pulls.length > 0) {
          groups.push(currentTenPull);
        }

        currentTenPull = {
          type: 'tenPull',
          id: record.timestamp,
          pulls: [record],
          startPullNumber: record.pullNumber
        };
      } else if (currentTenPull) {
        currentTenPull.pulls.push(record);
      } else {
        currentTenPull = {
          type: 'tenPull',
          id: record.timestamp,
          pulls: [record],
          startPullNumber: record.pullNumber
        };
      }
    } else {
      if (currentTenPull && currentTenPull.pulls.length > 0) {
        groups.push(currentTenPull);
        currentTenPull = null;
      }

      groups.push({
        type: 'single',
        ...record
      });
    }
  }

  if (currentTenPull && currentTenPull.pulls.length > 0) {
    groups.push(currentTenPull);
  }

  return groups.reverse();
}

export function buildDashboardStats(stats, pityInfo, simulator) {
  const normalizedPoolType = normalizeSimulatorPoolType(simulator.poolType);

  return {
    total: stats.totalPulls,
    currentPity: pityInfo.sixStar.current,
    currentPity5: pityInfo.fiveStar.current,
    counts: {
      6: normalizedPoolType === 'weapon' && stats.gifts
        ? stats.sixStarCount + (stats.gifts.limitedCount || 0)
        : stats.sixStarCount,
      '6_std': normalizedPoolType === 'weapon' && stats.gifts
        ? (stats.gifts.standardCount || 0)
        : 0,
      5: stats.fiveStarCount,
      4: Math.max(0, stats.totalPulls - stats.sixStarCount - stats.fiveStarCount)
    },
    winRate: stats.upRate || '0.00',
    upSixStarCount: stats.upSixStarCount || 0,
    sixStarCount: stats.sixStarCount || 0,
    avgPullCost: {
      6: stats.avgPullsPerSixStar === '-' ? 0 : parseFloat(stats.avgPullsPerSixStar) || 0,
      5: stats.fiveStarRate && parseFloat(stats.fiveStarRate) > 0
        ? (100 / parseFloat(stats.fiveStarRate)).toFixed(2)
        : 0
    },
    chartData: [
      { name: '6星', value: stats.sixStarCount, color: '#FFFA00' },
      { name: '5星', value: stats.fiveStarCount, color: '#F59E0B' },
      { name: '4星及以下', value: Math.max(0, stats.totalPulls - stats.sixStarCount - stats.fiveStarCount), color: '#A855F7' }
    ],
    pityStats: {
      history: stats.sixStarHistory.map((item, index) => ({
        ...item,
        index: index + 1,
        isStandard: !item.isUp && simulator.poolType !== 'standard',
        count: item.pityWhenPulled || 1
      })),
      distribution: (() => {
        const isWeapon = normalizedPoolType === 'weapon';
        const ranges = isWeapon
          ? [
              { range: '1-5', min: 1, max: 5, limited: 0, standard: 0 },
              { range: '6-10', min: 6, max: 10, limited: 0, standard: 0 },
              { range: '11-15', min: 11, max: 15, limited: 0, standard: 0 },
              { range: '16-20', min: 16, max: 20, limited: 0, standard: 0 },
              { range: '21-25', min: 21, max: 25, limited: 0, standard: 0 },
              { range: '26-30', min: 26, max: 30, limited: 0, standard: 0 },
              { range: '31-35', min: 31, max: 35, limited: 0, standard: 0 },
              { range: '36-40', min: 36, max: 40, limited: 0, standard: 0 }
            ]
          : [
              { range: '1-10', min: 1, max: 10, limited: 0, standard: 0 },
              { range: '11-20', min: 11, max: 20, limited: 0, standard: 0 },
              { range: '21-30', min: 21, max: 30, limited: 0, standard: 0 },
              { range: '31-40', min: 31, max: 40, limited: 0, standard: 0 },
              { range: '41-50', min: 41, max: 50, limited: 0, standard: 0 },
              { range: '51-60', min: 51, max: 60, limited: 0, standard: 0 },
              { range: '61-70', min: 61, max: 70, limited: 0, standard: 0 },
              { range: '71-80', min: 71, max: 80, limited: 0, standard: 0 },
              { range: '81-90', min: 81, max: 90, limited: 0, standard: 0 }
            ];

        stats.sixStarHistory.forEach((item) => {
          const pity = item.pityWhenPulled || 0;
          const rangeItem = ranges.find((range) => pity >= range.min && pity <= range.max);
          if (!rangeItem) {
            return;
          }

          if (item.isUp) {
            rangeItem.limited += 1;
          } else {
            rangeItem.standard += 1;
          }
        });

        return ranges.map((range) => ({
          range: range.range,
          limited: range.limited,
          standard: range.standard
        }));
      })()
    },
    probabilityInfo: calculateCurrentProbability(pityInfo.sixStar.current, normalizedPoolType),
    hasInfoBook: stats.hasReceivedInfoBook,
    pullsUntilInfoBook: normalizedPoolType === 'limited' && !stats.hasReceivedInfoBook
      ? Math.max(0, 60 - stats.totalPulls)
      : 0,
    freeTenPulls: {
      ...stats.freeTenPulls,
      received: simulator.getState().freeTenPullsReceived
    },
    gifts: stats.gifts
  };
}

export function buildPityInfoWithGuarantee(stats, simulator) {
  const normalizedPoolType = normalizeSimulatorPoolType(simulator.poolType);

  if (normalizedPoolType === 'limited') {
    let cumulativePulls = 0;
    let hasReceivedLimitedInFirst120 = false;

    for (const item of stats.sixStarHistory) {
      if (item.isFreePull) {
        continue;
      }

      cumulativePulls += item.pityWhenPulled || 1;
      if (cumulativePulls <= 120 && item.isUp) {
        hasReceivedLimitedInFirst120 = true;
        break;
      }
      if (cumulativePulls > 120) {
        break;
      }
    }

    return {
      guaranteedUp: {
        current: Math.min(stats.totalPulls, 120),
        hasReceived: hasReceivedLimitedInFirst120
      }
    };
  }

  if (normalizedPoolType === 'weapon') {
    let cumulativePulls = 0;
    let hasReceivedLimitedInFirst80 = false;

    for (const item of stats.sixStarHistory) {
      cumulativePulls += item.pityWhenPulled || 1;
      if (cumulativePulls <= 80 && item.isUp) {
        hasReceivedLimitedInFirst80 = true;
        break;
      }
      if (cumulativePulls > 80) {
        break;
      }
    }

    return {
      guaranteedUp: {
        current: Math.min(stats.totalPulls, 80),
        hasReceived: hasReceivedLimitedInFirst80
      }
    };
  }

  return {};
}
