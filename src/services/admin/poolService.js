/**
 * 卡池管理服务层
 * 封装所有 Supabase 操作
 */
import { supabase } from '../../supabaseClient';
import { buildManualCharacterId, buildManualPoolId } from '../../utils/canonicalEntityUtils';
import { executeSupabaseRead } from '../supabaseRequest';
import {
  buildCharacterSelfAliasRows,
  buildPoolSelfAliasRows,
} from '../../../shared/idAliasService.js';
import appLogger from '../../utils/appLogger.js';

async function saveManagedCharacterWithAliases(characterData) {
  const { error } = await supabase.rpc('admin_upsert_character_with_aliases', {
    p_character_id: characterData.id,
    p_insert_payload: characterData,
    p_update_payload: characterData,
    p_alias_rows: buildCharacterSelfAliasRows(characterData.id)
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

async function upsertPoolWithAliases({ poolId, insertPayload, updatePayload, aliasRows, poolCharacterRows = [] }) {
  const { error } = await supabase.rpc('admin_upsert_pool_with_aliases', {
    p_pool_id: poolId,
    p_insert_payload: insertPayload,
    p_update_payload: updatePayload,
    p_alias_rows: aliasRows,
    p_pool_character_rows: poolCharacterRows
  });

  if (!error) {
    return;
  }

  if (
    error.code === 'PGRST202'
    || /admin_upsert_pool_with_aliases/i.test(error.message || '')
  ) {
    throw new Error('缺少数据库迁移 078，请先执行 078_harden_admin_entity_upsert_rpcs.sql');
  }

  throw error;
}

function buildInitialPoolCharacterRows(characters, poolType, upCharacterName) {
  const expectedType = poolType === 'weapon' ? 'weapon' : 'character';

  return characters
    .filter(character => character.type === expectedType)
    .map(character => ({
      character_id: character.id,
      is_up: character.name === upCharacterName
    }));
}

/**
 * 加载所有卡池
 */
export const loadPools = async () => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { data, error } = await executeSupabaseRead(
      () => supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false }),
      {
        label: 'admin loadPools',
        retries: 1
      }
    );

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 加载角色列表（用于轮换管理和卡池角色编辑）
 */
export const loadCharacters = async () => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { data, error } = await executeSupabaseRead(
      () => supabase
        .from('characters')
        .select('id, name, rarity, type, is_limited, pool_config')
        .order('rarity', { ascending: false }),
      {
        label: 'admin loadPoolCharacters',
        retries: 1
      }
    );

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 加载所有池子的角色关联数据
 */
export const loadAllPoolCharacters = async () => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { data, error } = await executeSupabaseRead(
      () => supabase
        .from('pool_characters')
        .select('pool_id, character_id, is_up'),
      {
        label: 'admin loadAllPoolCharacters',
        retries: 1
      }
    );

    if (error) throw error;

    // 按 pool_id 分组
    const grouped = {};
    (data || []).forEach(pc => {
      if (!grouped[pc.pool_id]) {
        grouped[pc.pool_id] = [];
      }
      grouped[pc.pool_id].push({ character_id: pc.character_id, is_up: pc.is_up });
    });

    return { success: true, data: grouped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 加载特定池子的角色列表
 */
export const loadPoolCharactersForEdit = async (poolId) => {
  if (!supabase || !poolId) return { success: false, data: [] };

  try {
    const { data, error } = await executeSupabaseRead(
      () => supabase
        .from('pool_characters')
        .select('character_id, is_up')
        .eq('pool_id', poolId),
      {
        label: 'admin loadPoolCharactersForEdit',
        retries: 1
      }
    );

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * 添加角色到池子
 */
export const addCharacterToPool = async (poolId, characterId, isUp = false) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { error } = await supabase
      .from('pool_characters')
      .insert({ pool_id: poolId, character_id: characterId, is_up: isUp });

    if (error) {
      if (error.code === '23505') {
        // 重复插入，忽略
        return { success: true };
      }
      throw error;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 从池子移除角色
 */
export const removeCharacterFromPool = async (poolId, characterId) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { error } = await supabase
      .from('pool_characters')
      .delete()
      .eq('pool_id', poolId)
      .eq('character_id', characterId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 创建新的UP角色
 */
export const createUpCharacter = async (characterName, poolType, poolStartTime, rotationBaseCount = 0) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('请先登录');

  const characterType = poolType === 'weapon' ? 'weapon' : 'character';
  const charId = buildManualCharacterId(characterName, characterType);
  const safeRotationBaseCount = Number(rotationBaseCount) || 0;

  const newCharacter = {
    id: charId,
    name: characterName,
    rarity: 6,
    type: characterType,
    is_limited: poolType === 'limited' || poolType === 'weapon',
    aliases: [],
    avatar_url: null,
    pool_config: {
      pools: [poolType],
      limited_rotation_count: safeRotationBaseCount,
      removes_after: safeRotationBaseCount + 3,
      is_active_in_limited: true,
      introduced_at: poolStartTime || new Date().toISOString()
    }
  };

  await saveManagedCharacterWithAliases(newCharacter);
  return newCharacter;
};

/**
 * 保存卡池（创建或更新）
 */
export const savePool = async (poolData, editingPool, characters) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '请先登录' };

    if (editingPool) {
      // 更新现有卡池
      const targetPoolId = poolData.pool_id || editingPool.pool_id;

      await upsertPoolWithAliases({
        poolId: targetPoolId,
        insertPayload: {
          ...poolData,
          pool_id: targetPoolId
        },
        updatePayload: poolData,
        aliasRows: buildPoolSelfAliasRows(targetPoolId)
      });

      return { success: true, isNew: false };
    } else {
      // 创建新卡池
      const pool_id = buildManualPoolId({
        type: poolData.type,
        name: poolData.name,
        upCharacter: poolData.up_character,
        startTime: poolData.start_time,
        endTime: poolData.end_time,
      });

      const newPoolData = {
        ...poolData,
        user_id: user.id,
        pool_id,
        locked: false
      };

      const poolType = poolData.type === 'limited_character' ? 'limited' : poolData.type;
      const initialPoolCharacterRows = buildInitialPoolCharacterRows(
        characters,
        poolType,
        poolData.up_character
      );

      await upsertPoolWithAliases({
        poolId: pool_id,
        insertPayload: newPoolData,
        updatePayload: newPoolData,
        aliasRows: buildPoolSelfAliasRows(pool_id),
        poolCharacterRows: initialPoolCharacterRows
      });

      return { success: true, isNew: true, addedCount: initialPoolCharacterRows.length };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 删除卡池
 */
export const deletePool = async (poolId) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { error } = await supabase
      .from('pools')
      .delete()
      .eq('pool_id', poolId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 重新计算所有记录的 isStandard 字段
 */
export const recalculateIsStandard = async (pools) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    // 1. 构建 poolId -> 卡池信息 的映射
    const poolInfoMap = new Map();
    pools.forEach(pool => {
      poolInfoMap.set(pool.pool_id, {
        type: pool.type,
        up_character: pool.up_character
      });
    });

    if (poolInfoMap.size === 0) {
      return { success: false, error: '没有找到卡池信息，请先创建卡池' };
    }

    // 2. 获取所有6星记录
    const { data: records, error: fetchError } = await supabase
      .from('history')
      .select('record_id, pool_id, rarity, character_name, item_name, is_standard')
      .eq('rarity', 6);

    if (fetchError) throw fetchError;

    if (!records || records.length === 0) {
      return { success: true, changedCount: 0, message: '没有找到6星记录' };
    }

    // 3. 计算每条记录的新 isStandard 值
    const updates = [];

    for (const record of records) {
      const poolId = record.pool_id;
      const characterName = record.character_name || record.item_name || '';
      const poolInfo = poolInfoMap.get(poolId);

      let newIsStandard;

      if (!poolInfo) {
        newIsStandard = record.is_standard ?? false;
      } else {
        const poolType = poolInfo.type;
        const upCharacter = poolInfo.up_character;

        if (poolType === 'standard' || poolType === 'beginner') {
          newIsStandard = true;
        } else if (poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') {
          if (upCharacter) {
            newIsStandard = !characterName.includes(upCharacter) && !upCharacter.includes(characterName);
          } else {
            newIsStandard = false;
          }
        } else {
          newIsStandard = record.is_standard ?? false;
        }
      }

      if (newIsStandard !== record.is_standard) {
        updates.push({
          record_id: record.record_id,
          is_standard: newIsStandard
        });
      }
    }

    if (updates.length === 0) {
      return { success: true, changedCount: 0, message: '所有记录已是最新状态' };
    }

    // 4. 批量更新
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      for (const update of batch) {
        // eslint-disable-next-line no-await-in-loop -- per-record normalization updates stay sequential for granular failure logs
        const { error: updateError } = await supabase
          .from('history')
          .update({ is_standard: update.is_standard })
          .eq('record_id', update.record_id);

        if (updateError) {
          appLogger.warn('更新记录失败:', update.record_id, updateError);
        }
      }
    }

    return { success: true, changedCount: updates.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
