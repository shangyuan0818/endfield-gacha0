/**
 * 卡池管理服务层
 * 封装所有 Supabase 操作
 */
import { supabase } from '../../supabaseClient';
import { buildManualCharacterId, buildManualPoolId } from '../../utils/canonicalEntityUtils';
import { executeSupabaseRead } from '../supabaseRequest';
import {
  getCurrentAuthenticatedUser,
  withAuthenticatedSupabaseRequest,
} from '../authFetchService.js';
import {
  buildCharacterSelfAliasRows,
  buildPoolSelfAliasRows,
  inferPoolAliasSource,
} from '../../../shared/idAliasService.js';
import appLogger from '../../utils/appLogger.js';

function normalizeName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueAliasRows(rows = []) {
  const deduped = new Map();

  rows.forEach((row) => {
    const source = normalizeName(row?.source);
    const aliasId = normalizeName(row?.alias_id);
    const poolId = normalizeName(row?.pool_id);
    if (!source || !aliasId || !poolId) {
      return;
    }

    deduped.set(`${source}:${aliasId}`, {
      ...row,
      source,
      alias_id: aliasId,
      pool_id: poolId,
      is_primary: Boolean(row?.is_primary),
      note: row?.note || null,
    });
  });

  return Array.from(deduped.values());
}

function buildNameSet(items = []) {
  return new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => normalizeName(item))
      .filter(Boolean)
  );
}

function normalizePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  return type || 'limited';
}

function buildCharacterLookup(characters = []) {
  const byId = new Map();

  (Array.isArray(characters) ? characters : []).forEach((character) => {
    if (character?.id) {
      byId.set(character.id, character);
    }
  });

  return { byId };
}

function normalizePoolCharacterRows(rows = [], characters = [], poolData = {}) {
  const poolType = normalizePoolType(poolData?.type);
  const { byId } = buildCharacterLookup(characters);
  const featuredNames = buildNameSet(poolData?.featured_characters);
  const featuredIds = new Set(
    (Array.isArray(poolData?.featured_characters) ? poolData.featured_characters : [])
      .map((value) => normalizeName(value))
      .filter(Boolean)
  );
  const upCharacterName = normalizeName(poolData?.up_character);
  const dedupedRows = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const characterId = normalizeName(row?.character_id);
    if (!characterId) {
      return;
    }

    const character = byId.get(characterId);
    const isUp = poolType === 'extra'
      ? featuredIds.has(characterId) || featuredNames.has(normalizeName(character?.name))
      : Boolean(row?.is_up) || (upCharacterName && normalizeName(character?.name) === upCharacterName);

    dedupedRows.set(characterId, {
      character_id: characterId,
      is_up: Boolean(isUp)
    });
  });

  return Array.from(dedupedRows.values());
}

