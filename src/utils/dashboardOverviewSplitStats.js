import { RARITY_CONFIG } from '../constants/index.js';
import { isInfoBookHistoryPull } from './historyInfoBook.js';
import { buildResourceSummaryFromAggregates } from './resourceEconomy.js';

function normalizePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
}

function getBucketFromPoolType(type) {
  return normalizePoolType(type) === 'weapon' ? 'weapon' : 'character';
}

function createBucketAccumulator() {
  return {
    total: 0,
    chargedPulls: 0,
    counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
    totalSixStar: 0,
    winRate: '0.0',
    avgPullCost: {
      6: '0',
      '6_all': '0',
      '6_limited': '0',
      '6_with_spark': '0',
      5: '0'
    },
    chartData: [],
    pityStats: {
      history: [],
      distribution: [],
      max: 0,
      min: 0,
      avg: 0
    },
    resourceSummary: null
  };
}

function toChartData(counts, includeTargetSix) {
  const rawChartData = [
    ...(includeTargetSix ? [{ name: '6星(目标)', value: counts[6], color: RARITY_CONFIG[6].color }] : []),
    { name: '6星(常驻/偏移)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
    { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
    { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color }
  ].filter((item) => item.value > 0);

  return rawChartData.map((item) => {
    const totalValue = rawChartData.reduce((sum, entry) => sum + entry.value, 0);
    const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    let minPercent = 0;

    if (item.name.includes('6星')) {
      minPercent = 15;
    } else if (item.name.includes('5星')) {
      minPercent = 20;
    }

    if (currentPercent < minPercent && totalValue > 0) {
      return {
        ...item,
        displayValue: Math.ceil((totalValue * minPercent) / 100)
      };
    }

    return { ...item, displayValue: item.value };
  });
}

function buildDistributionData(sixStarPulls) {
  if (!sixStarPulls.length) {
    return [];
  }

  const maxRecorded = Math.max(...sixStarPulls.map((entry) => entry.count));
  const maxRange = Math.ceil(maxRecorded / 10) * 10;
  const distribution = [];

  for (let i = 0; i < maxRange; i += 10) {
    const rangeStart = i + 1;
    const rangeEnd = i + 10;
    const items = sixStarPulls.filter((entry) => entry.count >= rangeStart && entry.count <= rangeEnd);
    distribution.push({
      range: `${rangeStart}-${rangeEnd}`,
      count: items.length,
      limited: items.filter((entry) => !entry.isStandard).length,
      standard: items.filter((entry) => entry.isStandard).length
    });
  }

  return distribution;
}

export function buildDashboardOverviewSplitStats({
  history = [],
  selectedPools = []
} = {}) {
  const poolTypeById = new Map(
    selectedPools.map((pool) => [pool.id, normalizePoolType(pool.type)])
  );

  const buckets = {
    character: {
      ...createBucketAccumulator(),
      label: '角色池汇总',
      poolType: 'limited',
      _allSixStarPulls: [],
      _upCount: 0,
      _tempCounter: 0,
      _characterPulls: 0,
      _weaponPulls: 0,
      _chargedCharacterPulls: 0,
      _chargedWeaponPulls: 0,
      _arsenalGainCounts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }
    },
    weapon: {
      ...createBucketAccumulator(),
      label: '武器池汇总',
      poolType: 'weapon',
      _allSixStarPulls: [],
      _upCount: 0,
      _tempCounter: 0,
      _characterPulls: 0,
      _weaponPulls: 0,
      _chargedCharacterPulls: 0,
      _chargedWeaponPulls: 0,
      _arsenalGainCounts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }
    }
  };

  history.forEach((item) => {
    const isGift = item?.specialType === 'gift' || item?.special_type === 'gift';
    const isFree = item?.isFree === true || item?.is_free === true;
    const poolId = item?.poolId || item?.pool_id || null;
    const poolType = poolTypeById.get(poolId) || normalizePoolType(item?.poolType || item?.pool_type);
    const bucketKey = getBucketFromPoolType(poolType);
    const bucket = buckets[bucketKey];

    if (isGift || isFree) {
      return;
    }

    bucket.total += 1;
    bucket._tempCounter += 1;

    if (bucketKey === 'weapon') {
      bucket._weaponPulls += 1;
      if (!isInfoBookHistoryPull(item)) {
        bucket._chargedWeaponPulls += 1;
      }
    } else {
      bucket._characterPulls += 1;
      if (!isInfoBookHistoryPull(item)) {
        bucket._chargedCharacterPulls += 1;
      }
    }

    const rarity = Number(item?.rarity) || 0;

    if (rarity >= 6) {
      const isTargetSixStar = bucketKey === 'weapon'
        ? !item?.isStandard
        : poolType === 'limited' && !item?.isStandard;

      if (isTargetSixStar) {
        bucket.counts[6] += 1;
      } else {
        bucket.counts['6_std'] += 1;
      }

      if (bucketKey === 'character') {
        bucket._arsenalGainCounts[isTargetSixStar ? 6 : '6_std'] += 1;
      }

      const pullRecord = {
        count: bucket._tempCounter,
        isStandard: !isTargetSixStar
      };

      bucket._allSixStarPulls.push(pullRecord);
      if (isTargetSixStar) {
        bucket._upCount += 1;
      }

      bucket._tempCounter = 0;
      return;
    }

    const normalizedRarity = rarity === 5 ? 5 : 4;
    bucket.counts[normalizedRarity] += 1;
    if (bucketKey === 'character') {
      bucket._arsenalGainCounts[normalizedRarity] += 1;
    }
  });

  Object.values(buckets).forEach((bucket) => {
    bucket.totalSixStar = bucket.counts[6] + bucket.counts['6_std'];
    bucket.winRate = bucket.totalSixStar > 0
      ? ((bucket.counts[6] / bucket.totalSixStar) * 100).toFixed(1)
      : '0.0';

    const avgFiveStar = bucket.counts[5] > 0 ? (bucket.total / bucket.counts[5]).toFixed(2) : '0';
    const avgAllSixStar = bucket.totalSixStar > 0 ? (bucket.total / bucket.totalSixStar).toFixed(2) : '0';
    const avgTargetSixStar = bucket._upCount > 0 ? (bucket.total / bucket._upCount).toFixed(2) : '0';

    bucket.avgPullCost = {
      6: avgTargetSixStar,
      '6_all': avgAllSixStar,
      '6_limited': avgTargetSixStar,
      '6_with_spark': avgTargetSixStar,
      5: avgFiveStar
    };

    bucket.chartData = toChartData(bucket.counts, true);

    const pullCounts = bucket._allSixStarPulls.map((entry) => entry.count);
    bucket.pityStats = {
      history: bucket._allSixStarPulls,
      distribution: buildDistributionData(bucket._allSixStarPulls),
      max: pullCounts.length > 0 ? Math.max(...pullCounts) : 0,
      min: pullCounts.length > 0 ? Math.min(...pullCounts) : 0,
      avg: pullCounts.length > 0
        ? (pullCounts.reduce((sum, item) => sum + item, 0) / pullCounts.length).toFixed(1)
        : 0
    };

    bucket.resourceSummary = buildResourceSummaryFromAggregates({
      characterPulls: bucket._characterPulls,
      weaponPulls: bucket._weaponPulls,
      chargedCharacterPulls: bucket._chargedCharacterPulls,
      chargedWeaponPulls: bucket._chargedWeaponPulls,
      counts: bucket.counts,
      arsenalGainCounts: bucket._arsenalGainCounts
    });

    delete bucket._allSixStarPulls;
    delete bucket._upCount;
    delete bucket._tempCounter;
    delete bucket._characterPulls;
    delete bucket._weaponPulls;
    delete bucket._chargedCharacterPulls;
    delete bucket._chargedWeaponPulls;
    delete bucket._arsenalGainCounts;
  });

  return buckets;
}

export default buildDashboardOverviewSplitStats;
