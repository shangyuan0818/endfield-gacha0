/**
 * 卡池管理服务层
 * 封装所有 Supabase 操作
 */
import { supabase } from '../../supabaseClient';
import { incrementRotationCount, characterCache } from '../../utils/characterUtils';
import { executeSupabaseRead } from '../supabaseRequest';

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
export const createUpCharacter = async (characterName, poolType, poolStartTime, processedPoolsCount) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('请先登录');

  const charId = `char_${characterName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  const characterType = poolType === 'weapon' ? 'weapon' : 'character';

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
      limited_rotation_count: processedPoolsCount,
      removes_after: processedPoolsCount + 3,
      is_active_in_limited: true,
      introduced_at: poolStartTime || new Date().toISOString()
    }
  };

  const { data, error } = await supabase
    .from('characters')
    .insert(newCharacter)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 保存卡池（创建或更新）
 */
export const savePool = async (poolData, editingPool, characters, addCharToPool) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '请先登录' };

    if (editingPool) {
      // 更新现有卡池
      const { error } = await supabase
        .from('pools')
        .update(poolData)
        .eq('pool_id', editingPool.pool_id);

      if (error) throw error;
      return { success: true, isNew: false };
    } else {
      // 创建新卡池
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const pool_id = `pool_${user.id.substring(0, 8)}_${poolData.type}_${timestamp}_${randomStr}`;

      const newPoolData = {
        ...poolData,
        user_id: user.id,
        pool_id: pool_id,
        locked: false
      };

      const { error } = await supabase
        .from('pools')
        .insert(newPoolData);

      if (error) throw error;

      // 新增卡池时自动添加所有对应类型的角色
      const poolType = poolData.type === 'limited_character' ? 'limited' : poolData.type;
      const charsToAdd = characters.filter(c =>
        c.type === (poolType === 'weapon' ? 'weapon' : 'character')
      );

      for (const char of charsToAdd) {
        const isUp = char.name === poolData.up_character;
        await addCharToPool(pool_id, char.id, isUp);
      }

      return { success: true, isNew: true, addedCount: charsToAdd.length };
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
 * 处理轮换 - 增加所有限定池6星角色的轮换次数
 */
export const processRotation = async (pool, limitedChars) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    // 逐个增加轮换次数（包括UP角色）
    for (const char of limitedChars) {
      await incrementRotationCount(char.id);
    }

    // 标记该卡池轮换已处理
    await supabase
      .from('pools')
      .update({ rotation_processed: true })
      .eq('pool_id', pool.pool_id);

    // 刷新缓存
    await characterCache.refresh();

    return { success: true, count: limitedChars.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 批量处理所有待轮换的卡池
 */
export const processAllPendingRotations = async (pendingPools, limitedChars) => {
  if (!supabase) return { success: false, error: 'Supabase 未初始化' };

  try {
    for (const pool of pendingPools) {
      for (const char of limitedChars) {
        await incrementRotationCount(char.id);
      }

      await supabase
        .from('pools')
        .update({ rotation_processed: true })
        .eq('pool_id', pool.pool_id);
    }

    await characterCache.refresh();

    return { success: true, poolCount: pendingPools.length, charCount: limitedChars.length };
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
        const { error: updateError } = await supabase
          .from('history')
          .update({ is_standard: update.is_standard })
          .eq('record_id', update.record_id);

        if (updateError) {
          console.warn('更新记录失败:', update.record_id, updateError);
        }
      }
    }

    return { success: true, changedCount: updates.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
