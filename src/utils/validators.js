// 数据校验工具函数

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
