// 数据校验工具函数
import { LIMITED_POOL_RULES, STANDARD_POOL_RULES, WEAPON_POOL_RULES } from '../constants';

/**
 * 获取卡池规则
 * @param {string} poolType - 'limited' | 'standard' | 'weapon'
 * @returns {Object}
 */
export const getPoolRules = (poolType) => {
  switch (poolType) {
    case 'limited': return LIMITED_POOL_RULES;
    case 'standard': return STANDARD_POOL_RULES;
    case 'weapon': return WEAPON_POOL_RULES;
    default: return LIMITED_POOL_RULES;
  }
};

/**
 * 计算当前概率（考虑软保底）
 * @param {number} currentPity - 当前垫刀数
 * @param {string} poolType - 卡池类型
 * @returns {{probability: number, isInSoftPity: boolean, pullsUntilSoftPity: number, hasSoftPity: boolean}}
 */
export const calculateCurrentProbability = (currentPity, poolType) => {
  const rules = getPoolRules(poolType);
  const baseProbability = rules.sixStarBaseProbability;

  // 武器池没有软保底机制
  if (!rules.hasSoftPity) {
    return {
      probability: baseProbability,
      isInSoftPity: false,
      pullsUntilSoftPity: 0,
      hasSoftPity: false
    };
  }

  const softPityStart = rules.sixStarSoftPityStart;
  const softPityIncrease = rules.sixStarSoftPityIncrease;

  if (currentPity < softPityStart) {
    return {
      probability: baseProbability,
      isInSoftPity: false,
      pullsUntilSoftPity: softPityStart - currentPity,
      hasSoftPity: true
    };
  }

  // 65抽后，概率递增
  const extraPulls = currentPity - softPityStart + 1;
  const probability = Math.min(baseProbability + extraPulls * softPityIncrease, 1);

  return {
    probability,
    isInSoftPity: true,
    pullsUntilSoftPity: 0,
    hasSoftPity: true
  };
};

/**
 * 校验抽卡记录数据
 * @param {Object} data - 抽卡数据
 * @returns {{isValid: boolean, errors: string[]}}
 */
