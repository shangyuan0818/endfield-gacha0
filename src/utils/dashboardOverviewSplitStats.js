import { RARITY_CONFIG, LIMITED_POOL_RULES, WEAPON_POOL_RULES } from '../constants/index.js';
import { STANDARD_SIX_STAR_CHARACTERS } from '../constants/characterPools.js';
import { isInfoBookHistoryPull } from './historyInfoBook.js';
import { buildResourceSummaryFromAggregates } from './resourceEconomy.js';
import { buildQuotaLedgerFromHistory } from './quotaEconomy.js';
import { resolveCharacterRecordByName } from './characterUtils.js';

const CHAR_PITY_LIMIT = LIMITED_POOL_RULES.sixStarPity;
const WEAPON_PITY_LIMIT = WEAPON_POOL_RULES.sixStarPity;

function normalizePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
}

function getBucketFromPoolType(type) {
  return normalizePoolType(type) === 'weapon' ? 'weapon' : 'character';
}

function isTargetCapablePool(type) {
  const normalizedType = normalizePoolType(type);
  return normalizedType === 'limited' || normalizedType === 'extra' || normalizedType === 'weapon';
}

function isLimitedCharacterPool(type) {
  const normalizedType = normalizePoolType(type);
  return normalizedType === 'limited' || normalizedType === 'extra';
}

/**
 * 辉光庆典(extra)池: 按常驻名单排除法判断是否为目标限定
 * gui.cpp 标准: 池内4个六星均匀分布, 常驻名单中的不是UP
 */
function isExtraPoolTarget(item) {
  const name = item?.character_name || item?.item_name || item?.name || '';
  if (!name) return false;
  try {
    const standardSet = new Set([...STANDARD_SIX_STAR_CHARACTERS]);
    return !standardSet.has(name);
  } catch {
    // 常驻名单不可用时降级: 全部视为目标 (保守行为)
    return true;
  }
}

function isTargetSixStarPull(item, poolType) {
  if (!isTargetCapablePool(poolType)) return false;
  if (normalizePoolType(poolType) === 'extra') {
    return isExtraPoolTarget(item);
  }
  return !item?.isStandard;
}

function readExplicitLimitedFlag(item) {
  const value = item?.item_is_limited
    ?? item?.itemIsLimited
    ?? item?.character_is_limited
    ?? item?.characterIsLimited
    ?? item?.char_is_limited
    ?? item?.charIsLimited
    ?? item?.is_limited
    ?? item?.metadata?.item_is_limited
    ?? item?.metadata?.character_is_limited
    ?? null;

  return typeof value === 'boolean' ? value : null;
}

function getHistoryItemLookupValues(item) {
  return [
    item?.character_id,
    item?.characterId,
    item?.item_id,
    item?.itemId,
    item?.character_name,
    item?.characterName,
    item?.item_name,
    item?.itemName,
    item?.name
  ]
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean);
}

function isLimitedCharacterOffrate(item) {
  const explicitFlag = readExplicitLimitedFlag(item);
  if (explicitFlag !== null) {
    return explicitFlag;
  }

  const lookupValues = getHistoryItemLookupValues(item);
  for (const value of lookupValues) {
    const itemInfo = resolveCharacterRecordByName(value, { fuzzy: true });
    if (itemInfo) {
      return itemInfo.type !== 'weapon' && itemInfo.is_limited === true;
    }
  }

  return false;
}

function createBucketAccumulator() {
  return {
    total: 0,
    chargedPulls: 0,
    counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
    totalSixStar: 0,
    winRate: '0.0',
    avgPullCost: { 6: '0', '6_all': '0', '6_limited': '0', '6_with_spark': '0', 5: '0' },
    chartData: [],
    pityStats: { history: [], distribution: [], max: 0, min: 0, avg: 0 },
    resourceSummary: null
  };
}