async function saveManagedCharacterWithAliases(characterData) {
  const { error } = await withAuthenticatedSupabaseRequest(
    () => supabase.rpc('admin_upsert_character_with_aliases', {
      p_character_id: characterData.id,
      p_insert_payload: characterData,
      p_update_payload: characterData,
      p_alias_rows: buildCharacterSelfAliasRows(characterData.id)
    }),
    { requireToken: true }
  );

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
  const { error } = await withAuthenticatedSupabaseRequest(
    () => supabase.rpc('admin_upsert_pool_with_aliases', {
      p_pool_id: poolId,
      p_insert_payload: insertPayload,
      p_update_payload: updatePayload,
      p_alias_rows: aliasRows,
      p_pool_character_rows: poolCharacterRows
    }),
    { requireToken: true }
  );

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

async function upsertPoolCharacter(poolId, characterId, isUp = false) {
  const { error } = await withAuthenticatedSupabaseRequest(
    () => supabase
      .from('pool_characters')
      .upsert(
        { pool_id: poolId, character_id: characterId, is_up: isUp },
        { onConflict: 'pool_id,character_id' }
      ),
    { requireToken: true }
  );

  if (error) {
    throw error;
  }
}

async function replacePoolCharacters(poolId, rows = []) {
  const { error: deleteError } = await withAuthenticatedSupabaseRequest(
    () => supabase
      .from('pool_characters')
      .delete()
      .eq('pool_id', poolId),
    { requireToken: true }
  );

  if (deleteError) {
    throw deleteError;
  }

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await withAuthenticatedSupabaseRequest(
    () => supabase
      .from('pool_characters')
      .upsert(
        rows.map((row) => ({
          pool_id: poolId,
          character_id: row.character_id,
          is_up: Boolean(row.is_up)
        })),
        { onConflict: 'pool_id,character_id' }
      ),
    { requireToken: true }
  );

  if (insertError) {
    throw insertError;
  }
}

function buildRowsToPersist({ poolData, characters, editingPoolCharacters }) {
  return normalizePoolCharacterRows(editingPoolCharacters, characters, poolData);
}

export function buildPoolAliasRowsForSave({
  canonicalPoolId,
  editingPool = null,
  poolData = {},
  preferredSource = null,
} = {}) {
  const normalizedCanonicalId = normalizeName(canonicalPoolId);
  if (!normalizedCanonicalId) {
    return [];
  }

  const rows = [...buildPoolSelfAliasRows(normalizedCanonicalId, preferredSource)];
  const previousIds = [
    poolData?.pool_id,
    editingPool?.pool_id,
  ]
    .map((value) => normalizeName(value))
    .filter((value) => value && value !== normalizedCanonicalId);

  previousIds.forEach((aliasId) => {
    rows.push({
      pool_id: normalizedCanonicalId,
      source: inferPoolAliasSource(aliasId) || 'admin_manual',
      alias_id: aliasId,
      is_primary: false,
      note: 'Pool previous id alias',
    });
  });

  return uniqueAliasRows(rows);
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
 * 加载角色列表（用于卡池角色编辑）
 */
export const loadCharacters = async () => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { data, error } = await executeSupabaseRead(
      () => supabase
        .from('characters')
        .select('id, name, rarity, type, is_limited, aliases, pool_config, created_at, updated_at')
        .order('created_at', { ascending: false, nullsFirst: false })
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
    await upsertPoolCharacter(poolId, characterId, isUp);
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
    const { error } = await withAuthenticatedSupabaseRequest(
      () => supabase
        .from('pool_characters')
        .delete()
        .eq('pool_id', poolId)
        .eq('character_id', characterId),
      { requireToken: true }
    );

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
  await getCurrentAuthenticatedUser({ requireUser: true });

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
      removes_after: null,
      is_active_in_limited: poolType === 'limited',
      introduced_at: poolStartTime || new Date().toISOString()
    }
  };

  await saveManagedCharacterWithAliases(newCharacter);
  return newCharacter;
};

/**
 * 保存卡池（创建或更新）
 */
export const savePool = async (poolData, editingPool, characters, editingPoolCharacters = []) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const user = await getCurrentAuthenticatedUser({ requireUser: true });
    if (!user) return { success: false, error: '请先登录' };

    const poolCharacterRows = buildRowsToPersist({
      poolData,
      characters,
      editingPoolCharacters,
      editingPool
    });

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
        aliasRows: buildPoolAliasRowsForSave({
          canonicalPoolId: targetPoolId,
          editingPool,
          poolData
        })
      });

      await replacePoolCharacters(targetPoolId, poolCharacterRows);

      return { success: true, isNew: false, addedCount: poolCharacterRows.length };
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
        locked: Boolean(poolData.locked)
      };

      await upsertPoolWithAliases({
        poolId: pool_id,
        insertPayload: newPoolData,
        updatePayload: newPoolData,
        aliasRows: buildPoolAliasRowsForSave({
          canonicalPoolId: pool_id,
          poolData: newPoolData
        })
      });

      await replacePoolCharacters(pool_id, poolCharacterRows);

      return { success: true, isNew: true, addedCount: poolCharacterRows.length };
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
    const { error } = await withAuthenticatedSupabaseRequest(
      () => supabase
        .from('pools')
        .delete()
        .eq('pool_id', poolId),
      { requireToken: true }
    );

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
    const { data: records, error: fetchError } = await withAuthenticatedSupabaseRequest(
      () => supabase
        .from('history')
        .select('record_id, pool_id, rarity, character_name, item_name, is_standard')
        .eq('rarity', 6),
      { requireToken: true }
    );

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
        } else if (poolType === 'extra') {
          newIsStandard = false;
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
        const { error: updateError } = await withAuthenticatedSupabaseRequest(
          () => supabase
            .from('history')
            .update({ is_standard: update.is_standard })
            .eq('record_id', update.record_id),
          { requireToken: true }
        );

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
