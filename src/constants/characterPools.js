/**
 * 角色池配置
 *
 * 定义各卡池中可获取的角色列表
 */

// ============================================
// 限定角色池
// ============================================

// 限定UP角色（轮换）
export const LIMITED_UP_CHARACTERS = {
  6: ['莱万汀', '伊冯', '洁尔佩塔']
};

// 限定池可歪6星角色（常驻角色）
export const LIMITED_OFF_BANNER_CHARACTERS = {
  6: ['余烬', '黎风', '艾尔黛拉', '别礼', '骏卫']
};

// 限定池所有可能的6星（UP + 常驻）
export const LIMITED_ALL_SIX_STAR = [
  ...LIMITED_UP_CHARACTERS[6],
  ...LIMITED_OFF_BANNER_CHARACTERS[6]
];

// 限定池5星角色
export const LIMITED_FIVE_STAR_CHARACTERS = [
  '佩丽卡', '弧光', '艾维文娜', '大潘', '陈千语',
  '狼卫', '赛希', '昼雪', '阿列什'
];

// 限定池4星角色
export const LIMITED_FOUR_STAR_CHARACTERS = [
  '秋栗', '卡契尔', '埃特拉', '萤石', '安塔尔'
];

// ============================================
// 常驻角色池
// ============================================

// 常驻池6星角色
export const STANDARD_SIX_STAR_CHARACTERS = [
  '艾尔黛拉', '骏卫', '别礼', '余烬', '黎风'
];

// 常驻池5星角色（与限定池相同）
export const STANDARD_FIVE_STAR_CHARACTERS = [
  '佩丽卡', '弧光', '艾维文娜', '大潘', '陈千语',
  '狼卫', '赛希', '昼雪', '阿列什'
];

// 常驻池4星角色（与限定池相同）
export const STANDARD_FOUR_STAR_CHARACTERS = [
  '秋栗', '卡契尔', '埃特拉', '萤石', '安塔尔'
];

// ============================================
// 武器池（暂不实现具体武器名称）
// ============================================

// 武器池配置
export const WEAPON_POOL_PLACEHOLDERS = {
  6: ['6星武器'],
  5: ['5星武器'],
  4: ['4星武器']
};

// 武器池 - UP限定6星武器（只有1把）
export const LIMITED_WEAPON_SIX_STAR = [
  '6星限定武器'
];

// 武器池 - 常驻6星武器（6把）
export const STANDARD_WEAPON_SIX_STAR = [
  '6星常驻武器-1',
  '6星常驻武器-2',
  '6星常驻武器-3',
  '6星常驻武器-4',
  '6星常驻武器-5',
  '6星常驻武器-6'
];

// 武器池 - 5星武器（与限定池5星角色数量一致：9个）
export const WEAPON_FIVE_STAR = [
  '5星武器-1',
  '5星武器-2',
  '5星武器-3',
  '5星武器-4',
  '5星武器-5',
  '5星武器-6',
  '5星武器-7',
  '5星武器-8',
  '5星武器-9'
];

// 武器池 - 4星武器（与限定池4星角色数量一致：5个）
export const WEAPON_FOUR_STAR = [
  '4星武器-1',
  '4星武器-2',
  '4星武器-3',
  '4星武器-4',
  '4星武器-5'
];

// ============================================
// 工具函数
// ============================================

/**
 * 从数组中随机选择一个元素
 * @param {Array} array - 源数组
 * @returns {*} 随机选中的元素
 */