function toChartData(counts, includeTargetSix) {
  const rawChartData = [
    ...(includeTargetSix ? [{ name: '6星(目标)', kind: 'target-six', value: counts[6], color: RARITY_CONFIG[6].color }] : []),
    { name: '6星(常驻/偏移)', kind: 'offrate-six', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
    { name: '5星', kind: 'five-star', value: counts[5], color: RARITY_CONFIG[5].color },
    { name: '4星', kind: 'four-star', value: counts[4], color: RARITY_CONFIG[4].color }
  ].filter((item) => item.value > 0);

  return rawChartData.map((item) => {
    const totalValue = rawChartData.reduce((sum, entry) => sum + entry.value, 0);
    const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    let minPercent = 0;
    if (item.name.includes('6星')) minPercent = 15;
    else if (item.name.includes('5星')) minPercent = 20;

    if (currentPercent < minPercent && totalValue > 0) {
      return { ...item, displayValue: Math.ceil((totalValue * minPercent) / 100) };
    }
    return { ...item, displayValue: item.value };
  });
}

function buildDistributionData(sixStarPulls, hardPityLimit) {
  const numBuckets = Math.ceil(hardPityLimit / 10);
  const distribution = [];

  for (let i = 0; i < numBuckets; i++) {
    const rangeStart = i * 10 + 1;
    const rangeEnd = (i + 1) * 10;
    const isLast = i === numBuckets - 1;
    const items = sixStarPulls.filter((e) =>
      isLast ? e.count >= rangeStart : e.count >= rangeStart && e.count <= rangeEnd
    );
    distribution.push({
      range: `${rangeStart}-${rangeEnd}`,
      count: items.length,
      limited: items.filter((e) => !e.isStandard).length,
      standard: items.filter((e) => e.isStandard).length
    });
  }

  return distribution;
}

export function buildDashboardOverviewSplitStats({
  history = [],
  selectedPools = [],
  includeFreePullsInStats = false
} = {}) {
  const poolTypeById = new Map(
    selectedPools.flatMap((pool) => (
      [pool?.id, pool?.pool_id].map((poolId) => [poolId, normalizePoolType(pool?.type)])
    )).filter(([poolId]) => Boolean(poolId))
  );

  const buckets = {
    character: {
      ...createBucketAccumulator(),
      label: '角色池汇总',
      poolType: 'limited',
      _allSixStarPulls: [],
      _upCount: 0,
      _limitedSixCount: 0,
      _targetScopePulls: 0,
      _limitedScopePulls: 0,
      _characterPulls: 0,
      _weaponPulls: 0,
      _chargedCharacterPulls: 0,
      _chargedWeaponPulls: 0,
      _arsenalGainCounts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
      _quotaHistory: []
    },
    weapon: {
      ...createBucketAccumulator(),
      label: '武器池汇总',
      poolType: 'weapon',
      _allSixStarPulls: [],
      _upCount: 0,
      _limitedSixCount: 0,
      _targetScopePulls: 0,
      _limitedScopePulls: 0,
      _characterPulls: 0,
      _weaponPulls: 0,
      _chargedCharacterPulls: 0,
      _chargedWeaponPulls: 0,
      _arsenalGainCounts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
      _quotaHistory: []
    }
  };

  // 按池分组
  const pullsByPool = {};
  history.forEach((item) => {
    const poolId = item?.poolId || item?.pool_id || '__unknown__';
    if (!pullsByPool[poolId]) pullsByPool[poolId] = [];
    pullsByPool[poolId].push(item);
  });

  // 跨池保底继承: 特许角色池(limited)六星小保底跨期共享 (gui.cpp 标准)
  const bucketTempCounters = { character: 0, weapon: 0 };
  let lastCharacterPoolType = null;

  for (const [poolId, pulls] of Object.entries(pullsByPool)) {
    const sortedPulls = pulls.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
    const firstItem = sortedPulls[0];
    const poolType = poolTypeById.get(poolId)
      || normalizePoolType(firstItem?.poolType || firstItem?.pool_type);
    const bucketKey = getBucketFromPoolType(poolType);
    const bucket = buckets[bucketKey];

    // 特许池跨期继承; 其他池型切换时重置
    if (bucketKey === 'character') {
      if (poolType !== 'limited' || lastCharacterPoolType !== 'limited') {
        bucketTempCounters.character = 0;
      }
      lastCharacterPoolType = poolType;
    }

    let tempCounter = bucketTempCounters[bucketKey];

    sortedPulls.forEach((item) => {
      const isGift = item?.specialType === 'gift' || item?.special_type === 'gift';
      const isFree = item?.isFree === true || item?.is_free === true;
      if (isGift) return;

      bucket._quotaHistory.push(item);

      const rarity = Number(item?.rarity) || 0;

      // 免费十连: 不推进 tempCounter, 六星固定归 slot=30 (gui.cpp)
      if (isFree) {
        // 免费十连的六星/五星出货始终计入 counts
        if (rarity >= 6) {
          const isTargetSixStar = isTargetSixStarPull(item, poolType);
          if (isTargetSixStar) {
            bucket.counts[6] += 1;
          } else {
            bucket.counts['6_std'] += 1;
          }
          bucket._allSixStarPulls.push({
            count: 30,  // 固定归入 slot=30
            isStandard: !isTargetSixStar
          });
          if (isTargetSixStar) bucket._upCount += 1;
          // 免费十连不重置 tempCounter
        } else if (rarity >= 5) {
          bucket.counts[5] += 1;
        }
        // 免费十连不推进付费保底, 直接跳过
        if (!includeFreePullsInStats) return;
      }

      bucket.total += 1;
      if (!isFree) tempCounter += 1;
      if (isTargetCapablePool(poolType)) {
        bucket._targetScopePulls += 1;
      }
      if (isLimitedCharacterPool(poolType)) {
        bucket._limitedScopePulls += 1;
      }

      if (bucketKey === 'weapon') {
        bucket._weaponPulls += 1;
        if (!isFree && !isInfoBookHistoryPull(item)) bucket._chargedWeaponPulls += 1;
      } else {
        bucket._characterPulls += 1;
        if (!isFree && !isInfoBookHistoryPull(item)) bucket._chargedCharacterPulls += 1;
      }

      if (isFree) return;  // 免费十连已处理关键统计, 跳过后续

      if (rarity >= 6) {
        const isTargetSixStar = isTargetSixStarPull(item, poolType);
        const isLimitedSixStar = isLimitedCharacterPool(poolType)
          && (isTargetSixStar || isLimitedCharacterOffrate(item));

        if (isTargetSixStar) {
          bucket.counts[6] += 1;
        } else {
          bucket.counts['6_std'] += 1;
        }

        if (bucketKey === 'character') {
          bucket._arsenalGainCounts[isTargetSixStar ? 6 : '6_std'] += 1;
        }

        bucket._allSixStarPulls.push({
          count: tempCounter,
          isStandard: !isTargetSixStar
        });

        if (isTargetSixStar) bucket._upCount += 1;
        if (isLimitedSixStar) bucket._limitedSixCount += 1;

        tempCounter = 0;
        return;
      }

      const normalizedRarity = rarity === 5 ? 5 : 4;
      bucket.counts[normalizedRarity] += 1;
      if (bucketKey === 'character') {
        bucket._arsenalGainCounts[normalizedRarity] += 1;
      }
    });

    // 保存当前垫刀进度, 供下一个 limited 池跨期继承
    bucketTempCounters[bucketKey] = tempCounter;
  }

  // 汇总每个 bucket
  Object.entries(buckets).forEach(([key, bucket]) => {
    const pityLimit = key === 'weapon' ? WEAPON_PITY_LIMIT : CHAR_PITY_LIMIT;

    bucket.totalSixStar = bucket.counts[6] + bucket.counts['6_std'];
    bucket.winRate = bucket.totalSixStar > 0
      ? ((bucket.counts[6] / bucket.totalSixStar) * 100).toFixed(1)
      : '0.0';

    const avgFiveStar = bucket.counts[5] > 0 ? (bucket.total / bucket.counts[5]).toFixed(2) : '0';
    const avgAllSixStar = bucket.totalSixStar > 0 ? (bucket.total / bucket.totalSixStar).toFixed(2) : '0';
    const avgTargetSixStar = bucket._upCount > 0 ? ((bucket._targetScopePulls || bucket.total) / bucket._upCount).toFixed(2) : '0';
    const avgLimitedSixStar = bucket._limitedSixCount > 0 ? ((bucket._limitedScopePulls || bucket.total) / bucket._limitedSixCount).toFixed(2) : '0';

    bucket.avgPullCost = {
      6: avgTargetSixStar,
      '6_all': avgAllSixStar,
      '6_limited': avgLimitedSixStar,
      '6_with_spark': avgTargetSixStar,
      5: avgFiveStar
    };

    bucket.chartData = toChartData(bucket.counts, true);

    const pullCounts = bucket._allSixStarPulls.map((e) => e.count);
    bucket.pityStats = {
      history: bucket._allSixStarPulls,
      distribution: buildDistributionData(bucket._allSixStarPulls, pityLimit),
      max: pullCounts.length > 0 ? Math.max(...pullCounts) : 0,
      min: pullCounts.length > 0 ? Math.min(...pullCounts) : 0,
      avg: pullCounts.length > 0
        ? (pullCounts.reduce((sum, v) => sum + v, 0) / pullCounts.length).toFixed(1)
        : 0
    };

    bucket.resourceSummary = buildResourceSummaryFromAggregates({
      characterPulls: bucket._characterPulls,
      weaponPulls: bucket._weaponPulls,
      chargedCharacterPulls: bucket._chargedCharacterPulls,
      chargedWeaponPulls: bucket._chargedWeaponPulls,
      counts: bucket.counts,
      arsenalGainCounts: bucket._arsenalGainCounts,
      quotaLedger: buildQuotaLedgerFromHistory(bucket._quotaHistory, {
        pools: selectedPools,
      })
    });

    delete bucket._allSixStarPulls;
    delete bucket._upCount;
    delete bucket._limitedSixCount;
    delete bucket._targetScopePulls;
    delete bucket._limitedScopePulls;
    delete bucket._characterPulls;
    delete bucket._weaponPulls;
    delete bucket._chargedCharacterPulls;
    delete bucket._chargedWeaponPulls;
    delete bucket._arsenalGainCounts;
    delete bucket._quotaHistory;
  });

  return buckets;
}

export default buildDashboardOverviewSplitStats;