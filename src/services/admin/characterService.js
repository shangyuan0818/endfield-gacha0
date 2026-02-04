/**
 * 角色管理服务层
 * 封装所有与角色/武器相关的 Supabase 操作
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

import { supabase } from '../../supabaseClient';
import { syncAllCharacters, syncAllWeapons } from '../../utils/endfieldDataSync';
import { batchSyncAvatars, ensureBucketExists } from '../../utils/avatarStorage';
import { characterCache } from '../../utils/characterUtils';

/**
 * 加载所有角色/武器列表
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function loadCharacters() {
  if (!supabase) {
    return { data: null, error: new Error('数据库未连接') };
  }

  try {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('rarity', { ascending: false })
      .order('name', { ascending: true });

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
    if (existingCharacter) {
      // 更新现有角色
      const { error } = await supabase
        .from('characters')
        .update(characterData)
        .eq('id', existingCharacter.id);

      if (error) throw error;
    } else {
      // 创建新角色
      const { error } = await supabase
        .from('characters')
        .insert(characterData);

      if (error) throw error;
    }

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
    const { data: currentItems, error: fetchError } = await supabase
      .from('characters')
      .select('id, is_limited, pool_config')
      .in('id', characterIds);

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
        updates.pool_config = { ...currentConfig, pools: newPools };
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

/**
 * 从 EndfieldTools API 同步角色和武器数据
 * @param {Object} options - 选项
 * @param {boolean} options.uploadAvatars - 是否上传头像到 Storage
 * @param {Function} options.onProgress - 进度回调
 * @param {string[]} options.existingIds - 已存在的角色ID列表
 * @returns {Promise<{success: boolean, newCount: number, skippedCount: number, errorCount: number, avatarCount: number, error: Error|null}>}
 */
export async function syncFromAPI({ uploadAvatars = false, onProgress, existingIds = [] }) {
  if (!supabase) {
    return { success: false, error: new Error('数据库未连接') };
  }

  // 如果需要上传头像，先检查 bucket
  if (uploadAvatars) {
    const bucketReady = await ensureBucketExists();
    if (!bucketReady) {
      return {
        success: false,
        error: new Error('请先在 Supabase 控制台创建名为 "avatars" 的公开存储桶，并配置上传策略')
      };
    }
  }

  try {
    // 1. 获取角色数据
    onProgress?.('正在获取角色数据...');
    const characterResult = await syncAllCharacters((current, total, msg) => {
      onProgress?.(`角色: ${msg}`);
    });

    // 2. 获取武器数据
    onProgress?.('正在获取武器数据...');
    const weaponResult = await syncAllWeapons((current, total, msg) => {
      onProgress?.(`武器: ${msg}`);
    });

    // 3. 合并数据
    const allItems = [
      ...characterResult.characters.map(c => ({ ...c, type: 'character' })),
      ...weaponResult.weapons.map(w => ({ ...w, type: 'weapon' })),
    ];

    // 4. 如果需要上传头像，先上传到 Storage
    let avatarUrlMap = new Map();
    if (uploadAvatars) {
      onProgress?.(`正在上传头像 (0/${allItems.length})...`);

      const { success, failed, results } = await batchSyncAvatars(
        allItems,
        (current, total, name) => {
          onProgress?.(`上传头像: ${current}/${total} - ${name}`);
        }
      );

      avatarUrlMap = results;
    }

    // 5. 更新数据库
    onProgress?.(`正在更新数据库 (${allItems.length} 项)...`);

    let newCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const existingIdSet = new Set(existingIds);

    for (const item of allItems) {
      try {
        // 优先使用上传到 Storage 的 URL，否则使用原始 URL
        const finalAvatarUrl = avatarUrlMap.get(item.id) || item.avatar_url;

        if (existingIdSet.has(item.id)) {
          // 跳过已存在的角色
          skippedCount++;
          continue;
        }

        // 插入新记录
        const dbData = {
          id: item.id,
          name: item.name,
          rarity: item.rarity,
          type: item.type,
          avatar_url: finalAvatarUrl,
          aliases: [],
          is_limited: false,
          pool_config: {
            pools: item.rarity >= 5 ? ['standard'] : [],
            limited_rotation_count: 0,
            removes_after: null,
            is_active_in_limited: false
          }
        };

        const { error } = await supabase
          .from('characters')
          .insert(dbData);
        if (error) throw error;
        newCount++;
      } catch (err) {
        console.error(`同步 ${item.name} 失败:`, err);
        errorCount++;
      }
    }

    // 6. 刷新 characterCache
    await characterCache.refresh();

    return {
      success: true,
      newCount,
      skippedCount,
      errorCount,
      avatarCount: avatarUrlMap.size,
      error: null
    };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 上传头像到 Supabase Storage
 * @param {Array} items - 要上传的项目列表
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<{success: boolean, results: Map, successCount: number, failedCount: number, error: Error|null}>}
 */
export async function uploadAvatars(items, onProgress) {
  if (!supabase) {
    return { success: false, error: new Error('数据库未连接') };
  }

  // 检查 bucket 是否存在
  const bucketReady = await ensureBucketExists();
  if (!bucketReady) {
    return {
      success: false,
      error: new Error('请先在 Supabase 控制台创建名为 "avatars" 的公开存储桶')
    };
  }

  try {
    onProgress?.('准备上传...');

    const { success, failed, results } = await batchSyncAvatars(
      items,
      (current, total, name) => {
        onProgress?.(`上传中: ${current}/${total} - ${name}`);
      }
    );

    // 更新数据库中的 avatar_url
    if (results.size > 0) {
      onProgress?.('正在更新数据库...');

      let updateSuccess = 0;
      for (const [id, newUrl] of results) {
        try {
          const { error } = await supabase
            .from('characters')
            .update({ avatar_url: newUrl })
            .eq('id', id);

          if (!error) updateSuccess++;
        } catch (err) {
          console.error(`更新 ${id} 的 avatar_url 失败:`, err);
        }
      }

      return {
        success: true,
        results,
        successCount: success,
        failedCount: failed,
        updateCount: updateSuccess,
        error: null
      };
    }

    return {
      success: false,
      results: new Map(),
      successCount: 0,
      failedCount: items.length,
      error: new Error('头像上传失败，请检查网络连接')
    };
  } catch (error) {
    return { success: false, error };
  }
}
