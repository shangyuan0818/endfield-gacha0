import { useMemo } from 'react';
import { EXTRA_POOL_RULES, RARITY_CONFIG, LIMITED_POOL_RULES, WEAPON_POOL_RULES } from '../../constants/index.js';
import { STANDARD_SIX_STAR_CHARACTERS } from '../../constants/characterPools.js';
import {
  calculateCurrentProbability,
  calculatePity5FromHistory,
  calculatePityFromHistory
} from '../../utils/index.js';
import { resolveCharacterRecordByName } from '../../utils/characterUtils.js';
import { isInfoBookHistoryPull } from '../../utils/historyInfoBook.js';
import {
  createHitIntervalTracker,
  recordHitIntervalHit,
  recordHitIntervalPull,
  averageTrackedIntervals
} from '../../utils/pityIntervals.js';
import { buildPoolResourceSummary } from '../../utils/resourceEconomy.js';
import { buildQuotaLedgerFromHistory } from '../../utils/quotaEconomy.js';
import { useCurrentPoolGroupedHistory } from './useCurrentPoolGroupedHistory.js';

function isGiftPull(pull) {
  return pull?.specialType === 'gift' || pull?.special_type === 'gift';
}

function isFreePull(pull) {
  return pull?.isFree === true || pull?.is_free === true;
}

function normalizePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'extra') return 'extra';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
}

function getHistoryPoolId(item) {
  return item?.poolId || item?.pool_id || null;
}

function isTargetCapablePool(poolType) {
  return poolType === 'limited' || poolType === 'extra' || poolType === 'weapon';
}

