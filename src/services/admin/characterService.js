/**
 * 角色管理服务层
 * 封装所有与角色/武器相关的 Supabase 操作
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

import { supabase } from '../../supabaseClient';
import { syncAllCharacters, syncAllWeapons } from '../../utils/endfieldDataSync';
import { buildWikiAssetProxyPath } from '../../utils/avatarAssetPaths.js';
import { characterCache } from '../../utils/characterUtils';
import { executeSupabaseRead } from '../supabaseRequest';
import {
  buildCharacterSelfAliasRows,
  resolveAliasValue,
  resolveCharacterAliasMap,
} from '../../../shared/idAliasService.js';

function buildSyncedPoolConfig(itemType) {
  if (itemType === 'weapon') {
    return {
      pools: ['weapon'],
      limited_rotation_count: 0,
      removes_after: null,
      is_active_in_limited: false
    };
  }

  return {
    pools: [],
    limited_rotation_count: 0,
    removes_after: null,
    is_active_in_limited: false
  };
}

function buildWikiAliasRows(canonicalId, wikiId) {
  const rows = [...buildCharacterSelfAliasRows(canonicalId)];

  if (wikiId && wikiId !== canonicalId) {
    rows.push({
      source: 'wiki',
      alias_id: wikiId,
      character_id: canonicalId,
      is_primary: false,
      note: 'Resolved wiki id to canonical character id'
    });
  }

  return rows;
}

function pushUniqueWarning(warnings, message) {
  const normalized = typeof message === 'string' ? message.trim() : '';
  if (normalized) {
    warnings.add(normalized);
  }
}

function isFatalSyncSetupError(error) {
  const message = error?.message || '';
  return /缺少数据库迁移 077|缺少数据库迁移 078|only super_admin|permission denied/i.test(message);
}

async function syncCharacterWithAliases({ canonicalId, insertPayload, updatePayload, aliasRows }) {
  const { error } = await supabase.rpc('admin_sync_character_with_aliases', {
    p_character_id: canonicalId,
    p_insert_payload: insertPayload,
    p_update_payload: updatePayload,
    p_alias_rows: aliasRows
  });

  if (!error) {
    return;
  }

  if (
    error.code === 'PGRST202'
    || /admin_sync_character_with_aliases/i.test(error.message || '')
  ) {
    throw new Error('缺少数据库迁移 077，请先执行 077_add_admin_sync_character_rpc.sql');
  }

  throw error;
}

async function saveManagedCharacterWithAliases({ canonicalId, insertPayload, updatePayload, aliasRows }) {
  const { error } = await supabase.rpc('admin_upsert_character_with_aliases', {
    p_character_id: canonicalId,
    p_insert_payload: insertPayload,
    p_update_payload: updatePayload,
    p_alias_rows: aliasRows
  });

  if (!error) {
    return;
  }

  if (
    error.code === 'PGRST202'
    || /admin_upsert_character_with_aliases/i.test(error.message || '')
  ) {
    throw new Error('缺少数据库迁移 078，请先执行 078_harden_admin_entity_upsert_rpcs.sql');
  }

  throw error;
}

/**
 * 加载所有角色/武器列表
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function loadCharacters() {
  if (!supabase) {
    return { data: null, error: new Error('数据库未连接') };
  }

  try {
    const { data, error } = await executeSupabaseRead(
      () => supabase
        .from('characters')
        .select('*')
        .order('rarity', { ascending: false })
        .order('name', { ascending: true }),
      {
        label: 'admin loadCharacters',
        retries: 1
      }
    );

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * 保存角色（新增或更新）
 * @param {Object} characterData - 角色数据
 * @param {Object|null} existingCharacter - 已存在的角色（更新时传入）
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function saveCharacter(characterData, existingCharacter = null) {
  if (!supabase) {
    return { success: false, error: new Error('数据库未连接') };
  }

  try {
    if (existingCharacter && existingCharacter.id !== characterData.id) {
      throw new Error('暂不支持在编辑时直接修改角色ID，请通过 alias 映射或迁移脚本处理');
    }

    await saveManagedCharacterWithAliases({
      canonicalId: characterData.id,
      insertPayload: characterData,
      updatePayload: characterData,
      aliasRows: buildCharacterSelfAliasRows(characterData.id)
    });

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 删除角色
 * @param {string} characterId - 角色ID
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function deleteCharacter(characterId) {
  if (!supabase) {
    return { success: false, error: new Error('数据库未连接') };
  }

  try {
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', characterId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 批量删除角色
 * @param {string[]} characterIds - 角色ID数组
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function batchDeleteCharacters(characterIds) {
  if (!supabase) {
    return { success: false, error: new Error('数据库未连接') };
  }

  try {
    const { error } = await supabase
      .from('characters')
      .delete()
      .in('id', characterIds);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 批量更新角色
 * @param {string[]} characterIds - 角色ID数组
 * @param {Object} batchEditForm - 批量编辑表单
 * @returns {Promise<{success: boolean, updateCount: number, error: Error|null}>}
 */
