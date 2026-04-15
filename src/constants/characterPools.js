/**
 * 角色池配置
 *
 * 定义各卡池中可获取的角色列表
 * FEAT-007 扩展：改为从数据库动态读取，支持角色轮换移出机制
 */

import { getPoolCharacters } from '../utils/characterUtils.js';
import usePoolStore from '../stores/usePoolStore.js';
import { getCurrentUpPoolInfo, getCurrentUpPoolName } from '../utils/poolTimeUtils.js';
import appLogger from '../utils/appLogger.js';

function getStorePoolsArray() {
  const storePools = usePoolStore.getState?.().pools;
  return Array.isArray(storePools) ? storePools : Object.values(storePools || {});
}

function getCurrentLimitedPoolContext() {
  const pools = getStorePoolsArray();
  const currentUpInfo = getCurrentUpPoolInfo(pools);
  const startTime = currentUpInfo?.poolData?.start_time || currentUpInfo?.startDate;

  if (!startTime) {
    return null;
  }

  return {
    start_time: startTime,
    rotation_position: currentUpInfo?.rotationPosition,
  };
}

// ============================================
// 限定角色池（动态读取）
// ============================================

/**
 * 获取限定池UP角色列表（6星）
 * @returns {Array<string>} 角色名称数组
 */
function getLimitedUpCharactersList() {
  const chars = getPoolCharacters('limited', 6, true, getCurrentLimitedPoolContext())
    .filter(char => char.is_limited);
  return chars.map(char => char.name);
}

/**
 * 获取限定池可歪角色列表（6星常驻）
 * @returns {Array<string>} 角色名称数组
 */
function getLimitedOffBannerCharactersList() {
  const chars = getPoolCharacters('limited', 6, true, getCurrentLimitedPoolContext())
    .filter(char => !char.is_limited);
  return chars.map(char => char.name);
}

/**
 * 获取限定池所有6星角色（UP + 常驻）
 * @returns {Array<string>} 角色名称数组
 */
function getLimitedAllSixStarList() {
  const chars = getPoolCharacters('limited', 6, true, getCurrentLimitedPoolContext());
  return chars.map(char => char.name);
}

/**
 * 获取限定池5星角色列表
 * @returns {Array<string>} 角色名称数组
 */
function getLimitedFiveStarList() {
  const chars = getPoolCharacters('limited', 5, true, getCurrentLimitedPoolContext());
  return chars.map(char => char.name);
}

/**
 * 获取限定池4星角色列表
 * @returns {Array<string>} 角色名称数组
 */
function getLimitedFourStarList() {
  const chars = getPoolCharacters('limited', 4, true, getCurrentLimitedPoolContext());
  return chars.map(char => char.name);
}

// 向后兼容：使用 getter 动态读取
export const LIMITED_UP_CHARACTERS = {
  get 6() {
    return getLimitedUpCharactersList();
  }
};

export const LIMITED_OFF_BANNER_CHARACTERS = {
  get 6() {
    return getLimitedOffBannerCharactersList();
  }
};

