import { useMemo } from 'react';
import { RARITY_CONFIG } from '../../constants/index.js';
import { buildResourceSummaryFromAggregates } from '../../utils/resourceEconomy.js';
import { annotateInfoBookPulls, isInfoBookHistoryPull } from '../../utils/historyInfoBook.js';
import { classifyGameAccountRegionBucket } from '../../utils/gameAccountMetadata.js';

function isGiftPull(pull) {
  return pull?.specialType === 'gift' || pull?.special_type === 'gift';
}

function isFreePull(pull) {
  return pull?.isFree === true || pull?.is_free === true;
}

function matchesPoolTarget(pull, poolMeta) {
  const upCharacter = String(poolMeta?.upCharacter || '').trim();
  if (!upCharacter || pull?.rarity !== 6) {
    return false;
  }

  const target = upCharacter.toLowerCase();
  const pullName = String(pull?.character_name || pull?.item_name || pull?.name || '').trim().toLowerCase();
  if (!pullName) {
    return false;
  }

  return pullName.includes(target) || target.includes(pullName);
}

/**
 * 统计数据计算 Hook
 * 计算本地用户的抽卡统计数据
 *
 * @param {Array} history - 抽卡历史记录
 * @param {Array} pools - 卡池列表
 * @param {Object|null} user - 当前用户
 * @returns {Object} 统计数据
 */
