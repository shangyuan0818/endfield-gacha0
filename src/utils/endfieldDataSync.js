/**
 * EndfieldTools 数据同步工具
 * 从 endfieldtools.dev 获取角色和武器数据
 *
 * 数据源:
 * - 角色列表: /localdb/optimized/characters/characters-list.json
 * - 武器列表: /localdb/optimized/weapons/weapons-list.json
 * - 中文翻译: /localdb/optimized/i18n/I18nTextTable_CN.json
 */

const API_BASE = 'https://endfieldtools.dev';

// API 端点
const ENDPOINTS = {
  characters: '/localdb/optimized/characters/characters-list.json',
  weapons: '/localdb/optimized/weapons/weapons-list.json',
  i18n_cn: '/localdb/optimized/i18n/I18nTextTable_CN.json',
};

// 图片 URL 模板
const IMAGE_URLS = {
  character: (charId) => `${API_BASE}/assets/images/endfield/charicon/icon_${charId}.png`,
  weapon: (weaponId) => `${API_BASE}/assets/images/endfield/itemicon/${weaponId}.png`,
};

// 缓存
let i18nCache = null;

/**
 * 获取中文翻译表
 * @returns {Promise<Object>} - i18n 翻译映射表
 */
export async function fetchI18nTable() {
  if (i18nCache) return i18nCache;

  try {
    const response = await fetch(`${API_BASE}${ENDPOINTS.i18n_cn}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    i18nCache = await response.json();
    return i18nCache;
  } catch (error) {
    console.error('获取中文翻译表失败:', error);
    throw error;
  }
}

/**
 * 获取角色列表原始数据
 * @returns {Promise<Object>} - 角色原始数据对象
 */
export async function fetchCharacterList() {
  try {
    const response = await fetch(`${API_BASE}${ENDPOINTS.characters}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取角色列表失败:', error);
    throw error;
  }
}

/**
 * 获取武器列表原始数据
 * @returns {Promise<Object>} - 武器原始数据对象
 */
export async function fetchWeaponList() {
  try {
    const response = await fetch(`${API_BASE}${ENDPOINTS.weapons}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取武器列表失败:', error);
    throw error;
  }
}

// 需要排除的角色（管理员/玩家角色，不是可抽取的）
const EXCLUDED_CHARACTERS = [
  'chr_9001_admin',      // 管理员（男）
  'chr_9002_admin',      // 管理员（女）
];

// 排除的角色名称关键词
const EXCLUDED_NAME_KEYWORDS = ['管理员', 'Admin', 'admin'];

/**
 * 从 i18n 表中获取中文名称
 * @param {string} i18nId - 翻译 ID
 * @param {Object} i18nTable - 翻译表
 * @returns {string|null} - 中文名称
 */
function getChineseName(i18nId, i18nTable) {
  if (!i18nId || !i18nTable) return null;
  return i18nTable[i18nId] || null;
}

/**
 * 构建标准化角色数据
 * @param {Object} rawCharacters - 原始角色数据
 * @param {Object} i18nTable - 翻译表
 * @returns {Array} - 标准化角色数据数组
 */
export function buildCharacterData(rawCharacters, i18nTable) {
  const characters = [];

  for (const [charId, data] of Object.entries(rawCharacters)) {
    // 跳过管理员角色（玩家角色，不是可抽取的）
    if (EXCLUDED_CHARACTERS.includes(charId)) {
      console.log(`跳过管理员角色: ${charId}`);
      continue;
    }

    const chineseName = getChineseName(data.nameI18nId, i18nTable);

    // 跳过没有中文名的角色（可能是未发布的）
    if (!chineseName) {
      console.warn(`角色 ${charId} (${data.engName}) 没有中文名，跳过`);
      continue;
    }

    // 跳过名称包含管理员关键词的角色
    if (EXCLUDED_NAME_KEYWORDS.some(keyword => chineseName.includes(keyword) || (data.engName && data.engName.toLowerCase().includes(keyword.toLowerCase())))) {
      console.log(`跳过管理员角色（按名称）: ${chineseName}`);
      continue;
    }

    characters.push({
      id: charId,
      name: chineseName,
      name_en: data.engName || null,
      rarity: data.rarity,
      avatar_url: IMAGE_URLS.character(charId),
      // 额外信息（可选存储）
      profession: data.profession || null,
      weapon_type: data.weaponType || null,
      char_type: data.charTypeId || null,
    });
  }

  // 按稀有度降序排序
  characters.sort((a, b) => b.rarity - a.rarity);

  return characters;
}

/**
 * 构建标准化武器数据
 * @param {Object} rawWeapons - 原始武器数据
 * @param {Object} i18nTable - 翻译表
 * @returns {Array} - 标准化武器数据数组
 */
export function buildWeaponData(rawWeapons, i18nTable) {
  const weapons = [];

  for (const [weaponId, data] of Object.entries(rawWeapons)) {
    const chineseName = getChineseName(data.nameI18nId, i18nTable);

    // 跳过没有中文名的武器
    if (!chineseName) {
      console.warn(`武器 ${weaponId} 没有中文名，跳过`);
      continue;
    }

    weapons.push({
      id: weaponId,
      name: chineseName,
      name_en: data.engName?.text || data.engName || null,
      rarity: data.rarity,
      weapon_type: data.weaponType || null,
      avatar_url: IMAGE_URLS.weapon(weaponId),
    });
  }

  // 按稀有度降序排序
  weapons.sort((a, b) => b.rarity - a.rarity);

  return weapons;
}

/**
 * 同步所有角色数据
 * @param {Function} onProgress - 进度回调 (current, total, name)
 * @returns {Promise<Object>} - { characters: Array, total: number }
 */
export async function syncAllCharacters(onProgress = null) {
  try {
    // 1. 获取翻译表
    if (onProgress) onProgress(0, 3, '获取翻译表...');
    const i18nTable = await fetchI18nTable();

    // 2. 获取角色列表
    if (onProgress) onProgress(1, 3, '获取角色列表...');
    const rawCharacters = await fetchCharacterList();

    // 3. 构建标准化数据
    if (onProgress) onProgress(2, 3, '处理数据...');
    const characters = buildCharacterData(rawCharacters, i18nTable);

    if (onProgress) onProgress(3, 3, '完成');

    return {
      characters,
      total: characters.length,
    };
  } catch (error) {
    console.error('同步角色数据失败:', error);
    throw error;
  }
}

/**
 * 同步所有武器数据
 * @param {Function} onProgress - 进度回调 (current, total, name)
 * @returns {Promise<Object>} - { weapons: Array, total: number }
 */
export async function syncAllWeapons(onProgress = null) {
  try {
    // 1. 获取翻译表
    if (onProgress) onProgress(0, 3, '获取翻译表...');
    const i18nTable = await fetchI18nTable();

    // 2. 获取武器列表
    if (onProgress) onProgress(1, 3, '获取武器列表...');
    const rawWeapons = await fetchWeaponList();

    // 3. 构建标准化数据
    if (onProgress) onProgress(2, 3, '处理数据...');
    const weapons = buildWeaponData(rawWeapons, i18nTable);

    if (onProgress) onProgress(3, 3, '完成');

    return {
      weapons,
      total: weapons.length,
    };
  } catch (error) {
    console.error('同步武器数据失败:', error);
    throw error;
  }
}

/**
 * 同步角色和武器数据（合并调用）
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} - { characters, weapons, characterCount, weaponCount }
 */
export async function syncAll(onProgress = null) {
  try {
    // 1. 获取翻译表（共用）
    if (onProgress) onProgress(0, 5, '获取翻译表...');
    const i18nTable = await fetchI18nTable();

    // 2. 并行获取角色和武器列表
    if (onProgress) onProgress(1, 5, '获取数据...');
    const [rawCharacters, rawWeapons] = await Promise.all([
      fetchCharacterList(),
      fetchWeaponList(),
    ]);

    // 3. 构建角色数据
    if (onProgress) onProgress(2, 5, '处理角色数据...');
    const characters = buildCharacterData(rawCharacters, i18nTable);

    // 4. 构建武器数据
    if (onProgress) onProgress(3, 5, '处理武器数据...');
    const weapons = buildWeaponData(rawWeapons, i18nTable);

    if (onProgress) onProgress(5, 5, '完成');

    return {
      characters,
      weapons,
      characterCount: characters.length,
      weaponCount: weapons.length,
    };
  } catch (error) {
    console.error('同步数据失败:', error);
    throw error;
  }
}

/**
 * 清除缓存
 */
export function clearCache() {
  i18nCache = null;
}

/**
 * 验证图片 URL 是否可访问
 * @param {string} url - 图片 URL
 * @returns {Promise<boolean>}
 */
export async function validateImageUrl(url) {
  if (!url) return false;

  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  fetchI18nTable,
  fetchCharacterList,
  fetchWeaponList,
  buildCharacterData,
  buildWeaponData,
  syncAllCharacters,
  syncAllWeapons,
  syncAll,
  clearCache,
  validateImageUrl,
  IMAGE_URLS,
  API_BASE,
};
