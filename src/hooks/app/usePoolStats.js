import { useMemo } from 'react';
import useHistoryStore from '../../stores/useHistoryStore.js';
import { RARITY_CONFIG, LIMITED_POOL_RULES } from '../../constants/index.js';
import {
  calculateCurrentProbability,
  calculatePity5FromHistory,
  calculatePityFromHistory
} from '../../utils/index.js';
import { characterCache } from '../../utils/characterUtils.js';
import { isInfoBookHistoryPull } from '../../utils/historyInfoBook.js';
import { buildPoolResourceSummary } from '../../utils/resourceEconomy.js';
import { useCurrentPoolGroupedHistory } from './useCurrentPoolGroupedHistory.js';

function isGiftPull(pull) {
  return pull?.specialType === 'gift' || pull?.special_type === 'gift';
}

function isFreePull(pull) {
  return pull?.isFree === true || pull?.is_free === true;
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
  const manualPityLimit = useHistoryStore(state => state.manualPityLimit);

  const {
    groupedHistory,
    filteredGroupedHistory
  } = useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory);

  const normalizedPoolType = currentPool?.type === 'limited_character'
    ? 'limited'
    : currentPool?.type === 'limited_weapon'
      ? 'weapon'
      : currentPool?.type === 'beginner'
        ? 'standard'
      : currentPool?.type;
  const isLimitedPool = normalizedPoolType === 'limited';
  const isWeaponPool = normalizedPoolType === 'weapon';
  const isStandardPool = normalizedPoolType === 'standard' || normalizedPoolType === 'beginner';

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
    const upSixStarPulls = [];
    const limitedSixStarPulls = []; // UI-007: 限定六星(UP+歪限定)
    let tempCounter = 0;
    let cumulativePullCount = 0; // 累计有效抽数（用于判断Spark）
    let hasGotUpBefore120 = false; // 前120抽内是否已通过概率获得UP

    validPullsList.forEach(pull => {
      tempCounter++;
      cumulativePullCount++;
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

        const pullRecord = {
          count: tempCounter,
          isStandard: pull.isStandard,
          isGuaranteed: pull.specialType === 'guaranteed',
          isSpark
        };
        sixStarPulls.push(pullRecord);
        if (isUp) {
          upSixStarPulls.push(pullRecord);
          limitedSixStarPulls.push(pullRecord);
        } else if (isActuallyLimited) {
          limitedSixStarPulls.push(pullRecord);
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

    // FEAT-014: 排除Spark的平均出货
    const upSixStarPullsExcludingSpark = upSixStarPulls.filter(p => !p.isSpark);
    const avgUpSixStarExcludingSpark = upSixStarPullsExcludingSpark.length > 0
      ? (upSixStarPullsExcludingSpark.reduce((sum, p) => sum + p.count, 0) / upSixStarPullsExcludingSpark.length).toFixed(2)
      : '0';
    const sparkCount = upSixStarPulls.filter(p => p.isSpark).length;

    // UI-007: 限定六星(UP+歪限定)平均出货
    const limitedSixStarPullsExcludingSpark = limitedSixStarPulls.filter(p => !p.isSpark);
    const avgLimitedSixStar = limitedSixStarPullsExcludingSpark.length > 0
      ? (limitedSixStarPullsExcludingSpark.reduce((sum, p) => sum + p.count, 0) / limitedSixStarPullsExcludingSpark.length).toFixed(2)
      : '0';

    const avgPullCost = {
      6: avgUpSixStarExcludingSpark !== '0' ? avgUpSixStarExcludingSpark : avgUpSixStar,
      '6_with_spark': avgUpSixStar,
      '6_all': avgAllSixStar,
      '6_limited': avgLimitedSixStar, // UI-007: 限定六星平均
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
  }, [currentPool.isGroupMode, isLimitedPool, isStandardPool, isWeaponPool, manualPityLimit, normalizedCurrentPoolHistory, normalizedPoolType]);

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