export async function batchUpdateCharacters(characterIds, batchEditForm) {
  if (!supabase) {
    return { success: false, updateCount: 0, error: new Error('数据库未连接') };
  }

  try {
    // 获取当前选中的记录
    const { data: currentItems, error: fetchError } = await executeSupabaseRead(
      () => supabase
        .from('characters')
        .select('id, is_limited, pool_config')
        .in('id', characterIds),
      {
        label: 'admin batchUpdateCharacters preload',
        retries: 1
      }
    );

    if (fetchError) throw fetchError;

    let updateCount = 0;

    // 更新每个记录
    for (const item of currentItems) {
      const updates = {};
      let needUpdate = false;

      // 处理限定状态
      if (batchEditForm.is_limited !== null) {
        updates.is_limited = batchEditForm.is_limited;
        needUpdate = true;
      }

      // 处理卡池配置
      const currentConfig = item.pool_config || { pools: [] };
      let newPools = [...(currentConfig.pools || [])];
      let poolsChanged = false;

      // 处理每个卡池类型
      ['limited', 'standard', 'weapon'].forEach(poolType => {
        const action = batchEditForm.pools[poolType];
        if (action === true) {
          // 添加卡池
          if (!newPools.includes(poolType)) {
            newPools.push(poolType);
            poolsChanged = true;
          }
        } else if (action === false) {
          // 移除卡池
          if (newPools.includes(poolType)) {
            newPools = newPools.filter(p => p !== poolType);
            poolsChanged = true;
          }
        }
      });

      if (poolsChanged) {
        const nextPoolConfig = { ...currentConfig, pools: newPools };

        if (batchEditForm.pools.limited === true && !nextPoolConfig.introduced_at) {
          nextPoolConfig.introduced_at = new Date().toISOString();
        }

        if (!newPools.includes('limited')) {
          nextPoolConfig.is_active_in_limited = false;
        } else {
          const rotationCount = Number(nextPoolConfig.limited_rotation_count) || 0;
          const removesAfter = nextPoolConfig.removes_after;
          nextPoolConfig.is_active_in_limited = removesAfter === null || removesAfter === undefined || rotationCount < removesAfter;
        }

        updates.pool_config = nextPoolConfig;
        needUpdate = true;
      }

      // 如果有更新，执行更新
      if (needUpdate) {
        const { error } = await supabase
          .from('characters')
          .update(updates)
          .eq('id', item.id);

        if (error) throw error;
        updateCount++;
      }
    }

    return { success: true, updateCount, error: null };
  } catch (error) {
    return { success: false, updateCount: 0, error };
  }
}

function isCompleteSyncFailure({ totalItems, newCount, skippedCount, errorCount }) {
  return totalItems > 0 && errorCount > 0 && newCount === 0 && skippedCount === 0;
}

function resolveManagedAvatarUrl(item) {
  if (!item?.id) {
    return null;
  }

  const proxyAssetId = item.type === 'weapon'
    ? (item._iconId || item.id)
    : item.id;

  return buildWikiAssetProxyPath(item.type, proxyAssetId) || item.avatar_url || null;
}

export async function batchUpdateCharacterAvatars(avatarUpdates) {
  if (!supabase) {
    return { success: false, updateCount: 0, errorCount: 0, error: new Error('数据库未连接') };
  }

  try {
    let updateCount = 0;
    let errorCount = 0;

    for (const item of avatarUpdates) {
      const { error } = await supabase
        .from('characters')
        .update({ avatar_url: item.avatar_url })
        .eq('id', item.id);

      if (error) {
        errorCount++;
      } else {
        updateCount++;
      }
    }

    if (updateCount > 0) {
      await characterCache.refresh();
    }

    return { success: errorCount === 0, updateCount, errorCount, error: null };
  } catch (error) {
    return { success: false, updateCount: 0, errorCount: 0, error };
  }
}

/**
 * 从 Warfarin Wiki 同步角色和武器数据
 * @param {Object} options - 选项
 * @param {Function} options.onProgress - 进度回调
 * @param {string[]} options.existingIds - 已存在的角色ID列表
 * @returns {Promise<{success: boolean, newCount: number, skippedCount: number, errorCount: number, avatarCount: number, avatarFailedCount: number, warnings: string[], error: Error|null}>}
 */
