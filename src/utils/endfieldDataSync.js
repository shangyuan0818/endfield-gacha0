/**
 * Warfarin Wiki 数据同步工具
 * 从 warfarin.wiki 获取角色和武器数据（经 /api/wiki-proxy 代理）
 *
 * 数据源: warfarin.wiki（原生中文，无需 i18n 翻译）
 */

// 图片 URL 模板（warfarin.wiki 静态资源）
const IMAGE_URLS = {
  character: (charId) => `https://static.warfarin.wiki/v3/charicon/icon_${charId}.webp`,
  weapon: (iconId) => `https://static.warfarin.wiki/v3/itemicon/${iconId}.webp`,
};

/**
 * 从代理获取干员数据
 * @returns {Promise<Array>} 干员原始数据数组
 */
export async function fetchOperators() {
  const response = await fetch('/api/wiki-proxy?type=operators');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取干员数据失败');
  }
  return result.data;
}

/**
 * 从代理获取武器数据
 * @returns {Promise<Array>} 武器原始数据数组
 */
export async function fetchWeapons() {
  const response = await fetch('/api/wiki-proxy?type=weapons');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取武器数据失败');
  }
  return result.data;
}

/**
 * 构建标准化角色数据
 * warfarin.wiki 已返回中文名，无需 i18n
 * @param {Array} rawOperators - 原始干员数据数组
 * @returns {Array} 标准化角色数据数组
 */
export function buildCharacterData(rawOperators) {
  const characters = [];

  for (const op of rawOperators) {
    // 跳过无效数据
    if (!op.id || !op.name) continue;

    characters.push({
      id: op.id,
      name: op.name,
      name_en: op.slug || null,
      rarity: op.rarity,
      avatar_url: IMAGE_URLS.character(op.id),
      profession: op.class || null,
      weapon_type: null,
      char_type: null,
    });
  }

  // 按稀有度降序排序
  characters.sort((a, b) => b.rarity - a.rarity);
  return characters;
}

/**
 * 构建标准化武器数据
 * 武器的 iconId 可能与 id 不同，需要使用 iconId 构建图片 URL
 * @param {Array} rawWeapons - 原始武器数据数组
 * @returns {Array} 标准化武器数据数组
 */
export function buildWeaponData(rawWeapons) {
  const weapons = [];

  for (const wp of rawWeapons) {
    if (!wp.id || !wp.name) continue;

    const iconId = wp.iconId || wp.id;

    weapons.push({
      id: wp.id,
      name: wp.name,
      name_en: wp.slug || null,
      rarity: wp.rarity,
      weapon_type: wp.type || null,
      avatar_url: IMAGE_URLS.weapon(iconId),
      _iconId: iconId,
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
    if (onProgress) onProgress(0, 2, '获取干员数据...');
    const rawOperators = await fetchOperators();

    if (onProgress) onProgress(1, 2, '处理数据...');
    const characters = buildCharacterData(rawOperators);

    if (onProgress) onProgress(2, 2, '完成');
    return { characters, total: characters.length };
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
    if (onProgress) onProgress(0, 2, '获取武器数据...');
    const rawWeapons = await fetchWeapons();

    if (onProgress) onProgress(1, 2, '处理数据...');
    const weapons = buildWeaponData(rawWeapons);

    if (onProgress) onProgress(2, 2, '完成');
    return { weapons, total: weapons.length };
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
    if (onProgress) onProgress(0, 4, '获取数据...');
    const [rawOperators, rawWeapons] = await Promise.all([
      fetchOperators(),
      fetchWeapons(),
    ]);

    if (onProgress) onProgress(1, 4, '处理角色数据...');
    const characters = buildCharacterData(rawOperators);

    if (onProgress) onProgress(2, 4, '处理武器数据...');
    const weapons = buildWeaponData(rawWeapons);

    if (onProgress) onProgress(4, 4, '完成');

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
  fetchOperators,
  fetchWeapons,
  buildCharacterData,
  buildWeaponData,
  syncAllCharacters,
  syncAllWeapons,
  syncAll,
  validateImageUrl,
  IMAGE_URLS,
};
