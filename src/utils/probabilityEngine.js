/**
 * 概率计算引擎
 *
 * 实现终末地的抽卡概率计算逻辑
 */

import {
  LIMITED_POOL_RULES
} from '../constants/index.js';

import {
  getCharacterName,
  getCurrentUpCharacter
} from '../constants/characterPools.js';

/**
 * 计算当前抽数的6星概率
 * @param {number} currentPity - 当前保底计数（距离上次6星的抽数）
 * @param {Object} rules - 卡池规则
 * @returns {number} 概率值（0-1）
 */
export function calculateSixStarProbability(currentPity, rules = LIMITED_POOL_RULES) {
  const {
    sixStarBaseProbability,
    sixStarSoftPityStart,
    sixStarSoftPityIncrease,
    sixStarPity,
    hasSoftPity
  } = rules;

  // 达到硬保底，100%概率
  if (currentPity >= sixStarPity) {
    return 1.0;
  }

  // 武器池无软保底，始终返回基础概率
  if (hasSoftPity === false) {
    return sixStarBaseProbability;
  }

  // 未达到软保底，使用基础概率
  if (currentPity < sixStarSoftPityStart) {
    return sixStarBaseProbability;
  }

  // 软保底阶段，概率递增
  const pityCount = currentPity - sixStarSoftPityStart + 1;
  const increasedProbability = sixStarBaseProbability + (pityCount * sixStarSoftPityIncrease);

  // 确保不超过100%
  return Math.min(increasedProbability, 1.0);
}

/**
 * 计算当前抽数的5星概率
 * @param {number} currentPity - 当前保底计数（距离上次5星+的抽数）
 * @param {Object} rules - 卡池规则
 * @returns {number} 概率值（0-1）
 */
export function calculateFiveStarProbability(currentPity, rules = LIMITED_POOL_RULES) {
  const {
    fiveStarBaseProbability,
    fiveStarPity
  } = rules;

  // 达到保底，100%概率
  if (currentPity >= fiveStarPity) {
    return 1.0;
  }

  // 使用基础概率（5星没有软保底）
  return fiveStarBaseProbability;
}

/**
 * 根据概率随机判断是否命中
 * @param {number} probability - 概率值（0-1）
 * @returns {boolean} 是否命中
 */
export function rollProbability(probability) {
  return Math.random() < probability;
}

/**
 * 模拟单次抽卡
 * @param {Object} state - 当前模拟器状态
 * @param {Object} rules - 卡池规则
 * @param {string} poolType - 卡池类型
 * @param {string} currentUpCharacter - 当前UP角色（可选）
 * @param {Object} poolCharactersList - 可选：卡池角色列表
 * @returns {Object} 抽卡结果
 */