// 限定池所有可能的6星（UP + 常驻）
export const LIMITED_ALL_SIX_STAR = new Proxy([], {
  get(target, prop) {
    // 拦截数组访问，动态返回最新数据
    const list = getLimitedAllSixStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 限定池5星角色
export const LIMITED_FIVE_STAR_CHARACTERS = new Proxy([], {
  get(target, prop) {
    const list = getLimitedFiveStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 限定池4星角色
export const LIMITED_FOUR_STAR_CHARACTERS = new Proxy([], {
  get(target, prop) {
    const list = getLimitedFourStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// ============================================
// 常驻角色池（动态读取）
// ============================================

/**
 * 获取常驻池6星角色列表
 * @returns {Array<string>} 角色名称数组
 */
function getStandardSixStarList() {
  const chars = getPoolCharacters('standard', 6, false);
  return chars.map(char => char.name);
}

/**
 * 获取常驻池5星角色列表
 * @returns {Array<string>} 角色名称数组
 */
function getStandardFiveStarList() {
  const chars = getPoolCharacters('standard', 5, false);
  return chars.map(char => char.name);
}

/**
 * 获取常驻池4星角色列表
 * @returns {Array<string>} 角色名称数组
 */
function getStandardFourStarList() {
  const chars = getPoolCharacters('standard', 4, false);
  return chars.map(char => char.name);
}

// 常驻池6星角色
export const STANDARD_SIX_STAR_CHARACTERS = new Proxy([], {
  get(target, prop) {
    const list = getStandardSixStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 常驻池5星角色（与限定池相同）
export const STANDARD_FIVE_STAR_CHARACTERS = new Proxy([], {
  get(target, prop) {
    const list = getStandardFiveStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 常驻池4星角色（与限定池相同）
export const STANDARD_FOUR_STAR_CHARACTERS = new Proxy([], {
  get(target, prop) {
    const list = getStandardFourStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// ============================================
// 武器池（保持占位符）
// ============================================

/**
 * 获取武器池6星武器列表
 * @param {boolean} isLimited - 是否限定武器
 * @returns {Array<string>} 武器名称数组
 */
function getWeaponSixStarList(isLimited = false) {
  const chars = getPoolCharacters('weapon', 6, false)
    .filter(char => char.is_limited === isLimited);
  
  return chars.map(char => char.name);
}

/**
 * 获取武器池5星武器列表
 * @returns {Array<string>} 武器名称数组
 */
function getWeaponFiveStarList() {
  const chars = getPoolCharacters('weapon', 5, false);
  return chars.map(char => char.name);
}

/**
 * 获取武器池4星武器列表
 * @returns {Array<string>} 武器名称数组
 */
function getWeaponFourStarList() {
  const chars = getPoolCharacters('weapon', 4, false);
  return chars.map(char => char.name);
}

// 武器池配置
export const WEAPON_POOL_PLACEHOLDERS = {
  6: ['6星武器'],
  5: ['5星武器'],
  4: ['4星武器']
};

// 武器池 - UP限定6星武器（只有1把）
export const LIMITED_WEAPON_SIX_STAR = new Proxy([], {
  get(target, prop) {
    const list = getWeaponSixStarList(true);
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 武器池 - 常驻6星武器（6把）
export const STANDARD_WEAPON_SIX_STAR = new Proxy([], {
  get(target, prop) {
    const list = getWeaponSixStarList(false);
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 武器池 - 5星武器
export const WEAPON_FIVE_STAR = new Proxy([], {
  get(target, prop) {
    const list = getWeaponFiveStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

// 武器池 - 4星武器
export const WEAPON_FOUR_STAR = new Proxy([], {
  get(target, prop) {
    const list = getWeaponFourStarList();
    if (prop === 'length') return list.length;
    if (prop === Symbol.iterator) return list[Symbol.iterator].bind(list);
    if (typeof prop === 'string' && !isNaN(prop)) return list[parseInt(prop)];
    return list[prop];
  }
});

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
 * @param {Object} poolCharactersList - 可选：卡池角色列表 {up: [], offBanner: [], fiveStar: [], fourStar: []}
 * @returns {string} 角色名称
 */
export function getCharacterName(poolType, rarity, isUp = false, currentUpCharacter = null, poolCharactersList = null) {
  // 如果提供了卡池角色列表，优先使用（完全信任，不使用后备逻辑）
  if (poolCharactersList) {
    if (rarity === 6) {
      if (isUp) {
        // UP角色/武器
        if (poolCharactersList.up?.length > 0) {
          return randomChoice(poolCharactersList.up.map(c => c.name));
        }
        // 如果UP列表为空，返回占位符（避免跨池污染）
        return `${rarity}星UP`;
      } else {
        // 非UP的6星
        if (poolCharactersList.offBanner?.length > 0) {
          return randomChoice(poolCharactersList.offBanner.map(c => c.name));
        }
        // 如果offBanner列表为空，返回占位符（避免跨池污染）
        return `${rarity}星`;
      }
    } else if (rarity === 5) {
      if (poolCharactersList.fiveStar?.length > 0) {
        return randomChoice(poolCharactersList.fiveStar.map(c => c.name));
      }
      return `${rarity}星`;
    } else if (rarity === 4) {
      if (poolCharactersList.fourStar?.length > 0) {
        return randomChoice(poolCharactersList.fourStar.map(c => c.name));
      }
      return `${rarity}星`;
    }
    // 其他稀有度返回占位符
    return `${rarity}星`;
  }

  // 武器池处理（修复：区分UP限定武器和常驻武器）
  if (poolType === 'weapon' || poolType === 'limited_weapon') {
    if (rarity === 6) {
      // 6星武器：25% UP限定，75% 常驻
      if (isUp) {
        return randomChoice([...LIMITED_WEAPON_SIX_STAR]);  // 返回限定6星武器
      } else {
        return randomChoice([...STANDARD_WEAPON_SIX_STAR]);  // 返回常驻6星武器
      }
    } else if (rarity === 5) {
      return randomChoice([...WEAPON_FIVE_STAR]);
    } else if (rarity === 4) {
      return randomChoice([...WEAPON_FOUR_STAR]);
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
          appLogger.warn('限定池抽到UP但未指定UP角色，使用默认');
          return randomChoice([...LIMITED_UP_CHARACTERS[6]]);
        }
        return currentUpCharacter;
      } else {
        // 歪了，从所有6星中随机选择（排除当前UP角色）
        const allSixStar = [...LIMITED_ALL_SIX_STAR].filter(char => char !== currentUpCharacter);
        return randomChoice(allSixStar);
      }
    } else if (rarity === 5) {
      return randomChoice([...LIMITED_FIVE_STAR_CHARACTERS]);
    } else if (rarity === 4) {
      return randomChoice([...LIMITED_FOUR_STAR_CHARACTERS]);
    }
  }

  // 常驻池
  if (poolType === 'standard' || poolType === 'standard_pool') {
    if (rarity === 6) {
      return randomChoice([...STANDARD_SIX_STAR_CHARACTERS]);
    } else if (rarity === 5) {
      return randomChoice([...STANDARD_FIVE_STAR_CHARACTERS]);
    } else if (rarity === 4) {
      return randomChoice([...STANDARD_FOUR_STAR_CHARACTERS]);
    }
  }

  return `${rarity}星`;
}

/**
 * 获取当前UP角色（根据时间判断）
 * @returns {string} 当前UP角色名称
 */
export function getCurrentUpCharacter() {
  return getCurrentUpPoolName(getStorePoolsArray()) || '莱万汀';
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
