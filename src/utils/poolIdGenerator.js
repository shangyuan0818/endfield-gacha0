/**
 * @file poolIdGenerator.js
 * @description 语义化卡池ID生成工具
 * @date 2026-01-11
 * @feat FEAT-007 卡池详情系统重构 - 卡池ID重构
 */

import { extractCharNameFromPoolName } from './index';

/**
 * 中文转拼音映射表（常用角色名）
 * 未来可扩展为完整的拼音库
 */
const PINYIN_MAP = {
  // 三测角色
  '莱万汀': 'levantin',
  '莱万丁': 'levantin',
  '杨颜': 'yangyan',
  '阳炎': 'yangyan',
  '伊冯': 'yiwen',
  '伊文': 'yiwen',
  '洁尔佩塔': 'jerpeta',

  // 常驻角色（示例）
  '艾拉': 'aila',
  '薇薇安': 'vivian',
  '索菲亚': 'sophia',
  '凯瑟琳': 'catherine',

  // 武器（示例）
  '枪刃': 'gunblade',
  '狙击枪': 'sniper',
  '霰弹枪': 'shotgun',

  // 通用
  '常驻': 'standard',
  '限定': 'limited',
  '武器': 'weapon',
  '主要': 'main',
};

/**
 * 将中文文本转换为URL友好的slug
 * @param {string} text - 中文文本
 * @returns {string} 拼音slug
 */
export function slugify(text) {
  if (!text) return 'unknown';

  // 1. 查找精确匹配
  if (PINYIN_MAP[text]) {
    return PINYIN_MAP[text];
  }

  // 2. 查找部分匹配（如"莱万汀-UP池" -> "levantin"）
  for (const [chinese, pinyin] of Object.entries(PINYIN_MAP)) {
    if (text.includes(chinese)) {
      return pinyin;
    }
  }

  // 3. 如果是英文，转小写并替换空格
  if (/^[a-zA-Z0-9\s-]+$/.test(text)) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  // 4. 降级处理：保留数字和字母
  const fallback = text
    .replace(/[^\w\d]/g, '')
    .toLowerCase()
    .slice(0, 10);

  return fallback || 'pool';
}

/**
 * 生成语义化卡池ID
 *
 * 格式：{shortUserId}_{type}_{charSlug}_{index}
 * 示例：u8a3f_limited_levantin_1
 *
 * @param {Object} poolData - 卡池数据
 * @param {string} poolData.name - 卡池名称，如 "限定-莱万汀-Me"
 * @param {string} poolData.type - 卡池类型（'limited'|'weapon'|'standard'）
 * @param {string} userId - 用户ID（完整UUID）
 * @param {Array<Object>} existingPools - 现有卡池列表（用于判重）
 * @returns {string} 语义化ID
 */
export function generateSemanticPoolId(poolData, userId, existingPools = []) {
  const { type, name } = poolData;

  // 1. 生成用户ID短标识（取前5位）
  const shortUserId = userId ? userId.slice(0, 5) : 'guest';

  // 2. 从卡池名称提取角色名
  let charName = extractCharNameFromPoolName(name);

  // 如果没有识别到角色名，尝试从名称中提取
  if (!charName) {
    // 尝试识别常见模式："限定-角色名-抽卡人" 或 "武器-武器名-抽卡人"
    const match = name.match(/^(限定|武器|常驻)[-\s]*([\u4e00-\u9fa5a-zA-Z]+)/);
    if (match) {
      charName = match[2];
    }
  }

  const charSlug = charName ? slugify(charName) : 'main';

  // 3. 计算同类卡池序号（避免ID冲突）
  const baseId = `${shortUserId}_${type}_${charSlug}`;
  const sameTypeCount = existingPools.filter(p =>
    p.id && p.id.startsWith(baseId)
  ).length;

  const index = sameTypeCount + 1;

  // 4. 拼接最终ID
  return `${baseId}_${index}`;
}

/**
 * 为常驻池生成特殊ID（无需角色名）
 * @param {string} userId - 用户ID
 * @param {Array<Object>} existingPools - 现有卡池列表
 * @returns {string} 常驻池ID
 */
export function generateStandardPoolId(userId, existingPools = []) {
  const shortUserId = userId ? userId.slice(0, 5) : 'guest';
  const baseId = `${shortUserId}_standard_main`;

  // 检查是否已存在同名池
  const sameTypeCount = existingPools.filter(p =>
    p.id && p.id.startsWith(baseId)
  ).length;

  if (sameTypeCount === 0) {
    return baseId;
  }

  return `${baseId}_${sameTypeCount + 1}`;
}

/**
 * 判断ID是否为旧格式（时间戳）
 * @param {string} poolId - 卡池ID
 * @returns {boolean} 是否为旧格式
 */
export function isLegacyPoolId(poolId) {
  if (!poolId) return false;

  // 旧格式：pool_1234567890123 (13位时间戳)
  return /^pool_\d{13}$/.test(poolId);
}