export function simulateSinglePull(state, rules = LIMITED_POOL_RULES, poolType = 'limited', currentUpCharacter = null, poolCharactersList = null) {
  const normalizedPoolType = poolType === 'limited_character'
    ? 'limited'
    : poolType === 'limited_weapon'
      ? 'weapon'
      : poolType;
  const guaranteedLimitedThreshold = Number(rules?.guaranteedLimitedPity || 0);
  const tracksGuaranteedLimited = guaranteedLimitedThreshold > 0;
  // 增加保底计数
  const sixStarPity = state.sixStarPity + 1;
  const fiveStarPity = state.fiveStarPity + 1;
  const guaranteedLimitedPity = tracksGuaranteedLimited && !state.hasReceivedGuaranteedLimited
    ? Math.min((state.guaranteedLimitedPity || 0) + 1, guaranteedLimitedThreshold)
    : (state.guaranteedLimitedPity || 0);

  // ========== 120抽硬保底检查（限定池）/ 80抽硬保底（武器池首轮） ==========
  // 限定池：如果已经119抽没出限定，第120抽必定是限定6星
  // 武器池：如果已经79抽没出限定，第80抽必定是限定6星
  const shouldTriggerGuaranteedLimited =
    tracksGuaranteedLimited &&
    !state.hasReceivedGuaranteedLimited &&
    guaranteedLimitedPity >= guaranteedLimitedThreshold;

  if (shouldTriggerGuaranteedLimited) {
    // 触发硬保底，必出限定6星
    const upChar = currentUpCharacter || getCurrentUpCharacter();
    const characterName = getCharacterName(normalizedPoolType, 6, true, upChar, poolCharactersList);

    return {
      rarity: 6,
      isUp: true,
      isLimited: true,
      characterName,
      sixStarPity: 0,
      fiveStarPity: 0,
      isGuaranteedUp: false,
      totalPulls: state.totalPulls + 1,
      sixStarCount: state.sixStarCount + 1,
      fiveStarCount: state.fiveStarCount,
      guaranteedLimitedPity,
      hasReceivedGuaranteedLimited: true
    };
  }
  // ========== 硬保底检查结束 ==========

  // 计算概率
  const sixStarProb = calculateSixStarProbability(sixStarPity, rules);
  const fiveStarProb = calculateFiveStarProbability(fiveStarPity, rules);

  // 判断是否出6星
  if (rollProbability(sixStarProb)) {
    const isUp = normalizedPoolType === 'extra'
      // 辉光庆典(extra)池: 4个六星均匀分布, 2常驻/2真限定, P(限定|六星)=50%
      ? rollProbability(0.5)
      : rollProbability(rules.upProbability);

    // 获取当前UP角色名称
    const upChar = currentUpCharacter || getCurrentUpCharacter();
    const characterName = getCharacterName(normalizedPoolType, 6, isUp, upChar, poolCharactersList);

    const hasSatisfiedGuaranteedLimited = state.hasReceivedGuaranteedLimited || isUp;

    return {
      rarity: 6,
      isUp,
      isLimited: isUp,
      characterName,
      sixStarPity: 0,              // 重置6星保底
      fiveStarPity: 0,              // 出6星时也重置5星保底
      isGuaranteedUp: false,
      totalPulls: state.totalPulls + 1,
      sixStarCount: state.sixStarCount + 1,
      fiveStarCount: state.fiveStarCount,
      guaranteedLimitedPity,
      hasReceivedGuaranteedLimited: hasSatisfiedGuaranteedLimited
    };
  }

  // 判断是否出5星
  if (rollProbability(fiveStarProb)) {
    const characterName = getCharacterName(normalizedPoolType, 5, false, null, poolCharactersList);

    return {
      rarity: 5,
      isUp: false,
      isLimited: false,
      characterName,
      sixStarPity,
      fiveStarPity: 0,              // 重置5星保底
      isGuaranteedUp: false,
      totalPulls: state.totalPulls + 1,
      sixStarCount: state.sixStarCount,
      fiveStarCount: state.fiveStarCount + 1,
      guaranteedLimitedPity,
      hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
    };
  }

  // 其他情况为4星（去掉三星）
  const characterName = getCharacterName(normalizedPoolType, 4, false, null, poolCharactersList);

  return {
    rarity: 4,
    isUp: false,
    isLimited: false,
    characterName,
    sixStarPity,
    fiveStarPity,
    isGuaranteedUp: false,
    totalPulls: state.totalPulls + 1,
    sixStarCount: state.sixStarCount,
    fiveStarCount: state.fiveStarCount,
    guaranteedLimitedPity,
    hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
  };
}

/**
 * 模拟十连抽卡
 * @param {Object} state - 当前模拟器状态
 * @param {Object} rules - 卡池规则
 * @param {string} poolType - 卡池类型
 * @param {string} currentUpCharacter - 当前UP角色（可选）
 * @param {Object} poolCharactersList - 可选：卡池角色列表
 * @returns {Array} 十连抽卡结果数组
 */
export function simulateTenPull(state, rules = LIMITED_POOL_RULES, poolType = 'limited', currentUpCharacter = null, poolCharactersList = null) {
  const results = [];
  let currentState = { ...state };

  for (let i = 0; i < 10; i++) {
    const result = simulateSinglePull(currentState, rules, poolType, currentUpCharacter, poolCharactersList);
    results.push(result);

    // 更新状态用于下一抽
    currentState = {
      sixStarPity: result.sixStarPity,
      fiveStarPity: result.fiveStarPity,
      isGuaranteedUp: result.isGuaranteedUp,
      totalPulls: result.totalPulls,
      sixStarCount: result.sixStarCount,
      fiveStarCount: result.fiveStarCount,
      guaranteedLimitedPity: result.guaranteedLimitedPity,
      hasReceivedGuaranteedLimited: result.hasReceivedGuaranteedLimited  // 修复：添加丢失的状态
    };
  }

  return results;
}

