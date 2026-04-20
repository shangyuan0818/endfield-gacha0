import { useMemo } from 'react';
import { EXTRA_POOL_RULES, RARITY_CONFIG, LIMITED_POOL_RULES, WEAPON_POOL_RULES } from '../../constants/index.js';
import {
  calculateCurrentProbability,
  calculatePity5FromHistory,
  calculatePityFromHistory
} from '../../utils/index.js';
import { characterCache } from '../../utils/characterUtils.js';
import { isInfoBookHistoryPull } from '../../utils/historyInfoBook.js';
import {
  createHitIntervalTracker,
  recordHitIntervalHit,
  recordHitIntervalPull
} from '../../utils/pityIntervals.js';
import { buildPoolResourceSummary } from '../../utils/resourceEconomy.js';
import { useCurrentPoolGroupedHistory } from './useCurrentPoolGroupedHistory.js';

function isGiftPull(pull) {
  return pull?.specialType === 'gift' || pull?.special_type === 'gift';
}

function isFreePull(pull) {
  return pull?.isFree === true || pull?.is_free === true;
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
  currentPoolId = currentPool?.id
}) {
  const {
    groupedHistory,
    filteredGroupedHistory
  } = useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory);

  const normalizedPoolType = currentPool?.type === 'limited_character'
    ? 'limited'
    : currentPool?.type === 'extra'
      ? 'extra'
    : currentPool?.type === 'limited_weapon'
      ? 'weapon'
      : currentPool?.type === 'beginner'
        ? 'standard'
        : currentPool?.type;
  const isLimitedPool = normalizedPoolType === 'limited';
  const isExtraPool = normalizedPoolType === 'extra';
  const isWeaponPool = normalizedPoolType === 'weapon';
  const isStandardPool = normalizedPoolType === 'standard' || normalizedPoolType === 'beginner';
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
    const validPullsList = normalizedCurrentPoolHistory.filter((item) => !isGiftPull(item) && !isFreePull(item));
    const chargedPullsList = validPullsList.filter((item) => !isInfoBookHistoryPull(item));
    const total = validPullsList.length;

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

      if (isFreePull(pull)) return; // 免费十连不计入稀有度统计

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

    const resourceSummary = buildPoolResourceSummary({
      poolType: normalizedPoolType,
      totalPulls: total,
      chargedPulls: chargedPullsList.length,
      counts: { ...counts }
    });

    const totalSixStar = counts[6] + counts['6_std'];
    const validSixStar = totalSixStar; // counts 已排除 gift 和 isFree，无需再减

    // 修正不歪率计算 + 歪出分类（FEAT-013）
    let realLimited = 0;
    let realStandard = 0;
    let offStandardCount = 0;  // 歪到常驻角色
    let offLimitedCount = 0;   // 歪到非当期限定角色
    normalizedCurrentPoolHistory.forEach(pull => {
       if (pull.rarity === 6 && !isGiftPull(pull) && !isFreePull(pull)) {
          if (pull.isStandard) {
            realStandard++;
            // 区分歪常驻 vs 歪限定
            const charName = pull.character_name || pull.item_name || pull.name || '';
            const charInfo = characterCache.searchByName(charName);
            if (charInfo && charInfo.is_limited) {
              offLimitedCount++;  // 歪到非当期限定角色
            } else {
              offStandardCount++; // 歪到常驻角色
            }
          }
          else realLimited++;
       }
    });
    const realTotalSix = realLimited + realStandard;
    const winRate = realTotalSix > 0 ? (realLimited / realTotalSix * 100).toFixed(1) : 0;

    // 计算额外赠送机制（池组聚合模式下跳过，因为赠送按单池计算）
    let bonusGiftsLimited = 0;
    let bonusGiftsStandard = 0;

    if (!currentPool.isGroupMode) {
      if (isLimitedPool) {
        bonusGiftsLimited = Math.floor(total / 240);
      } else if (isExtraPool) {
        bonusGiftsLimited = 0;
      } else if (isWeaponPool) {
        if (total >= 100) bonusGiftsStandard++;
        if (total >= 180) {
          bonusGiftsLimited++;
          const extraPulls = total - 180;
          const extraCycles = Math.floor(extraPulls / 80);
          bonusGiftsStandard += Math.ceil(extraCycles / 2);
          bonusGiftsLimited += Math.floor(extraCycles / 2);
        }
      } else if (isStandardPool) {
        if (total >= 300) {
          bonusGiftsStandard++;
        }
      }
    }

    counts[6] += bonusGiftsLimited;
    counts['6_std'] += bonusGiftsStandard;

    // 统计历史6星出货分布
    const sixStarPulls = [];
    const upSixStarHits = [];
    const limitedSixStarIntervalTracker = createHitIntervalTracker(); // UI-007: 限定六星(UP+歪限定)
    const targetSixStarIntervalTracker = createHitIntervalTracker();
    let tempCounter = 0;
    let cumulativePullCount = 0; // 累计有效抽数（用于判断Spark）
    let hasGotUpBefore120 = false; // 前120抽内是否已通过概率获得UP

    validPullsList.forEach(pull => {
      tempCounter++;
      cumulativePullCount++;
      recordHitIntervalPull(targetSixStarIntervalTracker);
      recordHitIntervalPull(limitedSixStarIntervalTracker);
      if (pull.rarity === 6) {
        // 判断是否为120抽Spark触发（FEAT-014）
        // Spark条件: 限定池 + UP角色 + 累计恰好第120抽 + 之前未获得过UP
        // 池组聚合模式下跳过Spark判定（跨池合并后累计抽数无意义）
        const isUp = !pull.isStandard;
        let isSpark = false;
        if (!currentPool.isGroupMode && isLimitedPool && isUp && cumulativePullCount === 120 && !hasGotUpBefore120) {
          isSpark = true;
        }
        if (isUp && cumulativePullCount < 120) {
          hasGotUpBefore120 = true;
        }

        // UI-007: 判断歪出的6星是否为限定角色
        let isActuallyLimited = false;
        if (pull.isStandard) {
          const charName = pull.character_name || pull.item_name || pull.name || '';
          const charInfo = characterCache.searchByName(charName);
          isActuallyLimited = !!(charInfo && charInfo.is_limited);
        }

        const inheritedSixStarCount = isLimitedPool
          ? limitedCrossPoolPityMap?.get(getHistoryRecordKey(pull))
          : null;
        const effectiveSixStarCount = Number.isFinite(inheritedSixStarCount) && inheritedSixStarCount > 0
          ? inheritedSixStarCount
          : tempCounter;
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
          recordHitIntervalHit(limitedSixStarIntervalTracker, { isSpark });
        } else if (isActuallyLimited) {
          recordHitIntervalHit(limitedSixStarIntervalTracker);
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

    const avgAllSixStar = pullCounts.length > 0
      ? (pullCounts.reduce((sum, value) => sum + value, 0) / pullCounts.length).toFixed(2)
      : '0';

    const sparkCount = upSixStarHits.filter(p => p.isSpark).length;
    const upHitCount = upSixStarHits.length;
    const nonSparkUpHitCount = upSixStarHits.filter((pull) => !pull.isSpark).length;

    // BUG-035: 详情页 / 总览 / 统计页统一为 池总抽数 / 目标 6★ 次数
    const avgUpSixStar = upHitCount > 0
      ? (total / upHitCount).toFixed(2)
      : '0';
    const avgUpSixStarExcludingSpark = nonSparkUpHitCount > 0
      ? (total / nonSparkUpHitCount).toFixed(2)
      : '0';
    const avgLimitedSixStar = avgUpSixStarExcludingSpark !== '0'
      ? avgUpSixStarExcludingSpark
      : avgUpSixStar;

    const avgPullCost = {
      6: avgUpSixStarExcludingSpark !== '0' ? avgUpSixStarExcludingSpark : avgUpSixStar,
      '6_with_spark': avgUpSixStar,
      '6_all': avgAllSixStar,
      '6_limited': avgLimitedSixStar,
      5: counts[5] > 0 ? (total / counts[5]).toFixed(2) : '0',
    };

    // 饼图数据
    const rawChartData = [
      ...(!isStandardPool ? [{ name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color, originalValue: counts[6] }] : []),
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
    const hasInfoBook = !currentPool.isGroupMode && isLimitedPool && total >= infoBookThreshold;
    const pullsUntilInfoBook = !currentPool.isGroupMode && isLimitedPool && !hasInfoBook
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
      offStandardCount,
      offLimitedCount,
      sparkCount,
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
  }, [currentPool.isGroupMode, isExtraPool, isLimitedPool, isStandardPool, isWeaponPool, limitedCrossPoolPityMap, normalizedCurrentPoolHistory, normalizedPoolType]);

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