export const validatePullData = (data) => {
  const errors = [];

  // 校验 rarity
  if (![4, 5, 6].includes(data.rarity)) {
    errors.push(`无效的星级: ${data.rarity}`);
  }

  // 校验 poolId
  if (!data.poolId || typeof data.poolId !== 'string') {
    errors.push('缺少卡池ID');
  }

  // 校验 isStandard (仅6星需要)
  if (data.rarity === 6 && typeof data.isStandard !== 'boolean') {
    errors.push('6星记录需要指定是否为常驻');
  }

  // 校验 specialType
  const validSpecialTypes = [null, 'gift', 'guaranteed'];
  if (!validSpecialTypes.includes(data.specialType)) {
    errors.push(`无效的特殊类型: ${data.specialType}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * 校验录入数据是否符合卡池规则
 * @param {Object} params
 * @param {Object} params.newPull - 新录入的抽卡数据
 * @param {Array} params.existingPulls - 当前卡池已有的抽卡记录
 * @param {Array} params.allLimitedPoolPulls - 所有限定池的抽卡记录（用于跨池保底继承）
 * @param {Object} params.pool - 当前卡池信息 {type: 'limited'|'standard'|'weapon'}
 * @returns {{isValid: boolean, errors: string[], warnings: string[]}}
 */
export const validatePullAgainstRules = ({ newPull, existingPulls, allLimitedPoolPulls = [], pool }) => {
  const errors = [];
  const warnings = [];
  const rules = getPoolRules(pool.type);

  // 过滤掉赠送的记录
  const validPulls = existingPulls.filter(p => p.specialType !== 'gift');
  const currentPity = calculatePityFromHistory(validPulls);
  const currentPity5 = calculatePity5FromHistory(validPulls);

  // 1. 检查6星保底规则
  if (newPull.rarity === 6) {
    // 出6星时垫刀数 +1
    const pullsForThisSixStar = currentPity + 1;

    // 检查是否超过硬保底
    if (pullsForThisSixStar > rules.sixStarPity) {
      errors.push(`录入错误：在第 ${pullsForThisSixStar} 抽出6星，但${pool.type === 'weapon' ? '武器池' : '角色池'}最多 ${rules.sixStarPity} 抽保底`);
    }
  }

  // 2. 检查4星连续抽数（不应连续超过10抽没有5星+）
  if (newPull.rarity === 4) {
    const consecutive4Stars = currentPity5 + 1;
    if (consecutive4Stars > rules.fiveStarPity) {
      errors.push(`录入错误：已连续 ${consecutive4Stars} 抽没有5星或以上，但规则是 ${rules.fiveStarPity} 抽保底5星+`);
    }
  }

  // 3. 检查硬保底逻辑（限定池120抽、武器池80抽）
  if (pool.type === 'limited' || pool.type === 'weapon') {
    const guaranteedPity = pool.type === 'limited' ? 120 : 80;
    const totalPulls = validPulls.length + 1;

    // 检查是否已有限定
    const hasLimitedAlready = validPulls.some(p => p.rarity === 6 && !p.isStandard);

    // 如果已经到了硬保底抽数，且之前没出过限定，这抽必须是限定6星
    if (totalPulls === guaranteedPity && !hasLimitedAlready) {
      if (newPull.rarity !== 6) {
        warnings.push(`提示：第 ${guaranteedPity} 抽应为硬保底，必出6星`);
      } else if (newPull.isStandard) {
        errors.push(`录入错误：第 ${guaranteedPity} 抽为硬保底，必出限定UP，不可能是常驻`);
      }
    }

    // 如果超过硬保底抽数还没出过限定（且没有标记guaranteed），给出警告
    if (totalPulls > guaranteedPity && !hasLimitedAlready && newPull.specialType !== 'guaranteed') {
      warnings.push(`警告：已超过 ${guaranteedPity} 抽硬保底，请检查是否有遗漏的限定角色`);
    }
  }

  // 4. 检查常驻池特殊规则（不区分限定/歪）
  if (pool.type === 'standard' && newPull.rarity === 6 && !newPull.isStandard) {
    warnings.push('提示：常驻池没有限定角色，建议将此6星标记为常驻');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证十连数据
 * @param {Array} batchData - 十连数据数组
 * @param {Array} existingPulls - 已有记录
 * @param {Object} pool - 卡池信息
 * @returns {{isValid: boolean, errors: string[], warnings: string[]}}
 */
export const validateBatchAgainstRules = ({ batchData, existingPulls, pool }) => {
  const errors = [];
  const warnings = [];
  const rules = getPoolRules(pool.type);

  const validExistingPulls = existingPulls.filter(p => p.specialType !== 'gift');

  // 1. 检查十连中5星保底
  const has5StarOrAbove = batchData.some(p => p.rarity >= 5);
  if (!has5StarOrAbove && pool.type !== 'weapon') {
    // 角色池：检查是否有累积的5星保底
    const currentPity5 = calculatePity5FromHistory(validExistingPulls);
    if (currentPity5 + 10 > rules.fiveStarPity) {
      errors.push(`录入错误：此十连无5星+，但加上之前的 ${currentPity5} 抽，已超过 ${rules.fiveStarPity} 抽5星保底`);
    }
  }

  // 武器池：每十连必出5星+
  if (pool.type === 'weapon' && !has5StarOrAbove) {
    errors.push('录入错误：武器池每次申领（十连）必定有5星或以上武器');
  }

  // 2. 模拟录入，检查每一抽
  let simulatedPulls = [...validExistingPulls];
  let pity = calculatePityFromHistory(simulatedPulls);
  let pity5 = calculatePity5FromHistory(simulatedPulls);

  for (let i = 0; i < batchData.length; i++) {
    const pull = batchData[i];
    pity++;
    pity5++;

    // 检查6星保底
    if (pull.rarity === 6) {
      if (pity > rules.sixStarPity) {
        errors.push(`录入错误：第 ${simulatedPulls.length + i + 1} 抽出6星（垫刀 ${pity}），超过 ${rules.sixStarPity} 抽保底`);
      }
      pity = 0;
    }

    // 检查5星保底
    if (pull.rarity >= 5) {
      if (pity5 > rules.fiveStarPity) {
        errors.push(`录入错误：第 ${simulatedPulls.length + i + 1} 抽出${pull.rarity}星，但之前已连续 ${pity5} 抽无5星+`);
      }
      pity5 = 0;
    }

    // 检查超过5星保底
    if (pity5 > rules.fiveStarPity) {
      errors.push(`录入错误：第 ${simulatedPulls.length + i + 1} 抽（十连中第 ${i + 1} 个）后，连续 ${pity5} 抽无5星+，超过保底`);
    }
  }

  // 3. 检查硬保底逻辑
  if (pool.type === 'limited' || pool.type === 'weapon') {
    const guaranteedPity = pool.type === 'limited' ? 120 : 80;
    const startIndex = validExistingPulls.length;
    const hasLimitedBefore = validExistingPulls.some(p => p.rarity === 6 && !p.isStandard);

    if (!hasLimitedBefore) {
      // 检查这个十连是否跨越了硬保底点
      for (let i = 0; i < batchData.length; i++) {
        const globalIndex = startIndex + i + 1;
        if (globalIndex === guaranteedPity) {
          const pull = batchData[i];
          if (pull.rarity !== 6) {
            warnings.push(`提示：第 ${guaranteedPity} 抽是硬保底，应为6星`);
          } else if (pull.isStandard) {
            errors.push(`录入错误：第 ${guaranteedPity} 抽为硬保底，必出限定UP`);
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 从历史记录计算当前6星垫刀数
 * @param {Array} pulls - 抽卡记录（已过滤gift）
 * @returns {number}
 */
export const calculatePityFromHistory = (pulls) => {
  let pity = 0;
  for (let i = pulls.length - 1; i >= 0; i--) {
    if (pulls[i].rarity === 6) break;
    pity++;
  }
  return pity;
};

/**
 * 从历史记录计算当前5星垫刀数
 * @param {Array} pulls - 抽卡记录（已过滤gift）
 * @returns {number}
 */
export const calculatePity5FromHistory = (pulls) => {
  let pity = 0;
  for (let i = pulls.length - 1; i >= 0; i--) {
    if (pulls[i].rarity >= 5) break;
    pity++;
  }
  return pity;
};

/**
 * 计算跨池继承的保底数
 * @param {Array} allLimitedPools - 所有限定池
 * @param {Array} allHistory - 所有抽卡记录
 * @param {string} currentPoolId - 当前卡池ID（排除）
 * @returns {{inheritedPity: number, inheritedPity5: number}}
 */
export const calculateInheritedPity = (allLimitedPools, allHistory, currentPoolId) => {
  // 获取所有限定池的记录（排除当前池）
  const otherLimitedPoolIds = allLimitedPools
    .filter(p => p.type === 'limited' && p.id !== currentPoolId)
    .map(p => p.id);

  const otherPoolPulls = allHistory
    .filter(p => otherLimitedPoolIds.includes(p.poolId) && p.specialType !== 'gift')
    .sort((a, b) => a.id - b.id);

  if (otherPoolPulls.length === 0) {
    return { inheritedPity: 0, inheritedPity5: 0 };
  }

  // 计算最后一个限定池的垫刀数
  const inheritedPity = calculatePityFromHistory(otherPoolPulls);
  const inheritedPity5 = calculatePity5FromHistory(otherPoolPulls);

  return { inheritedPity, inheritedPity5 };
};

/**
 * 校验卡池数据
 * @param {Object} data - 卡池数据
 * @returns {{isValid: boolean, errors: string[]}}
 */
export const validatePoolData = (data) => {
  const errors = [];

  if (!data.id || typeof data.id !== 'string') {
    errors.push('缺少卡池ID');
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('卡池名称不能为空');
  }

  if (!['limited', 'standard', 'weapon'].includes(data.type)) {
    errors.push(`无效的卡池类型: ${data.type}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