export function randomChoice(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 根据卡池类型和星级获取角色名称
 * @param {string} poolType - 卡池类型 ('limited', 'standard', 'weapon')
 * @param {number} rarity - 星级 (4, 5, 6)
 * @param {boolean} isUp - 是否为UP角色（仅限定池6星有效）
 * @param {string} currentUpCharacter - 当前UP角色名称（必须传入）
 * @returns {string} 角色名称
 */
export function getCharacterName(poolType, rarity, isUp = false, currentUpCharacter = null) {
  // 武器池处理（修复：区分UP限定武器和常驻武器）
  if (poolType === 'weapon' || poolType === 'limited_weapon') {
    if (rarity === 6) {
      // 6星武器：25% UP限定，75% 常驻
      if (isUp) {
        return randomChoice(LIMITED_WEAPON_SIX_STAR);  // 返回限定6星武器
      } else {
        return randomChoice(STANDARD_WEAPON_SIX_STAR);  // 返回常驻6星武器
      }
    } else if (rarity === 5) {
      return randomChoice(WEAPON_FIVE_STAR);
    } else if (rarity === 4) {
      return randomChoice(WEAPON_FOUR_STAR);
    }
    // 其他星级返回占位符
    return WEAPON_POOL_PLACEHOLDERS[rarity]?.[0] || `${rarity}星`;
  }

  // 限定池
  if (poolType === 'limited' || poolType === 'limited_character') {
    if (rarity === 6) {
      if (isUp) {
        // 必须有明确的UP角色
        if (!currentUpCharacter) {
          console.warn('限定池抽到UP但未指定UP角色，使用默认');
          return randomChoice(LIMITED_UP_CHARACTERS[6]);
        }
        return currentUpCharacter;
      } else {
        // 歪了，从所有6星中随机选择（排除当前UP角色）
        const allSixStar = LIMITED_ALL_SIX_STAR.filter(char => char !== currentUpCharacter);
        return randomChoice(allSixStar);
      }
    } else if (rarity === 5) {
      return randomChoice(LIMITED_FIVE_STAR_CHARACTERS);
    } else if (rarity === 4) {
      return randomChoice(LIMITED_FOUR_STAR_CHARACTERS);
    }
  }

  // 常驻池
  if (poolType === 'standard' || poolType === 'standard_pool') {
    if (rarity === 6) {
      return randomChoice(STANDARD_SIX_STAR_CHARACTERS);
    } else if (rarity === 5) {
      return randomChoice(STANDARD_FIVE_STAR_CHARACTERS);
    } else if (rarity === 4) {
      return randomChoice(STANDARD_FOUR_STAR_CHARACTERS);
    }
  }

  return `${rarity}星`;
}

/**
 * 获取当前UP角色（根据时间判断）
 * @returns {string} 当前UP角色名称
 */
export function getCurrentUpCharacter() {
  // 导入 LIMITED_POOL_SCHEDULE
  const now = new Date();

  // 简化版本：根据日期判断
  // 莱万汀：2025-11-28 ~ 2025-12-12
  // 伊冯：2025-12-12 ~ 2025-12-26
  // 洁尔佩塔：2025-12-26 ~ 2025-12-29

  const schedule = [
    { name: '莱万汀', start: '2025-11-28T11:00:00+08:00', end: '2025-12-12T13:59:59+08:00' },
    { name: '伊冯', start: '2025-12-12T14:00:00+08:00', end: '2025-12-26T13:59:59+08:00' },
    { name: '洁尔佩塔', start: '2025-12-26T14:00:00+08:00', end: '2025-12-29T14:00:00+08:00' }
  ];

  for (const pool of schedule) {
    const start = new Date(pool.start);
    const end = new Date(pool.end);
    if (now >= start && now < end) {
      return pool.name;
    }
  }

  // 默认返回莱万汀（如果都不匹配）
  return '莱万汀';
}

export default {
  LIMITED_UP_CHARACTERS,
  LIMITED_OFF_BANNER_CHARACTERS,
  LIMITED_ALL_SIX_STAR,
  LIMITED_FIVE_STAR_CHARACTERS,
  LIMITED_FOUR_STAR_CHARACTERS,
  STANDARD_SIX_STAR_CHARACTERS,
  STANDARD_FIVE_STAR_CHARACTERS,
  STANDARD_FOUR_STAR_CHARACTERS,
  WEAPON_POOL_PLACEHOLDERS,
  randomChoice,
  getCharacterName,
  getCurrentUpCharacter
};