export async function syncFromAPI({ onProgress, existingIds = [] }) {
  if (!supabase) {
    return { success: false, error: new Error('数据库未连接') };
  }

  try {
    const syncWarnings = new Set();

    // 1. 获取角色数据
    onProgress?.('正在获取角色数据...');
    const characterResult = await syncAllCharacters((current, total, msg) => {
      onProgress?.(`角色: ${msg}`);
    });
    pushUniqueWarning(syncWarnings, characterResult.warning);

    // 2. 获取武器数据
    onProgress?.('正在获取武器数据...');
    const weaponResult = await syncAllWeapons((current, total, msg) => {
      onProgress?.(`武器: ${msg}`);
    });
    pushUniqueWarning(syncWarnings, weaponResult.warning);

    // 3. 合并数据
    const allItems = [
      ...characterResult.characters.map(c => ({ ...c, type: 'character' })),
      ...weaponResult.weapons.map(w => ({ ...w, type: 'weapon' })),
    ];

    if (allItems.length === 0) {
      return {
        success: false,
        error: new Error('未从 Wiki 获取到任何可同步的角色或武器数据')
      };
    }

    const avatarFailedCount = 0;
    pushUniqueWarning(
      syncWarnings,
      '浏览器侧同步已停用 Supabase Storage 头像上传，当前改为写入站点同源代理 URL；如需彻底切到站点本地静态头像，请在仓库本地运行 sync:local-avatars 后提交并部署'
    );

    // 4. 更新数据库
    onProgress?.(`正在更新数据库 (${allItems.length} 项)...`);

    let newCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const wikiAliasMap = await resolveCharacterAliasMap(
      supabase,
      allItems.map(item => item.id),
      'wiki'
    );
    const resolvedIds = allItems.map(item => resolveAliasValue(wikiAliasMap, item.id));
    const { data: existingRows } = await executeSupabaseRead(
      () => supabase
        .from('characters')
        .select('id')
        .in('id', Array.from(new Set([...existingIds, ...resolvedIds]))),
      {
        label: 'admin syncFromAPI existing rows',
        retries: 1
      }
    );
    const existingIdSet = new Set([...(existingIds || []), ...((existingRows || []).map(row => row.id))]);

    for (const item of allItems) {
      try {
        const finalAvatarUrl = resolveManagedAvatarUrl(item);
        const canonicalId = resolveAliasValue(wikiAliasMap, item.id);

        if (existingIdSet.has(canonicalId)) {
          // eslint-disable-next-line no-await-in-loop
          await syncCharacterWithAliases({
            canonicalId,
            insertPayload: {
              id: canonicalId,
              name: item.name,
              rarity: item.rarity,
              type: item.type,
              avatar_url: finalAvatarUrl,
              aliases: [],
              is_limited: false,
              pool_config: buildSyncedPoolConfig(item.type)
            },
            updatePayload: {
              name: item.name,
              rarity: item.rarity,
              type: item.type,
              avatar_url: finalAvatarUrl
            },
            aliasRows: buildWikiAliasRows(canonicalId, item.id)
          });

          skippedCount++;
          continue;
        }

        // 插入新记录
        const dbData = {
          id: canonicalId,
          name: item.name,
          rarity: item.rarity,
          type: item.type,
          avatar_url: finalAvatarUrl,
          aliases: [],
          is_limited: false,
          pool_config: buildSyncedPoolConfig(item.type)
        };

        // eslint-disable-next-line no-await-in-loop
        await syncCharacterWithAliases({
          canonicalId,
          insertPayload: dbData,
          updatePayload: {
            name: item.name,
            rarity: item.rarity,
            type: item.type,
            avatar_url: finalAvatarUrl
          },
          aliasRows: buildWikiAliasRows(canonicalId, item.id)
        });

        newCount++;
        existingIdSet.add(canonicalId);
      } catch (err) {
        if (isFatalSyncSetupError(err)) {
          throw err;
        }
        console.error(`同步 ${item.name} 失败:`, err);
        errorCount++;
      }
    }

    if (isCompleteSyncFailure({
      totalItems: allItems.length,
      newCount,
      skippedCount,
      errorCount
    })) {
      return {
        success: false,
        error: new Error(`所有 ${errorCount} 个项目都写入失败，请检查数据库错误日志或迁移状态`)
      };
    }

    if (newCount > 0) {
      pushUniqueWarning(
        syncWarnings,
        '新同步项目不会自动推断限定/常驻归属；角色默认空卡池，武器默认 weapon 池，请在卡池数据同步后复核'
      );
    }

    // 5. 刷新 characterCache
    await characterCache.refresh();

    return {
      success: true,
      newCount,
      skippedCount,
      errorCount,
      avatarCount: 0,
      avatarFailedCount,
      warnings: Array.from(syncWarnings),
      error: null
    };
  } catch (error) {
    return { success: false, error };
  }
}