/**
 * 赠送十连 — 独立基础概率通道（不占用、不推进付费保底）
 *
 * 标准来源: gui.cpp §2.1.1 — 第30抽赠送十连:
 *   - 使用基础概率 0.008（不受软保底递增影响）
 *   - 不推进 current_pity / pity_since_last_up
 *   - 不推进 guaranteedLimitedPity
 *   - 出货不重置付费保底
 *   - 六星/UP 出货仍计入统计
 *
 * @param {Object} state - 当前模拟器状态（不会被修改）
 * @param {string} poolType - 卡池类型 ('limited' | 'extra')
 * @param {string} currentUpCharacter - 当前UP角色
 * @param {Object} poolCharactersList - 可选：卡池角色列表
 * @returns {Array} 十连结果数组
 */
export function simulateCharacterFreeTen(state, poolType = 'limited', currentUpCharacter = null, poolCharactersList = null) {
  const normalizedPoolType = poolType === 'limited_character'
    ? 'limited'
    : poolType;

  const results = [];
  // 固定水位：免费十连内部不累积保底
  const frozenState = {
    sixStarPity: 0,
    fiveStarPity: 0,
    isGuaranteedUp: false,
    totalPulls: state.totalPulls,
    sixStarCount: state.sixStarCount,
    fiveStarCount: state.fiveStarCount,
    guaranteedLimitedPity: state.guaranteedLimitedPity,
    hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
  };

  for (let i = 0; i < 10; i++) {
    // 固定使用基础概率 0.008，不受保底影响
    const sixStarProb = 0.008;
    const fiveStarProb = 0.08;

    let result;
    if (rollProbability(sixStarProb)) {
      // 辉光庆典: 4个六星均匀分布(2限定/2常驻), P(限定|六星)=50%
      const isUp = normalizedPoolType === 'extra'
        ? rollProbability(0.5)
        : rollProbability(0.5);  // 特许池也是50/50

      const upChar = currentUpCharacter || getCurrentUpCharacter();
      const characterName = getCharacterName(normalizedPoolType, 6, isUp, upChar, poolCharactersList);

      result = {
        rarity: 6, isUp, isLimited: isUp, characterName,
        sixStarPity: 0, fiveStarPity: 0, isGuaranteedUp: false,
        totalPulls: state.totalPulls,  // 免费抽不算总抽数
        sixStarCount: state.sixStarCount, fiveStarCount: state.fiveStarCount,
        guaranteedLimitedPity: state.guaranteedLimitedPity,
        hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
      };
    } else if (rollProbability(fiveStarProb)) {
      const characterName = getCharacterName(normalizedPoolType, 5, false, null, poolCharactersList);
      result = { rarity: 5, isUp: false, isLimited: false, characterName, ...frozenState };
    } else {
      const characterName = getCharacterName(normalizedPoolType, 4, false, null, poolCharactersList);
      result = { rarity: 4, isUp: false, isLimited: false, characterName, ...frozenState };
    }
    results.push(result);
  }
  return results;
}

/**
 * 武器池十连申领 — 双状态机模型 (gui.cpp ns∈[0,3]/nf∈[0,7])
 *
 *   - 每十连 = 1 申领 = 10 抽独立判定, 每抽 4% 六星概率
 *   - 连续 3 个十连无六星 → 第 4 个十连保底至少 1 个六星
 *   - 连续 7 个十连无限定 → 第 8 个十连保底至少 1 个限定 UP
 *   - 六星后独立 25% 为 UP; 硬保底强制至少 1 个六星/UP 时,
 *     按条件分布分配命中位置 (而非堆到最后一抽)
 *
 * @param {Object} state - 当前状态 (含 weaponSixStarMissStreak / weaponUpMissStreak)
 * @param {Object} rules - 武器池规则 (WEAPON_POOL_RULES)
 * @param {string} currentUpCharacter - UP 武器名称
 * @param {Object} poolCharactersList - 卡池角色列表 (武器池用)
 * @returns {{ results: Array, newState: Object }} 抽卡结果和更新后状态
 */
