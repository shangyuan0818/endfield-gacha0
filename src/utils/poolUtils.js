import { POOL_TYPE_KEYWORDS } from '../constants';

/**
 * 从卡池名称中提取抽卡人
 * 支持格式: "类型-角色名-抽卡人", "类型-抽卡人", "任意名称-抽卡人"
 * @param {string} poolName - 卡池名称
 * @returns {string|null}
 */
export const extractDrawerFromPoolName = (poolName) => {
  if (!poolName || typeof poolName !== 'string') return null;

  const parts = poolName.split('-').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length < 2) return null;

  // 从后往前找，排除类型关键词
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const isTypeKeyword = POOL_TYPE_KEYWORDS.some(keyword => part.includes(keyword));
    // 抽卡人名称通常较短（1-10字符），且不包含类型关键词
    if (!isTypeKeyword && part.length >= 1 && part.length <= 10) {
      return part;
    }
  }

  return null;
};

/**
 * 从卡池名称中提取角色名（中间部分）
 * @param {string} poolName - 卡池名称
 * @returns {string|null}
 */
export const extractCharNameFromPoolName = (poolName) => {
  if (!poolName || typeof poolName !== 'string') return null;

  const parts = poolName.split('-').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length < 3) return null;

  // 格式: 类型-角色名-抽卡人，角色名在中间
  const middlePart = parts[1];
  const isTypeKeyword = POOL_TYPE_KEYWORDS.some(keyword => middlePart.includes(keyword));
  if (!isTypeKeyword && middlePart.length >= 1) {
    return middlePart;
  }

  return null;
};

/**
 * 从卡池名称中提取类型
 * @param {string} poolName - 卡池名称
 * @returns {'limited'|'standard'|'weapon'}
 */
export const extractTypeFromPoolName = (poolName) => {
  if (!poolName || typeof poolName !== 'string') return 'limited';

  const lowerName = poolName.toLowerCase();
  if (lowerName.includes('常驻')) return 'standard';
  if (lowerName.includes('武器')) return 'weapon';
  return 'limited';
};

/**
 * 按抽卡人分组卡池
 * @param {Array} pools - 卡池列表
 * @returns {Object} 分组后的卡池 {drawer: pools[]}
 */
export const groupPoolsByDrawer = (pools) => {
  const groups = {};

  pools.forEach(pool => {
    const drawer = extractDrawerFromPoolName(pool.name) || '未分组';
    if (!groups[drawer]) {
      groups[drawer] = [];
    }
    groups[drawer].push(pool);
  });

  return groups;
};
