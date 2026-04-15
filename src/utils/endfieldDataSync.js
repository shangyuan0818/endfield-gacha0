/**
 * Warfarin Wiki 数据同步工具
 * 从 warfarin.wiki 获取角色和武器数据（经 /api/wiki-proxy 代理）
 *
 * 数据源: warfarin.wiki（原生中文，无需 i18n 翻译）
 */

import { fetchWithTimeout } from '../services/supabaseRequest.js';
import appLogger from './appLogger.js';

// 图片 URL 模板（warfarin.wiki 静态资源）
const IMAGE_URLS = {
  character: (charId) => `https://static.warfarin.wiki/v3/charicon/icon_${charId}.webp`,
  weapon: (iconId) => `https://static.warfarin.wiki/v3/itemicon/${iconId}.webp`,
};

async function buildProxyFetchError(response) {
  try {
    const result = await response.json();
    if (result?.error) {
      return new Error(result.error);
    }
  } catch {
    // Ignore JSON parsing failures and fall back to status text.
  }

  return new Error(`HTTP ${response.status}: ${response.statusText}`);
}

async function fetchProxyData(type, label) {
  const response = await fetchWithTimeout(`/api/wiki-proxy?type=${type}`, undefined, {
    label: `wiki-proxy:${type}`,
    timeoutMs: 25000,
    retries: 1,
  });
  if (!response.ok) {
    throw await buildProxyFetchError(response);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || `获取 ${label} 数据失败`);
  }

  return {
    data: Array.isArray(result.data) ? result.data : [],
    cached: Boolean(result.cached),
    stale: Boolean(result.stale),
    warning: typeof result.warning === 'string' && result.warning.trim()
      ? result.warning.trim()
      : null,
  };
}

/**
 * 从代理获取干员数据
 * @returns {Promise<{data: Array, cached: boolean, stale: boolean, warning: string|null}>}
 */
export async function fetchOperators() {
  return fetchProxyData('operators', '干员');
}

/**
 * 从代理获取武器数据
 * @returns {Promise<{data: Array, cached: boolean, stale: boolean, warning: string|null}>}
 */
export async function fetchWeapons() {
  return fetchProxyData('weapons', '武器');
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
      profession: op.profession || op.class || null,
      weapon_type: op.weaponType ?? null,
      char_type: op.charTypeId || null,
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
      weapon_type: wp.weaponType ?? wp.type ?? null,
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
    const operatorResult = await fetchOperators();

    if (onProgress) onProgress(1, 2, '处理数据...');
    const characters = buildCharacterData(operatorResult.data);

    if (onProgress) onProgress(2, 2, '完成');
    return {
      characters,
      total: characters.length,
      cached: operatorResult.cached,
      stale: operatorResult.stale,
      warning: operatorResult.warning
    };
  } catch (error) {
    appLogger.error('同步角色数据失败:', error);
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
    const weaponResult = await fetchWeapons();

    if (onProgress) onProgress(1, 2, '处理数据...');
    const weapons = buildWeaponData(weaponResult.data);

    if (onProgress) onProgress(2, 2, '完成');
    return {
      weapons,
      total: weapons.length,
      cached: weaponResult.cached,
      stale: weaponResult.stale,
      warning: weaponResult.warning
    };
  } catch (error) {
    appLogger.error('同步武器数据失败:', error);
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
    const [operatorResult, weaponResult] = await Promise.all([
      fetchOperators(),
      fetchWeapons(),
    ]);

    if (onProgress) onProgress(1, 4, '处理角色数据...');
    const characters = buildCharacterData(operatorResult.data);

    if (onProgress) onProgress(2, 4, '处理武器数据...');
    const weapons = buildWeaponData(weaponResult.data);

    if (onProgress) onProgress(4, 4, '完成');

    return {
      characters,
      weapons,
      characterCount: characters.length,
      weaponCount: weapons.length,
      warnings: [operatorResult.warning, weaponResult.warning].filter(Boolean),
    };
  } catch (error) {
    appLogger.error('同步数据失败:', error);
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
    const response = await fetchWithTimeout(url, { method: 'HEAD' }, {
      label: 'validate-image-url',
      timeoutMs: 15000,
      retries: 1,
    });
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