export function simulateWeaponTenPull(state, rules = {}, currentUpCharacter = null, poolCharactersList = null) {
  const baseRate = rules.sixStarBaseProbability || 0.04;
  const sixStarPity10 = rules.sixStarPity10Pull || 4;
  const upPity10 = rules.weaponUpPity10Pull || 8;
  const upCondRate = rules.upProbability || 0.25;
  const poolType = 'weapon';

  const ns = (state.weaponSixStarMissStreak || 0);  // 连续几个十连没出6星
  const nf = (state.weaponUpMissStreak || 0);       // 连续几个十连没出限定

  const isSixStarGuaranteed10 = (ns >= sixStarPity10 - 1);  // 第 ns+1 个十连保底6星
  const isUpGuaranteed10 = (nf >= upPity10 - 1);            // 第 nf+1 个十连保底限定

  const results = [];
  let hasSixStar = false;
  let hasUpLimited = false;

  // 十次独立判定
  for (let i = 0; i < 10; i++) {
    let rarity = 4;
    let isUp = false;
    let characterName = '';

    const gotSixStar = rollProbability(baseRate);
    if (gotSixStar) {
      rarity = 6;
      hasSixStar = true;
      isUp = rollProbability(upCondRate);
      if (isUp) hasUpLimited = true;
      characterName = getCharacterName(poolType, 6, isUp, currentUpCharacter, poolCharactersList);
    } else if (rollProbability(rules.fiveStarBaseProbability || 0.15)) {
      rarity = 5;
      characterName = getCharacterName(poolType, 5, false, null, poolCharactersList);
    } else {
      characterName = getCharacterName(poolType, 4, false, null, poolCharactersList);
    }

    results.push({
      rarity,
      isUp: rarity === 6 && isUp,
      isLimited: rarity === 6 && isUp,
      characterName,
      totalPulls: state.totalPulls + i + 1
    });
  }

  // ── 六星保底补丁 ──
  if (isSixStarGuaranteed10 && !hasSixStar) {
    // 按条件分布选择命中位置: P(pos=j) ∝ 0.96^(j-1) × 0.04
    const norm = 1.0 - Math.pow(1.0 - baseRate, 10);
    let r = Math.random();
    let pos = 0;
    for (let j = 0; j < 10; j++) {
      const pj = Math.pow(1.0 - baseRate, j) * baseRate / norm;
      if (r < pj) { pos = j; break; }
      r -= pj;
    }
    const item = results[pos];
    const isUp = rollProbability(upCondRate);
    item.rarity = 6;
    item.isUp = isUp;
    item.isLimited = isUp;
    item.characterName = getCharacterName(poolType, 6, isUp, currentUpCharacter, poolCharactersList);
    hasSixStar = true;
    if (isUp) hasUpLimited = true;
  }

  // ── UP 限定保底补丁 ──
  if (isUpGuaranteed10 && !hasUpLimited) {
    // 如果已有六星但不是 UP，将其替换为 UP
    // 如果还没有六星，先找一个位置出六星再设为UP
    if (!hasSixStar) {
      const norm = 1.0 - Math.pow(1.0 - baseRate, 10);
      let r = Math.random();
      let pos = 0;
      for (let j = 0; j < 10; j++) {
        const pj = Math.pow(1.0 - baseRate, j) * baseRate / norm;
        if (r < pj) { pos = j; break; }
        r -= pj;
      }
      results[pos].rarity = 6;
      results[pos].isUp = true;
      results[pos].isLimited = true;
      results[pos].characterName = getCharacterName(poolType, 6, true, currentUpCharacter, poolCharactersList);
    } else {
      // 找一个非UP六星改为UP
      for (let j = 0; j < 10; j++) {
        if (results[j].rarity === 6 && !results[j].isUp) {
          results[j].isUp = true;
          results[j].isLimited = true;
          results[j].characterName = getCharacterName(poolType, 6, true, currentUpCharacter, poolCharactersList);
          break;
        }
      }
    }
    hasUpLimited = true;
  }

  return { results, ns: hasSixStar ? 0 : ns + 1, nf: hasUpLimited ? 0 : nf + 1 };
}

/**
 * 检查是否触发120抽硬保底
 * @param {Object} state - 当前状态
 * @param {Object} rules - 卡池规则
 * @returns {boolean} 是否触发硬保底
 */
export function checkGuaranteedLimitedTrigger(state, rules = LIMITED_POOL_RULES) {
  return state.guaranteedLimitedPity >= rules.guaranteedLimitedPity &&
         !state.hasReceivedGuaranteedLimited;
}