function isLimitedCharacterPool(poolType) {
  return poolType === 'limited' || poolType === 'extra';
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

function isLimitedCharacterOffrate(pull) {
  const explicitFlag = readExplicitLimitedFlag(pull);
  if (explicitFlag !== null) {
    return explicitFlag;
  }

  const lookupValues = getHistoryItemLookupValues(pull);
  for (const value of lookupValues) {
    const charInfo = resolveCharacterRecordByName(value, { fuzzy: true });
    if (charInfo) {
      return charInfo.type !== 'weapon' && charInfo.is_limited === true;
    }
  }

  return false;
}

/**
 * 辉光庆典(extra)池: 按常驻名单排除法判断是否为目标限定
 * gui.cpp 标准: 池内4个六星均匀分布, 常驻名单中的不是UP
 */
function isExtraPoolTarget(pull) {
  const name = pull?.character_name || pull?.item_name || pull?.name || '';
  if (!name) return false;
  const standardSet = new Set([...STANDARD_SIX_STAR_CHARACTERS]);
  return !standardSet.has(name);
}

function isTargetSixStarPull(pull, poolType) {
  if (!isTargetCapablePool(poolType)) return false;
  if (poolType === 'extra') {
    return isExtraPoolTarget(pull);
  }
  return !pull.isStandard;
}

function isLimitedSixStarPull(pull, poolType) {
  if (!isLimitedCharacterPool(poolType)) {
    return false;
  }

  if (poolType === 'extra') {
    return isExtraPoolTarget(pull);
  }

  return !pull.isStandard || isLimitedCharacterOffrate(pull);
}

function getHistoryRecordKey(item) {
  const value = item?.id || item?.record_id || null;
  return value == null ? null : String(value);
}

/**
 * 卡池统计 Hook
 * 处理统计计算逻辑：stats、groupedHistory、filteredGroupedHistory、effectivePity 等
 */
export function usePoolStats({
  normalizedCurrentPoolHistory,
  currentPool,
  allLimitedHistory = [],
  currentPoolId = currentPool?.id,
  selectedPools = [],
  includeFreePullsInStats = false
}) {
  const {
    groupedHistory,
    filteredGroupedHistory
  } = useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory);

  const normalizedPoolType = normalizePoolType(currentPool?.type);
  const isLimitedPool = normalizedPoolType === 'limited';
  const isExtraPool = normalizedPoolType === 'extra';
  const isWeaponPool = normalizedPoolType === 'weapon';
  const isStandardPool = normalizedPoolType === 'standard' || normalizedPoolType === 'beginner';
  const poolTypeById = useMemo(() => (
    new Map(
      (Array.isArray(selectedPools) ? selectedPools : [])
        .flatMap((pool) => [pool?.id, pool?.pool_id].map((poolId) => [poolId, normalizePoolType(pool?.type)]))
        .filter(([poolId]) => Boolean(poolId))
    )
  ), [selectedPools]);
  const limitedCrossPoolPityMap = useMemo(() => {
    if (!isLimitedPool || !Array.isArray(allLimitedHistory) || allLimitedHistory.length === 0) {
      return null;
    }

    const map = new Map();
    let sixPity = 0;

    allLimitedHistory.forEach((item) => {
      if (isGiftPull(item) || isFreePull(item)) {
        return;
      }

      sixPity += 1;
      const recordKey = getHistoryRecordKey(item);
      if (Number(item?.rarity) >= 6 && recordKey) {
        map.set(recordKey, sixPity);
        sixPity = 0;
      }
    });

    return map;
  }, [allLimitedHistory, isLimitedPool]);

  // 主统计计算
  const stats = useMemo(() => {
    const getPullPoolType = (pull) => {
      if (currentPool?.isGroupMode) {
        return poolTypeById.get(getHistoryPoolId(pull)) || normalizePoolType(pull?.poolType || pull?.pool_type);
      }

      return normalizedPoolType;
    };
    const paidPullsList = normalizedCurrentPoolHistory.filter((item) => !isGiftPull(item) && !isFreePull(item));
    const quotaPullsList = normalizedCurrentPoolHistory.filter((item) => !isGiftPull(item));
    const validPullsList = quotaPullsList.filter((item) => (
      includeFreePullsInStats || !isFreePull(item)
    ));
    const chargedPullsList = validPullsList.filter((item) => !isFreePull(item) && !isInfoBookHistoryPull(item));
    const total = validPullsList.length;
    const paidTotal = paidPullsList.length;
    const freePullCount = normalizedCurrentPoolHistory.filter((item) => !isGiftPull(item) && isFreePull(item)).length;

    const counts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    const giftCounts = { 6: 0 };

    let currentPity = 0;
    let currentPity5 = 0;

    // 计算当前6星保底
    for (let i = normalizedCurrentPoolHistory.length - 1; i >= 0; i--) {
      const item = normalizedCurrentPoolHistory[i];
      if (isGiftPull(item) || isFreePull(item)) continue;

      if (item.rarity === 6) {
        break;
      }
      currentPity++;
    }

    // 计算当前5星保底
    for (let i = normalizedCurrentPoolHistory.length - 1; i >= 0; i--) {
      const item = normalizedCurrentPoolHistory[i];
      if (isGiftPull(item) || isFreePull(item)) continue;

      if (item.rarity >= 5) {
        break;
      }
      currentPity5++;
    }

    // 统计各稀有度数量（仅统计有效抽数，排除免费十连和赠送）
    normalizedCurrentPoolHistory.forEach(pull => {
      let r = pull.rarity;

      if (isGiftPull(pull)) {
        if (r === 6) giftCounts[6]++;
        return; // 赠送不计入稀有度统计
      }

      // 免费十连: 默认不计入4星(避免膨胀饼图), 但六星/五星出货始终计入
      if (isFreePull(pull)) {
        if (!includeFreePullsInStats && r < 5) return;
      }
      const pullPoolType = getPullPoolType(pull);

      if (r === 6) {
        if (isTargetSixStarPull(pull, pullPoolType)) {
          counts[6]++;
        } else {
          counts['6_std']++;
        }
      } else {
        if (r < 4) r = 4;
        if (counts[r] !== undefined) counts[r]++;
      }
    });

    const quotaPools = currentPool?.isGroupMode
      ? selectedPools
      : [currentPool, ...(Array.isArray(selectedPools) ? selectedPools : [])];
    const quotaLedger = buildQuotaLedgerFromHistory(quotaPullsList, {
      pools: quotaPools,
    });
    const resourceSummary = buildPoolResourceSummary({
      poolType: normalizedPoolType,
      totalPulls: total,
      chargedPulls: chargedPullsList.length,
      counts: { ...counts },
      quotaLedger
    });

    const totalSixStar = counts[6] + counts['6_std'];
    const validSixStar = totalSixStar; // counts 已排除 gift 和 isFree，无需再减

    // 修正不歪率计算 + 歪出分类（FEAT-013）
    let realLimited = 0;
    let realStandard = 0;
    let offStandardCount = 0;  // 歪到常驻角色
    let offLimitedCount = 0;   // 歪到非当期限定角色
    normalizedCurrentPoolHistory.forEach(pull => {
       if (pull.rarity === 6 && !isGiftPull(pull) && (includeFreePullsInStats || !isFreePull(pull))) {
          const pullPoolType = getPullPoolType(pull);
          if (isTargetSixStarPull(pull, pullPoolType)) {
            realLimited++;
          } else {
            realStandard++;
            // 区分歪常驻 vs 歪限定
            if (isLimitedCharacterOffrate(pull)) {
              offLimitedCount++;  // 歪到非当期限定角色
            } else {
              offStandardCount++; // 歪到常驻角色
            }
          }
       }
    });
    const realTotalSix = realLimited + realStandard;
    // gui.cpp 标准: 排除120抽硬保底强制UP (不是随机判定的结果, 不计入胜场)
    const naturalLimited = realLimited - sparkCount;
    const naturalTotal = naturalLimited + realStandard;
    const winRate = naturalTotal > 0 ? (naturalLimited / naturalTotal * 100).toFixed(1) : 0;

    // 计算额外赠送机制（池组聚合模式下跳过，因为赠送按单池计算）
    let bonusGiftsLimited = 0;
    let bonusGiftsStandard = 0;

    if (!currentPool.isGroupMode) {
      if (isLimitedPool) {
        bonusGiftsLimited = Math.floor(paidTotal / 240);
      } else if (isExtraPool) {
        bonusGiftsLimited = 0;
      } else if (isWeaponPool) {
        if (paidTotal >= 100) bonusGiftsStandard++;
        if (paidTotal >= 180) {
          bonusGiftsLimited++;
          const extraPulls = paidTotal - 180;
          const extraCycles = Math.floor(extraPulls / 80);
          bonusGiftsStandard += Math.ceil(extraCycles / 2);
          bonusGiftsLimited += Math.floor(extraCycles / 2);
        }
      } else if (isStandardPool) {
        if (paidTotal >= 300) {
          bonusGiftsStandard++;
        }
      }
    }

    // 赠送奖励不计入抽卡饼图 (gui.cpp: 选择券/潜能/武器箱不是随机出货)
    // 保留在 bonusGifts 中供特殊进度区域单独展示

    // 统计历史6星出货分布
    const sixStarPulls = [];
    const upSixStarHits = [];
    const limitedSixStarHits = [];
    const limitedSixStarIntervalTracker = createHitIntervalTracker(); // UI-007: 限定六星(UP+歪限定)
    const targetSixStarIntervalTracker = createHitIntervalTracker();
    let tempCounter = 0;
    let cumulativePullCount = 0; // 累计有效抽数（用于判断Spark）
    let hasGotUpBefore120 = false; // 前120抽内是否已通过概率获得UP
    let targetScopeTotal = 0;
    let limitedScopeTotal = 0;

    validPullsList.forEach(pull => {
      const isFree = isFreePull(pull);
      const pullPoolType = getPullPoolType(pull);

      // 免费十连不推进付费保底进度 (gui.cpp §2.1.1)
      if (!isFree) {
        tempCounter++;
        cumulativePullCount++;
        if (isTargetCapablePool(pullPoolType)) {
          targetScopeTotal++;
        }
        if (isLimitedCharacterPool(pullPoolType)) {
          limitedScopeTotal++;
        }
        recordHitIntervalPull(targetSixStarIntervalTracker);
        recordHitIntervalPull(limitedSixStarIntervalTracker);
      }
      if (pull.rarity === 6) {
        const isUp = isTargetSixStarPull(pull, pullPoolType);
        let isSpark = false;

        // 免费十连不参与Spark判定 (gui.cpp: 独立通道)
        if (!isFree) {
          if (!currentPool.isGroupMode && pullPoolType === 'limited' && isUp && cumulativePullCount === 120 && !hasGotUpBefore120) {
            isSpark = true;
          }
          if (isUp && cumulativePullCount < 120) {
            hasGotUpBefore120 = true;
          }
        }

        // UI-007: 判断歪出的6星是否为限定角色
        const isActuallyLimited = isLimitedSixStarPull(pull, pullPoolType);

        // 免费十连六星固定归入 slot=30; 付费抽取继承或 tempCounter
        const inheritedSixStarCount = isLimitedPool
          ? limitedCrossPoolPityMap?.get(getHistoryRecordKey(pull))
          : null;
        const fallbackCount = isFree ? 30 : tempCounter;
        const effectiveSixStarCount = Number.isFinite(inheritedSixStarCount) && inheritedSixStarCount > 0
          ? inheritedSixStarCount
          : fallbackCount;
        const pullRecord = {
          count: effectiveSixStarCount,
          isStandard: pull.isStandard,
          isGuaranteed: pull.specialType === 'guaranteed',
          isSpark
        };
        sixStarPulls.push(pullRecord);
        if (isUp) {
          upSixStarHits.push(pullRecord);
          recordHitIntervalHit(targetSixStarIntervalTracker, { isSpark });
        }
        if (isActuallyLimited) {
          limitedSixStarHits.push(pullRecord);
          recordHitIntervalHit(limitedSixStarIntervalTracker, { isSpark });
        }
        // 免费十连出货不重置付费保底 (gui.cpp)
        if (!isFree) tempCounter = 0;
      }
    });

    const pullCounts = sixStarPulls.map(s => s.count);
    const maxPityRecorded = pullCounts.length > 0 ? Math.max(...pullCounts) : 0;
    const minPityRecorded = pullCounts.length > 0 ? Math.min(...pullCounts) : 0;
    const avgPityRecorded = pullCounts.length > 0
      ? (pullCounts.reduce((a, b) => a + b, 0) / pullCounts.length).toFixed(1)
      : 0;

    const avgAllSixStar = pullCounts.length > 0
      ? (pullCounts.reduce((sum, value) => sum + value, 0) / pullCounts.length).toFixed(2)
      : '0';

    const sparkCount = upSixStarHits.filter(p => p.isSpark).length;
    const upHitCount = upSixStarHits.length;
    const nonSparkUpHitCount = upSixStarHits.filter((pull) => !pull.isSpark).length;
    const limitedSixStarHitCount = limitedSixStarHits.length;
    const nonSparkLimitedSixStarHitCount = limitedSixStarHits.filter((pull) => !pull.isSpark).length;

    // 使用 interval tracker 的真实命中间隔均值 (gui.cpp: sum_up/count_up)
    const avgUpSixStar = averageTrackedIntervals(targetSixStarIntervalTracker.intervals) ?? '0';
    const avgUpSixStarExcludingSpark = averageTrackedIntervals(
      targetSixStarIntervalTracker.intervals,
      { exclude: (item) => item.isSpark }
    ) ?? avgUpSixStar;
    const avgLimitedSixStar = averageTrackedIntervals(
      limitedSixStarIntervalTracker.intervals,
      { exclude: (item) => item.isSpark }
    ) ?? (averageTrackedIntervals(limitedSixStarIntervalTracker.intervals) ?? '0');

    const avgPullCost = {
      6: avgUpSixStarExcludingSpark !== '0' ? avgUpSixStarExcludingSpark : avgUpSixStar,
      '6_with_spark': avgUpSixStar,
      '6_all': avgAllSixStar,
      '6_limited': avgLimitedSixStar,
      5: counts[5] > 0 ? (total / counts[5]).toFixed(2) : '0',
    };

    // 饼图数据
    const rawChartData = [
      ...(!isStandardPool ? [{ name: '6星(限定)', kind: 'target-six', value: counts[6], color: RARITY_CONFIG[6].color, originalValue: counts[6] }] : []),
      { name: '6星(常驻)', kind: 'offrate-six', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color, originalValue: counts['6_std'] },
      { name: '5星', kind: 'five-star', value: counts[5], color: RARITY_CONFIG[5].color, originalValue: counts[5] },
      { name: '4星', kind: 'four-star', value: counts[4], color: RARITY_CONFIG[4].color, originalValue: counts[4] },
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

    // 出货分布直方图 — 范围封顶于池型保底上限
    const hardPityLimit = isWeaponPool
      ? WEAPON_POOL_RULES.sixStarPity
      : isExtraPool
        ? EXTRA_POOL_RULES.sixStarPity
        : LIMITED_POOL_RULES.sixStarPity;
    const distributionData = [];
    if (sixStarPulls.length > 0) {
      const numBuckets = Math.ceil(hardPityLimit / 10);
      for (let i = 0; i < numBuckets; i++) {
        const rangeStart = i * 10 + 1;
        const rangeEnd = (i + 1) * 10;
        const isLast = i === numBuckets - 1;
        const items = sixStarPulls.filter(p =>
          isLast ? p.count >= rangeStart : p.count >= rangeStart && p.count <= rangeEnd
        );
        distributionData.push({
          range: `${rangeStart}-${rangeEnd}`,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length,
          guaranteed: items.filter(p => p.isGuaranteed).length
        });
      }
    }

    const probabilityInfo = currentPool.isGroupMode ? null : calculateCurrentProbability(currentPity, normalizedPoolType);

    const infoBookThreshold = LIMITED_POOL_RULES.infoBookThreshold;
    const hasInfoBook = !currentPool.isGroupMode && isLimitedPool && paidTotal >= infoBookThreshold;
    const pullsUntilInfoBook = !currentPool.isGroupMode && isLimitedPool && !hasInfoBook
      ? infoBookThreshold - paidTotal
      : 0;

    return {
      total,
      paidTotal,
      freePullCount,
      includeFreePullsInStats,
      counts,
      totalSixStar,
      validSixStar,
      winRate,
      sixStarCount: realTotalSix,
      upSixStarCount: realLimited,
      stdSixStarCount: realStandard,
      offStandardCount,
      offLimitedCount,
      sparkCount,
      bonusGifts: { limited: bonusGiftsLimited, standard: bonusGiftsStandard },
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
      pullsUntilInfoBook,
      resourceSummary
    };
  }, [
    currentPool,
    includeFreePullsInStats,
    isExtraPool,
    isLimitedPool,
    isStandardPool,
    isWeaponPool,
    limitedCrossPoolPityMap,
    normalizedCurrentPoolHistory,
    normalizedPoolType,
    poolTypeById,
    selectedPools
  ]);

  // 跨池保底继承计算（始终计算，不受当前池是否有数据限制）
  const inheritedPityInfo = useMemo(() => {
    if (!currentPool || !isLimitedPool) {
      return { inheritedPity: 0, inheritedPity5: 0, hasInheritedPity: false };
    }

    const validLimitedPulls = allLimitedHistory.filter(item =>
      item.specialType !== 'gift' &&
      item.special_type !== 'gift' &&
      item.isFree !== true &&
      item.is_free !== true
    );

    if (validLimitedPulls.length === 0) {
      return { inheritedPity: 0, inheritedPity5: 0, hasInheritedPity: false };
    }

    const inheritedPity = calculatePityFromHistory(validLimitedPulls);
    const inheritedPity5 = calculatePity5FromHistory(validLimitedPulls);

    let lastSixStarPoolId = null;
    for (let i = validLimitedPulls.length - 1; i >= 0; i--) {
      if (validLimitedPulls[i].rarity === 6) {
        lastSixStarPoolId = validLimitedPulls[i].poolId || validLimitedPulls[i].pool_id || null;
        break;
      }
    }

    return {
      inheritedPity,
      inheritedPity5,
      hasInheritedPity: inheritedPity > 0 && lastSixStarPoolId !== currentPoolId
    };
  }, [allLimitedHistory, currentPool, currentPoolId, isLimitedPool]);

  // 计算实际有效的保底数（跨池合并后的真实垫刀数）
  const effectivePity = useMemo(() => {
    if (!isLimitedPool) {
      return {
        pity6: stats.currentPity,
        pity5: stats.currentPity5,
        isInherited: false
      };
    }

    // 限定池：使用跨池合并计算的保底数
    return {
      pity6: inheritedPityInfo.inheritedPity,
      pity5: inheritedPityInfo.inheritedPity5,
      isInherited: inheritedPityInfo.hasInheritedPity
    };
  }, [inheritedPityInfo, isLimitedPool, stats.currentPity, stats.currentPity5]);

  return {
    groupedHistory,
    filteredGroupedHistory,
    stats,
    inheritedPityInfo,
    effectivePity
  };
}

export default usePoolStats;