export function useSummaryStats(history, pools, user) {
  // 过滤当前用户的卡池和历史记录
  const myPools = useMemo(() => {
    if (!pools) return [];
    if (!user) return [];
    return pools;
  }, [pools, user]);

  const myHistory = useMemo(() => {
    if (!history) return [];
    if (!user) return [];
    return history.filter(h => h.user_id === user.id);
  }, [history, user]);
  const annotatedMyHistory = useMemo(
    () => annotateInfoBookPulls(myHistory, myPools),
    [myHistory, myPools]
  );

  // 归一化 myHistory 的 isStandard（基于 UP 角色匹配重新计算）
  const normalizedMyHistory = useMemo(() => {
    const poolMap = new Map();
    myPools.forEach(p => {
      poolMap.set(p.id, { type: p.type, upCharacter: p.up_character });
    });

    return annotatedMyHistory.map(h => {
      const pool = poolMap.get(h.poolId || h.pool_id);
      if (!pool) return h;

      const poolType = pool.type;
      const upCharacter = pool.upCharacter;
      const characterName = h.character_name || h.item_name || h.name || '';
      let isStd;

      if (poolType === 'standard' || poolType === 'beginner') {
        isStd = true;
      } else if (poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') {
        if (upCharacter && h.rarity === 6) {
          isStd = !characterName.toLowerCase().includes(upCharacter.toLowerCase()) &&
                  !upCharacter.toLowerCase().includes(characterName.toLowerCase());
        } else if (h.rarity === 6) {
          isStd = false;
        } else {
          isStd = h.isStandard ?? false;
        }
      } else {
        isStd = h.isStandard ?? false;
      }

      return { ...h, isStandard: isStd };
    });
  }, [annotatedMyHistory, myPools]);

  // 计算当前用户统计数据
  const localStats = useMemo(() => {
    const data = {
      total: 0,
      sixStar: 0,
      fiveStar: 0,
      counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
      byType: {
        limited: { total: 0, six: 0, limitedSix: 0, avgPityUp: null, avgPityTarget: null, counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }, pityList: [] },
        weapon: { total: 0, six: 0, limitedSix: 0, avgPityUp: null, avgPityTarget: null, counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }, pityList: [] },
        standard: { total: 0, six: 0, avgPityUp: null, avgPityTarget: null, counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }, pityList: [] }
      },
      contributorsByRegion: { cn: 0, intl: 0 },
      pityStats: { distribution: [] },
      chartData: []
    };

    const poolTypeMap = new Map();
    const poolMetaMap = new Map();
    myPools.forEach(p => {
      poolTypeMap.set(p.id, p.type);
      poolMetaMap.set(p.id, { type: p.type, upCharacter: p.upCharacter || p.up_character || null });
    });

    const normalizePoolType = (type) => {
      if (type === 'limited' || type === 'limited_character') return 'limited';
      if (type === 'weapon' || type === 'limited_weapon') return 'weapon';
      return 'standard';
    };

    // 分组
    const pullsByPool = {};
    normalizedMyHistory.forEach(item => {
      const poolId = item.poolId || item.pool_id;
      if (!pullsByPool[poolId]) pullsByPool[poolId] = [];
      pullsByPool[poolId].push(item);
    });

    const allSixStarPulls = [];
    const allSixStarPullsExcludingFree = [];
    const targetSixStarPulls = {
      limited: [],
      weapon: []
    };
    let charGiftCount = 0;
    let weaponGiftLimitedCount = 0;
    let weaponGiftStandardCount = 0;

    // 遍历每个池子计算垫刀和赠送
    Object.keys(pullsByPool).forEach(poolId => {
      const rawType = poolTypeMap.get(poolId) || 'standard';
      const type = normalizePoolType(rawType);
      const poolMeta = poolMetaMap.get(poolId);
      const sortedPulls = pullsByPool[poolId].sort((a, b) => a.id - b.id);
      const validPulls = sortedPulls.filter(i => i.specialType !== 'gift' && i.special_type !== 'gift' && i.isFree !== true && i.is_free !== true);
      const poolTotal = validPulls.length;

      if (type === 'limited') {
        charGiftCount += Math.floor(poolTotal / 240);
      } else if (type === 'weapon') {
        if (poolTotal >= 100) weaponGiftStandardCount += 1 + Math.floor((poolTotal - 100) / 160);
        if (poolTotal >= 180) weaponGiftLimitedCount += 1 + Math.floor((poolTotal - 180) / 160);
      }

      let tempCounter = 0;
      let tempCounterExcludingFree = 0;
      // FEAT-014: 追踪累计抽数用于判断120抽必出(Spark)
      let cumulativePullCount = 0;
      let hasGotUpBefore120 = false;

      validPulls.forEach(pull => {
        const isFree = pull.isFree || pull.is_free;
        tempCounter++;
        if (!isFree) tempCounterExcludingFree++;
        cumulativePullCount++;

        if (pull.rarity === 6) {
          // FEAT-014: 判断是否为120抽Spark
          const isUp = !pull.isStandard;
          let isSpark = false;
          if (type === 'limited' && isUp && cumulativePullCount === 120 && !hasGotUpBefore120) {
            isSpark = true;
          }
          if (isUp && cumulativePullCount < 120) {
            hasGotUpBefore120 = true;
          }

          allSixStarPulls.push({
            count: tempCounter,
            isStandard: pull.isStandard,
            isGuaranteed: pull.specialType === 'guaranteed',
            isFree: isFree,
            isSpark
          });

          if (!isFree) {
            allSixStarPullsExcludingFree.push({
              count: tempCounterExcludingFree,
              isStandard: pull.isStandard,
              isGuaranteed: pull.specialType === 'guaranteed',
              isSpark
            });
            tempCounterExcludingFree = 0;
          }

          data.byType[type].pityList.push({
            count: tempCounter,
            isStandard: pull.isStandard,
            isFree: isFree,
            isSpark
          });
          if ((type === 'limited' || type === 'weapon') && matchesPoolTarget(pull, poolMeta)) {
            targetSixStarPulls[type].push({
              count: tempCounter,
              isSpark
            });
          }
          tempCounter = 0;
        }
      });
    });

    // 辅助函数
    const generateDist = (list) => {
      if (!list || list.length === 0) return [];
      const maxPity = Math.max(...list.map(i => i.count), 80);
      const max = Math.ceil(maxPity / 10) * 10;
      const dist = [];
      for(let i=0; i<max; i+=10) {
        const rangeStart = i + 1;
        const rangeEnd = i + 10;
        const items = list.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
        dist.push({
          range: `${rangeStart}-${rangeEnd}`,
          rangeStart,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length
        });
      }
      return dist.sort((a, b) => a.rangeStart - b.rangeStart);
    };

    const generatePieData = (counts) => {
      const rawData = [
        { name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color },
        { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
        { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
        { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color },
      ].filter(item => item.value > 0);

      const totalValue = rawData.reduce((sum, d) => sum + d.value, 0);
      return rawData.map(item => {
        const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
        let minPercent = 0;
        if (item.name.includes('6星')) minPercent = 15;
        else if (item.name.includes('5星')) minPercent = 20;

        if (currentPercent < minPercent && totalValue > 0) {
          return { ...item, displayValue: Math.ceil(totalValue * minPercent / 100) };
        }
        return { ...item, displayValue: item.value };
      });
    };

    // 全局统计
    normalizedMyHistory.forEach(item => {
      const rawType = poolTypeMap.get(item.poolId || item.pool_id) || 'standard';
      const type = normalizePoolType(rawType);
      const typeData = data.byType[type];
      if (!typeData) return;

      const isFree = item.isFree || item.is_free;
      if (item.specialType !== 'gift' && item.special_type !== 'gift' && !isFree) {
        data.total++;
        typeData.total++;
      }

      let r = item.rarity;
      // 所有稀有度计数统一排除 gift 和 free
      if (item.specialType === 'gift' || item.special_type === 'gift' || isFree) {
        // gift 和免费十连不计入任何稀有度统计
      } else if (r === 6) {
        if (item.isStandard) {
          data.counts['6_std']++;
          typeData.counts['6_std']++;
        } else {
          data.counts[6]++;
          typeData.counts[6]++;
        }
        data.sixStar++;
        typeData.six++;
        if (!item.isStandard && typeData.limitedSix !== undefined) {
          typeData.limitedSix++;
        }
      } else if (r === 5) {
        data.fiveStar++;
        data.counts[5]++;
        typeData.counts[5]++;
      } else {
        if (r < 4) r = 4;
        data.counts[r]++;
        typeData.counts[r]++;
      }
    });

    // 生成图表数据
    data.chartData = generatePieData(data.counts);

    ['limited', 'weapon', 'standard'].forEach(t => {
      data.byType[t].distribution = generateDist(data.byType[t].pityList);
      data.byType[t].chartData = generatePieData(data.byType[t].counts);
      if (data.byType[t].pityList.length > 0) {
        data.byType[t].avgPity = (data.byType[t].pityList.reduce((sum, p) => sum + p.count, 0) / data.byType[t].pityList.length).toFixed(1);
      }
      if (t === 'limited') {
        const nonFreeNonSparkList = data.byType[t].pityList.filter(p => !p.isFree && !p.isSpark);
        if (nonFreeNonSparkList.length > 0) {
          data.byType[t].avgPityExcludingFree = (nonFreeNonSparkList.reduce((sum, p) => sum + p.count, 0) / nonFreeNonSparkList.length).toFixed(1);
        }
        // 含Spark的平均出货（供参考）
        const nonFreeList = data.byType[t].pityList.filter(p => !p.isFree);
        if (nonFreeList.length > 0) {
          data.byType[t].avgPityWithSpark = (nonFreeList.reduce((sum, p) => sum + p.count, 0) / nonFreeList.length).toFixed(1);
        }
      }
    });

    const limitedTargetPulls = targetSixStarPulls.limited.filter(item => !item.isSpark);
    const weaponTargetPulls = targetSixStarPulls.weapon;
    data.byType.limited.avgPityUp = limitedTargetPulls.length > 0
      ? (limitedTargetPulls.reduce((sum, item) => sum + item.count, 0) / limitedTargetPulls.length).toFixed(1)
      : null;
    data.byType.limited.avgPityTarget = data.byType.limited.avgPityUp;
    data.byType.weapon.avgPityUp = weaponTargetPulls.length > 0
      ? (weaponTargetPulls.reduce((sum, item) => sum + item.count, 0) / weaponTargetPulls.length).toFixed(1)
      : null;
    data.byType.weapon.avgPityTarget = data.byType.weapon.avgPityUp;

    // 全局分布
    if (allSixStarPulls.length > 0) {
      const maxPity = Math.max(...allSixStarPulls.map(p => p.count), 80);
      const maxRange = Math.ceil(maxPity / 10) * 10;
      for (let i = 0; i < maxRange; i += 10) {
        const rangeStart = i + 1;
        const rangeEnd = i + 10;
        const items = allSixStarPulls.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
        data.pityStats.distribution.push({
          range: `${rangeStart}-${rangeEnd}`,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length,
          guaranteed: items.filter(p => p.isGuaranteed).length
        });
      }
    }

    // 角色池合并数据
    const characterCounts = {
      6: data.byType.limited.counts[6] + data.byType.standard.counts[6],
      '6_std': data.byType.limited.counts['6_std'] + data.byType.standard.counts['6_std'],
      5: data.byType.limited.counts[5] + data.byType.standard.counts[5],
      4: data.byType.limited.counts[4] + data.byType.standard.counts[4]
    };
    const characterPityList = [...data.byType.limited.pityList, ...data.byType.standard.pityList];
    const limitedPityListExcludingFree = data.byType.limited.pityList.filter(p => !p.isFree);
    const characterPityListExcludingFree = characterPityList.filter(p => !p.isFree && !p.isSpark);

    data.byType.character = {
      total: data.byType.limited.total + data.byType.standard.total,
      six: data.byType.limited.six + data.byType.standard.six,
      limitedSix: data.byType.limited.limitedSix,
      counts: characterCounts,
      pityList: characterPityList,
      pityListExcludingFree: characterPityListExcludingFree,
      distribution: generateDist(characterPityList),
      chartData: generatePieData(characterCounts),
      avgPity: characterPityList.length > 0
        ? (characterPityList.reduce((sum, p) => sum + p.count, 0) / characterPityList.length).toFixed(1)
        : '-',
      avgPityUp: data.byType.limited.avgPityUp,
      avgPityTarget: data.byType.limited.avgPityUp,
      avgPityExcludingFree: characterPityListExcludingFree.length > 0
        ? (characterPityListExcludingFree.reduce((sum, p) => sum + p.count, 0) / characterPityListExcludingFree.length).toFixed(1)
        : null
    };

    const limitedChargedPulls = normalizedMyHistory.filter(item => {
      const rawType = poolTypeMap.get(item.poolId || item.pool_id) || 'standard';
      const type = normalizePoolType(rawType);
      const isFree = item.isFree || item.is_free;
      return type === 'limited' && item.specialType !== 'gift' && item.special_type !== 'gift' && !isFree && !isInfoBookHistoryPull(item);
    }).length;

    const standardChargedPulls = normalizedMyHistory.filter(item => {
      const rawType = poolTypeMap.get(item.poolId || item.pool_id) || 'standard';
      const type = normalizePoolType(rawType);
      const isFree = item.isFree || item.is_free;
      return type === 'standard' && item.specialType !== 'gift' && item.special_type !== 'gift' && !isFree;
    }).length;

    const weaponChargedPulls = normalizedMyHistory.filter(item => {
      const rawType = poolTypeMap.get(item.poolId || item.pool_id) || 'standard';
      const type = normalizePoolType(rawType);
      const isFree = item.isFree || item.is_free;
      return type === 'weapon' && item.specialType !== 'gift' && item.special_type !== 'gift' && !isFree;
    }).length;

    data.byType.limited.resources = buildResourceSummaryFromAggregates({
      characterPulls: data.byType.limited.total,
      chargedCharacterPulls: limitedChargedPulls,
      counts: data.byType.limited.counts,
      arsenalGainCounts: data.byType.limited.counts
    });
    data.byType.standard.resources = buildResourceSummaryFromAggregates({
      characterPulls: data.byType.standard.total,
      chargedCharacterPulls: standardChargedPulls,
      counts: data.byType.standard.counts,
      arsenalGainCounts: data.byType.standard.counts
    });
    data.byType.weapon.resources = buildResourceSummaryFromAggregates({
      weaponPulls: data.byType.weapon.total,
      chargedWeaponPulls: weaponChargedPulls,
      counts: data.byType.weapon.counts,
      arsenalGainCounts: {}
    });
    data.byType.character.resources = buildResourceSummaryFromAggregates({
      characterPulls: data.byType.character.total,
      chargedCharacterPulls: limitedChargedPulls + standardChargedPulls,
      counts: characterCounts,
      arsenalGainCounts: characterCounts
    });

    data.byType.limited.pityListExcludingFree = limitedPityListExcludingFree;

    data.avgPity = allSixStarPulls.length > 0
      ? (allSixStarPulls.reduce((sum, p) => sum + p.count, 0) / allSixStarPulls.length).toFixed(1)
      : '-';

    data.avgPityExcludingFree = allSixStarPullsExcludingFree.length > 0
      ? (allSixStarPullsExcludingFree.reduce((sum, p) => sum + p.count, 0) / allSixStarPullsExcludingFree.length).toFixed(1)
      : '-';

    data.charGift = charGiftCount;
    data.weaponGiftLimited = weaponGiftLimitedCount;
    data.weaponGiftStandard = weaponGiftStandardCount;
    data.giftTotal = charGiftCount + weaponGiftLimitedCount + weaponGiftStandardCount;
    const contributorBuckets = new Set();
    normalizedMyHistory.forEach((item) => {
      if (isGiftPull(item) || isFreePull(item)) {
        return;
      }

      const bucket = classifyGameAccountRegionBucket({
        serverId: item.serverId || item.server_id,
        region: item.region || item.serverRegion
      });

      if (bucket) {
        contributorBuckets.add(bucket);
      }
    });
    data.totalUsers = user ? 1 : 0;
    data.totalContributors = user ? 1 : 0;
    data.contributorsByRegion = {
      cn: contributorBuckets.has('cn') ? 1 : 0,
      intl: contributorBuckets.has('intl') ? 1 : 0
    };
    data.resources = buildResourceSummaryFromAggregates({
      characterPulls: data.byType.character.total,
      weaponPulls: data.byType.weapon.total,
      chargedCharacterPulls: limitedChargedPulls + standardChargedPulls,
      chargedWeaponPulls: weaponChargedPulls,
      counts: data.counts,
      arsenalGainCounts: characterCounts
    });

    return data;
  }, [normalizedMyHistory, myPools, user]);

  return localStats;
}

export default useSummaryStats;