/**
 * 检查是否可以领取赠送
 * @param {number} totalPulls - 总抽数
 * @param {Object} rules - 卡池规则
 * @returns {boolean} 是否可以领取赠送
 */
export function checkGiftAvailable(totalPulls, rules = LIMITED_POOL_RULES) {
  return totalPulls > 0 && totalPulls % rules.giftInterval === 0;
}

/**
 * 检查是否可以领取情报书
 * @param {Object} state - 当前状态
 * @param {Object} rules - 卡池规则
 * @returns {boolean} 是否可以领取情报书
 */
export function checkInfoBookAvailable(state, rules = LIMITED_POOL_RULES) {
  return !state.hasReceivedInfoBook &&
         state.totalPulls >= rules.infoBookThreshold;
}

/**
 * 计算期望抽数（期望出一个6星需要多少抽）
 * @param {number} currentPity - 当前保底
 * @param {Object} rules - 卡池规则
 * @returns {number} 期望抽数
 */
export function calculateExpectedPulls(currentPity = 0, rules = LIMITED_POOL_RULES) {
  let expectedPulls = 0;
  let totalProbability = 0;

  for (let pity = currentPity + 1; pity <= rules.sixStarPity; pity++) {
    const prob = calculateSixStarProbability(pity, rules);
    const pullsNeeded = pity - currentPity;
    expectedPulls += pullsNeeded * prob * (1 - totalProbability);
    totalProbability += prob * (1 - totalProbability);

    if (totalProbability >= 0.9999) break;
  }

  return Math.ceil(expectedPulls);
}

/**
 * 批量模拟（用于统计分析）
 * @param {number} iterations - 模拟次数
 * @param {number} pullsPerIteration - 每次模拟的抽数
 * @param {Object} rules - 卡池规则
 * @param {string} poolType - 卡池类型
 * @returns {Object} 统计结果
 */
export function runSimulationBatch(iterations = 1000, pullsPerIteration = 100, rules = LIMITED_POOL_RULES, poolType = 'limited') {
  const results = {
    totalIterations: iterations,
    pullsPerIteration,
    avgSixStarCount: 0,
    avgFiveStarCount: 0,
    avgSixStarPity: 0,
    minSixStarPity: Infinity,
    maxSixStarPity: 0,
    sixStarDistribution: {}
  };

  let totalSixStars = 0;
  let totalFiveStars = 0;
  let totalSixStarPity = 0;

  for (let i = 0; i < iterations; i++) {
    let state = {
      sixStarPity: 0,
      fiveStarPity: 0,
      isGuaranteedUp: false,
      totalPulls: 0,
      sixStarCount: 0,
      fiveStarCount: 0,
      guaranteedLimitedPity: 0,
      hasReceivedGuaranteedLimited: false,
      hasReceivedInfoBook: false
    };
    let lastSixStarPull = 0;  // 上一次六星的抽数位置

    for (let j = 0; j < pullsPerIteration; j++) {
      const result = simulateSinglePull(state, rules, poolType);

      if (result.rarity === 6) {
        const pityWhenPulled = result.totalPulls - lastSixStarPull;
        results.sixStarDistribution[pityWhenPulled] =
          (results.sixStarDistribution[pityWhenPulled] || 0) + 1;

        results.minSixStarPity = Math.min(results.minSixStarPity, pityWhenPulled);
        results.maxSixStarPity = Math.max(results.maxSixStarPity, pityWhenPulled);
        totalSixStarPity += pityWhenPulled;
        lastSixStarPull = result.totalPulls;
      }

      state = {
        ...state,
        ...result
      };
    }

    totalSixStars += state.sixStarCount;
    totalFiveStars += state.fiveStarCount;
  }

  results.avgSixStarCount = (totalSixStars / iterations).toFixed(2);
  results.avgFiveStarCount = (totalFiveStars / iterations).toFixed(2);
  results.avgSixStarPity = totalSixStars > 0 ? (totalSixStarPity / totalSixStars).toFixed(2) : 0;

  return results;
}

export default {
  calculateSixStarProbability,
  calculateFiveStarProbability,
  rollProbability,
  simulateSinglePull,
  simulateTenPull,
  simulateCharacterFreeTen,
  simulateWeaponTenPull,
  checkGuaranteedLimitedTrigger,
  checkGiftAvailable,
  checkInfoBookAvailable,
  calculateExpectedPulls,
  runSimulationBatch
};