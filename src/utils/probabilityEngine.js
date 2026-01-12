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
 * 计算UP角色是否命中
 * @param {boolean} isGuaranteed - 是否保底必出UP
 * @param {number} upProbability - UP概率（0-1）
 * @returns {boolean} 是否为UP角色
 */
export function rollUpCharacter(isGuaranteed, upProbability = 0.5) {
  if (isGuaranteed) {
    return true;
  }
  return rollProbability(upProbability);
}

/**
 * 模拟单次抽卡
 * @param {Object} state - 当前模拟器状态
 * @param {Object} rules - 卡池规则
 * @param {string} poolType - 卡池类型
 * @param {string} currentUpCharacter - 当前UP角色（可选）
 * @returns {Object} 抽卡结果
 */
export function simulateSinglePull(state, rules = LIMITED_POOL_RULES, poolType = 'limited', currentUpCharacter = null) {
  // 增加保底计数
  const sixStarPity = state.sixStarPity + 1;
  const fiveStarPity = state.fiveStarPity + 1;
  const guaranteedLimitedPity = state.guaranteedLimitedPity + 1;

  // ========== 120抽硬保底检查（限定池）/ 80抽硬保底（武器池首轮） ==========
  // 限定池：如果已经119抽没出限定，第120抽必定是限定6星
  // 武器池：如果已经79抽没出限定，第80抽必定是限定6星
  const isLimitedPool = poolType === 'limited' || poolType === 'limited_character';
  const isWeaponPool = poolType === 'weapon' || poolType === 'limited_weapon';

  const shouldTriggerGuaranteedLimited =
    !state.hasReceivedGuaranteedLimited &&
    guaranteedLimitedPity >= rules.guaranteedLimitedPity;

  if (shouldTriggerGuaranteedLimited) {
    // 触发硬保底，必出限定6星
    const upChar = currentUpCharacter || getCurrentUpCharacter();
    const characterName = getCharacterName(poolType, 6, true, upChar);

    return {
      rarity: 6,
      isUp: true,
      isLimited: true,
      characterName,
      sixStarPity: 0,
      fiveStarPity: 0,
      isGuaranteedUp: false,          // 重置大保底状态
      totalPulls: state.totalPulls + 1,
      sixStarCount: state.sixStarCount + 1,
      fiveStarCount: state.fiveStarCount,
      guaranteedLimitedPity: 0,       // 重置120/80抽计数
      hasReceivedGuaranteedLimited: true  // 标记已触发
    };
  }
  // ========== 硬保底检查结束 ==========

  // 计算概率
  const sixStarProb = calculateSixStarProbability(sixStarPity, rules);
  const fiveStarProb = calculateFiveStarProbability(fiveStarPity, rules);

  // 判断是否出6星
  if (rollProbability(sixStarProb)) {
    // 判断是否为UP角色
    const isUp = rollUpCharacter(state.isGuaranteedUp, rules.upProbability);

    // 获取当前UP角色名称
    const upChar = currentUpCharacter || getCurrentUpCharacter();
    const characterName = getCharacterName(poolType, 6, isUp, upChar);

    // 如果出了限定，重置120/80抽计数
    const shouldResetGuaranteedPity = isUp;

    return {
      rarity: 6,
      isUp,
      isLimited: isUp,
      characterName,
      sixStarPity: 0,              // 重置6星保底
      fiveStarPity: 0,              // 出6星时也重置5星保底
      isGuaranteedUp: isUp ? state.isGuaranteedUp : true, // 如果歪了，下次保底
      totalPulls: state.totalPulls + 1,
      sixStarCount: state.sixStarCount + 1,
      fiveStarCount: state.fiveStarCount,
      guaranteedLimitedPity: shouldResetGuaranteedPity ? 0 : guaranteedLimitedPity,  // 出限定时重置
      hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited  // 保持状态
    };
  }

  // 判断是否出5星
  if (rollProbability(fiveStarProb)) {
    const characterName = getCharacterName(poolType, 5, false);

    return {
      rarity: 5,
      isUp: false,
      isLimited: false,
      characterName,
      sixStarPity,
      fiveStarPity: 0,              // 重置5星保底
      isGuaranteedUp: state.isGuaranteedUp,
      totalPulls: state.totalPulls + 1,
      sixStarCount: state.sixStarCount,
      fiveStarCount: state.fiveStarCount + 1,
      guaranteedLimitedPity,         // 继续累加120/80抽计数
      hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
    };
  }

  // 其他情况为4星（去掉三星）
  const characterName = getCharacterName(poolType, 4, false);

  return {
    rarity: 4,
    isUp: false,
    isLimited: false,
    characterName,
    sixStarPity,
    fiveStarPity,
    isGuaranteedUp: state.isGuaranteedUp,
    totalPulls: state.totalPulls + 1,
    sixStarCount: state.sixStarCount,
    fiveStarCount: state.fiveStarCount,
    guaranteedLimitedPity,         // 继续累加120/80抽计数
    hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
  };
}

/**
 * 模拟十连抽卡
 * @param {Object} state - 当前模拟器状态
 * @param {Object} rules - 卡池规则
 * @param {string} poolType - 卡池类型
 * @param {string} currentUpCharacter - 当前UP角色（可选）
 * @returns {Array} 十连抽卡结果数组
 */
export function simulateTenPull(state, rules = LIMITED_POOL_RULES, poolType = 'limited', currentUpCharacter = null) {
  const results = [];
  let currentState = { ...state };

  for (let i = 0; i < 10; i++) {
    const result = simulateSinglePull(currentState, rules, poolType, currentUpCharacter);
    results.push(result);

    // 更新状态用于下一抽
    currentState = {
      sixStarPity: result.sixStarPity,
      fiveStarPity: result.fiveStarPity,
      isGuaranteedUp: result.isGuaranteedUp,
      totalPulls: result.totalPulls,
      sixStarCount: result.sixStarCount,
      fiveStarCount: result.fiveStarCount,
      guaranteedLimitedPity: result.guaranteedLimitedPity
    };
  }

  return results;
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

    for (let j = 0; j < pullsPerIteration; j++) {
      const result = simulateSinglePull(state, rules, poolType);

      if (result.rarity === 6) {
        const pityWhenPulled = result.totalPulls - state.totalPulls;
        results.sixStarDistribution[pityWhenPulled] =
          (results.sixStarDistribution[pityWhenPulled] || 0) + 1;

        results.minSixStarPity = Math.min(results.minSixStarPity, pityWhenPulled);
        results.maxSixStarPity = Math.max(results.maxSixStarPity, pityWhenPulled);
        totalSixStarPity += pityWhenPulled;
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
  rollUpCharacter,
  simulateSinglePull,
  simulateTenPull,
  checkGuaranteedLimitedTrigger,
  checkGiftAvailable,
  checkInfoBookAvailable,
  calculateExpectedPulls,
  runSimulationBatch
};
