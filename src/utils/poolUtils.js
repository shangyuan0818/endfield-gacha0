import { POOL_TYPE_KEYWORDS } from '../constants/index.js';

/**
 * 统一归一化 isStandard 字段（DR-B04）
 *
 * 判断一条6星抽卡记录是否为「歪」（抽到常驻而非UP角色）
 * 非6星统一返回 false（不参与歪率计算）
 *
 * @param {object} record - 抽卡记录
 * @param {number} record.rarity - 稀有度
 * @param {string} [record.character_name] - 角色名
 * @param {string} [record.item_name] - 物品名
 * @param {string} [record.name] - 名称（兼容字段）
 * @param {boolean} [record.isLimited] - 是否限定（API 返回）
 * @param {string} poolType - 卡池类型
 * @param {string} [upCharacter] - UP 角色名
 * @returns {boolean} true = 常驻（歪了），false = UP/限定（没歪）
 */
export function normalizeIsStandard(record, poolType, upCharacter) {
  // 非6星不参与歪率计算，统一为 false
  if (record.rarity !== 6) {
    return false;
  }

  // 常驻池/新手池：6星都算常驻
  if (poolType === 'standard' || poolType === 'beginner') {
    return true;
  }

  // 限定池/武器池
  if (poolType === 'limited' || poolType === 'limited_character' ||
      poolType === 'weapon' || poolType === 'limited_weapon') {
    // 有 UP 角色信息：通过角色名匹配判断
    if (upCharacter) {
      const characterName = record.character_name || record.item_name || record.name || '';
      return !characterName.includes(upCharacter) && !upCharacter.includes(characterName);
    }
    // 无 UP 角色信息但有 isLimited 标记（API 返回）
    if (record.isLimited !== undefined) {
      return !record.isLimited;
    }
    // 无任何参考信息，默认为 UP（不歪）
    return false;
  }

  // 其他类型，默认 false
  return false;
}

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