/**
 * 判断ID是否为语义化格式
 * @param {string} poolId - 卡池ID
 * @returns {boolean} 是否为语义化格式
 */
export function isSemanticPoolId(poolId) {
  if (!poolId) return false;

  // 语义化格式：userId_type_charSlug_index
  return /^[a-z0-9]{5}_[a-z]+_[a-z0-9-]+_\d+$/.test(poolId);
}

/**
 * 从语义化ID解析出组成部分
 * @param {string} poolId - 语义化卡池ID
 * @returns {Object|null} 解析结果 { userId, type, charSlug, index }
 */
export function parseSemanticPoolId(poolId) {
  if (!isSemanticPoolId(poolId)) {
    return null;
  }

  const parts = poolId.split('_');
  if (parts.length < 4) {
    return null;
  }

  return {
    userId: parts[0],
    type: parts[1],
    charSlug: parts.slice(2, -1).join('_'), // 处理 charSlug 中可能有的下划线
    index: parseInt(parts[parts.length - 1], 10)
  };
}

/**
 * 生成用户友好的卡池显示名称
 * @param {string} poolId - 语义化卡池ID
 * @returns {string} 显示名称
 */
export function getPoolDisplayName(poolId) {
  const parsed = parseSemanticPoolId(poolId);
  if (!parsed) {
    return poolId; // 降级：直接显示原ID
  }

  const { type, charSlug, index } = parsed;

  // 类型映射
  const typeMap = {
    limited: '限定',
    weapon: '武器',
    standard: '常驻'
  };

  // 角色名逆向查找（从 PINYIN_MAP）
  const charNameMap = Object.fromEntries(
    Object.entries(PINYIN_MAP).map(([k, v]) => [v, k])
  );

  const typeName = typeMap[type] || type;
  const charName = charNameMap[charSlug] || charSlug;

  if (index === 1) {
    return `${typeName}-${charName}`;
  } else {
    return `${typeName}-${charName}-${index}`;
  }
}

/**
 * 批量生成卡池ID（用于导入时）
 * @param {Array<Object>} pools - 卡池列表
 * @param {string} userId - 用户ID
 * @returns {Array<Object>} 添加了ID的卡池列表
 */
export function batchGeneratePoolIds(pools, userId) {
  const result = [];
  const processed = [];

  for (const pool of pools) {
    // 如果已有ID且为语义化格式，保留
    if (pool.id && isSemanticPoolId(pool.id)) {
      result.push(pool);
      processed.push(pool);
      continue;
    }

    // 生成新ID
    const newId = generateSemanticPoolId(pool, userId, [...result, ...processed]);
    result.push({
      ...pool,
      id: newId,
      legacy_pool_id: isLegacyPoolId(pool.id) ? pool.id : null
    });
    processed.push(result[result.length - 1]);
  }

  return result;
}

/**
 * 验证卡池ID的唯一性
 * @param {string} poolId - 待验证的ID
 * @param {Array<Object>} existingPools - 现有卡池列表
 * @returns {boolean} 是否唯一
 */
export function isPoolIdUnique(poolId, existingPools = []) {
  return !existingPools.some(p => p.id === poolId);
}

/**
 * 生成唯一的卡池ID（如果冲突，自动递增）
 * @param {Object} poolData - 卡池数据
 * @param {string} userId - 用户ID
 * @param {Array<Object>} existingPools - 现有卡池列表
 * @returns {string} 唯一的卡池ID
 */
export function generateUniquePoolId(poolData, userId, existingPools = []) {
  let poolId = generateSemanticPoolId(poolData, userId, existingPools);

  // 如果冲突，尝试最多10次
  let attempts = 0;
  while (!isPoolIdUnique(poolId, existingPools) && attempts < 10) {
    attempts++;
    // 在末尾追加随机后缀
    poolId = `${poolId}_${Math.floor(Math.random() * 100)}`;
  }

  if (!isPoolIdUnique(poolId, existingPools)) {
    // 最后的降级方案：使用时间戳
    return `pool_${Date.now()}`;
  }

  return poolId;
}

/**
 * 测试函数：生成示例ID
 */
export function generateExamples() {
  const userId = 'a1b2c3d4-1234-5678-1234-567890abcdef';
  const pools = [
    { name: '限定-莱万汀-Me', type: 'limited' },
    { name: '限定-杨颜-张三', type: 'limited' },
    { name: '武器-枪刃-李四', type: 'weapon' },
    { name: '常驻-主池', type: 'standard' },
  ];

  console.log('=== 语义化ID生成示例 ===');
  const existingPools = [];
  pools.forEach(pool => {
    const id = generateSemanticPoolId(pool, userId, existingPools);
    console.log(`${pool.name} -> ${id}`);
    existingPools.push({ ...pool, id });
  });

  console.log('\n=== 显示名称示例 ===');
  existingPools.forEach(pool => {
    const displayName = getPoolDisplayName(pool.id);
    console.log(`${pool.id} -> ${displayName}`);
  });
}

// 开发环境下暴露测试函数
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__poolIdGeneratorTest = generateExamples;
}
