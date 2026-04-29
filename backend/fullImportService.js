/**
 * 完全后端化导入服务
 *
 * 功能：
 * 1. 接收前端提交的 token 和账号信息
 * 2. 后端执行完整的认证链
 * 3. 后端获取所有抽卡记录
 * 4. 后端处理数据（去重、计算 pity、normalizeIsStandard）
 * 5. 后端直接写入 Supabase
 * 6. 前端通过轮询获取进度
 *
 * @version 1.0.0
 * @date 2026-02-24
 */

import { createClient } from '@supabase/supabase-js';
import {
  resolveAliasValue,
  resolveCharacterAliasMap,
  resolvePoolAliasMap,
} from './lib/idAliasService.js';
import { fetchWithNetworkRetry } from './lib/networkFetch.js';

// Supabase Admin 客户端（需要 SUPABASE_SECRET_KEY；旧 service_role_key 仍兼容）
let supabaseAdmin = null;

/**
 * 初始化 Supabase Admin 客户端
 */
export function initSupabaseAdmin(supabaseUrl, serviceRoleKey) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      fetch: (input, init) => fetchWithNetworkRetry(input, init, { label: 'supabase-admin' })
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('[FullImportService] Supabase Admin initialized');
}

/**
 * 使用前端 Supabase access token 校验当前调用者身份
 * @param {string} accessToken
 * @returns {Promise<object>} Supabase user
 */
export async function verifySupabaseAccessToken(accessToken) {
  const supabase = getSupabaseAdmin();

  if (!accessToken) {
    throw new Error('Missing access token');
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = data?.user || null;

  if (error || !user?.id) {
    throw new Error(error?.message || 'Invalid access token');
  }

  return user;
}

/**
 * 获取 Supabase Admin 客户端
 */
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin not initialized. Call initSupabaseAdmin() first.');
  }
  return supabaseAdmin;
}

/**
 * 简单字符串哈希函数（与前端保持一致）
 */
function simpleStringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000); // 与旧前端 ImportManager.jsx 保持一致
}

const POOL_TYPE_MAP = {
  extra: 'extra',
  special: 'limited',
  standard: 'standard',
  beginner: 'beginner',
  weponbox: 'weapon',
  weaponbox: 'weapon',
  weapon: 'weapon'
};

const POOL_TYPE_ENUM_MAP = {
  E_CharacterGachaPoolType_Special: 'limited',
  E_CharacterGachaPoolType_Standard: 'standard',
  E_CharacterGachaPoolType_Beginner: 'beginner'
};

function getFallbackPoolId(type, poolType) {
  if (type === 'extra') return 'extra';
  if (type === 'weapon') return 'weaponbox';
  if (poolType === 'E_CharacterGachaPoolType_Special') return 'special';
  if (poolType === 'E_CharacterGachaPoolType_Standard') return 'standard';
  if (poolType === 'E_CharacterGachaPoolType_Beginner') return 'beginner';
  return String(poolType || type || 'unknown');
}

function getOfficialPoolId(record, type, poolType) {
  return String(record.poolId || record.pool_id || getFallbackPoolId(type, poolType));
}

function getPoolTypeFromId(poolId, type, poolType) {
  if (poolId) {
    const prefix = String(poolId).split('_')[0].toLowerCase();
    if (POOL_TYPE_MAP[prefix]) {
      return POOL_TYPE_MAP[prefix];
    }
  }

  if (type === 'weapon') {
    return 'weapon';
  }

  return POOL_TYPE_ENUM_MAP[poolType] || 'standard';
}

function getDefaultPoolName(poolId, type) {
  switch (type) {
    case 'extra':
      return '附加寻访';
    case 'limited':
      return '限定角色池';
    case 'standard':
      return '基础寻访';
    case 'beginner':
      return '启程寻访';
    case 'weapon':
      return '武器池';
    default:
      return poolId || '未知卡池';
  }
}

function buildImportPoolSummary(rawResults = []) {
  const byPool = {};
  const byPoolType = {};

  (Array.isArray(rawResults) ? rawResults : []).forEach((poolData) => {
    const { type, poolType, records } = poolData || {};

    (Array.isArray(records) ? records : []).forEach((record) => {
      const poolId = getOfficialPoolId(record, type, poolType);
      const normalizedPoolType = getPoolTypeFromId(poolId, type, poolType);
      const poolName = record.poolName || record.pool_name || getDefaultPoolName(poolId, normalizedPoolType);

      byPool[poolName] = (byPool[poolName] || 0) + 1;
      byPoolType[normalizedPoolType] = (byPoolType[normalizedPoolType] || 0) + 1;
    });
  });

  return {
    byPool,
    byPoolType,
  };
}

function getRecordTimestamp(record) {
  if (record.gachaTs) {
    const parsed = parseInt(record.gachaTs, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  if (record.timestamp) {
    if (typeof record.timestamp === 'number') return record.timestamp;
    const parsed = new Date(record.timestamp).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function assignBatchIds(records) {
  const timestampGroups = new Map();

  records.forEach(record => {
    const key = record.timestamp || new Date().toISOString();
    if (!timestampGroups.has(key)) {
      timestampGroups.set(key, []);
    }
    timestampGroups.get(key).push(record);
  });

  const sortedTimestamps = Array.from(timestampGroups.keys()).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  let batchIndex = 0;
  const result = [];

  sortedTimestamps.forEach(timestampKey => {
    const batchId = `batch_${new Date(timestampKey).getTime()}_${batchIndex}`;
    const batch = timestampGroups.get(timestampKey) || [];

    batch.forEach(record => {
      result.push({
        ...record,
        batch_id: batchId
      });
    });

    batchIndex++;
  });

  return result;
}

function splitHistoryUpsertGroups(records) {
  const compositeKeyRecords = [];
  const legacyRecords = [];

  records.forEach(record => {
    if (record.game_uid && record.pool_id && record.seq_id) {
      compositeKeyRecords.push(record);
    } else {
      legacyRecords.push(record);
    }
  });

  return { compositeKeyRecords, legacyRecords };
}

/**
 * 归一化 isStandard 字段（与前端 poolUtils.js 保持一致）
 * 注意：API 原始数据使用驼峰命名 (rarity/charId)，需要兼容两种格式
 */
function normalizeIsStandard(record, poolType, upCharacter) {
  if (record.rarity !== 6) {
    return false;
  }

  if (poolType === 'standard' || poolType === 'beginner') {
    return true;
  }

  if (poolType === 'extra' || poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') {
    if (upCharacter) {
      const characterName = record.character_name || record.item_name || record.name || record.charName || record.weaponName || '';
      return !characterName.includes(upCharacter) && !upCharacter.includes(characterName);
    }

    if (record.isLimited !== undefined) {
      return !record.isLimited;
    }

    return false;
  }

  return false;
}

/**
 * 计算 pity（与前端逻辑保持一致，排除免费十连）
 * pity 值钳制在 [0, 80] 范围内以满足数据库 CHECK 约束
 * 注意：API 原始数据使用驼峰命名 (rarity)，需要兼容
 * 免费十连的 pity 存储为 0（与前端 ImportManager.jsx 保持一致）
 */
function calculatePity(records) {
  const MAX_PITY = 80;
  let pity = 0;
  const processedRecords = [];

  // 与旧前端一致：优先按时间升序，时间相同再按 seqId 升序
  const sortedRecords = [...records].sort((a, b) => {
    const timeA = getRecordTimestamp(a);
    const timeB = getRecordTimestamp(b);
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const seqA = parseInt(a.seqId || a.seq_id || 0, 10);
    const seqB = parseInt(b.seqId || b.seq_id || 0, 10);
    return seqA - seqB;
  });

  for (const record of sortedRecords) {
    const rarity = record.rarity || record.qualityLevel;

    // 与旧前端保持一致：免费十连 pity 记为 0，但若该条是 6 星仍需重置计数器
    if (record.isFree === true) {
      processedRecords.push({
        ...record,
        pity: 0 // 免费十连不计入保底，存储 0 而不是 null
      });
      if (rarity === 6) {
        pity = 0;
      }
      continue;
    }

    pity++;
    
    // 如果是 6 星，重置保底
    if (rarity === 6) {
      processedRecords.push({
        ...record,
        pity: Math.min(pity, MAX_PITY)
      });
      pity = 0;
    } else {
      processedRecords.push({
        ...record,
        pity: Math.min(pity, MAX_PITY)
      });
    }
  }

  return processedRecords;
}

/**
 * 获取已存在的 seq_id（用于去重，带分页以突破 Supabase 1000 行限制）
 */
async function getExistingSeqIds(userId, gameUid) {
  const supabase = getSupabaseAdmin();
  const PAGE_SIZE = 1000;
  const allData = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('history')
      .select('seq_id, pool_id')
      .eq('user_id', userId)
      .eq('game_uid', gameUid)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('[FullImportService] Error fetching existing seq_ids:', error);
      return new Set();
    }

    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < PAGE_SIZE) break; // 最后一页
    from += PAGE_SIZE;
  }

  console.log(`[FullImportService] 已有记录: ${allData.length} 条`);

  // 使用 game_uid:pool_id:seq_id 组合作为唯一标识
  return new Set(allData.map(r => `${gameUid}:${r.pool_id}:${r.seq_id}`));
}

/**
 * 保存卡池到数据库（如果不存在）
 */
export async function savePoolsToServer(pools, userId) {
  const supabase = getSupabaseAdmin();
  const poolAliasMap = await resolvePoolAliasMap(
    supabase,
    pools.map(pool => pool?.pool_id),
    'official_api'
  );
  const canonicalPools = pools.map(pool => ({
    ...pool,
    pool_id: resolveAliasValue(poolAliasMap, pool?.pool_id)
  }));
  const uniquePools = Array.from(
    new Map(canonicalPools.map(pool => [String(pool.pool_id), { ...pool, pool_id: String(pool.pool_id) }])).values()
  );

  // 确保所有 pool_id 都是字符串类型
  const poolIds = uniquePools.map(p => String(p.pool_id));

  // 查询已存在的卡池
  const { data: existingPools } = await supabase
    .from('pools')
    .select('pool_id')
    .in('pool_id', poolIds);

  const existingPoolIds = new Set(existingPools?.map(p => String(p.pool_id)) || []);

  // 只创建不存在的卡池
  const newPools = uniquePools.filter(p => !existingPoolIds.has(String(p.pool_id)));

  if (newPools.length > 0) {
    const { error } = await supabase
      .from('pools')
      .upsert(
        newPools.map(pool => ({
          ...pool,
          user_id: userId,
          created_at: new Date().toISOString()
        })),
        {
          onConflict: 'pool_id',
          ignoreDuplicates: true
        }
      );

    if (error) {
      throw new Error(`Failed to save pools: ${error.message}`);
    }
  }

  // Full import fallback only guarantees canonical pool rows exist.
  // Source alias remaps are owned by pool management / announcement sync,
  // while internal self aliases are maintained by the database trigger.

  return { success: true, created: newPools.length };
}

/**
 * 批量保存记录到数据库（增强错误处理和重试机制）
 * @param {Array} records - 要保存的记录数组
 * @param {string} userId - 用户 ID
 * @returns {Promise<Object>} 保存结果
 */
async function saveHistoryToServer(records, userId) {
  const supabase = getSupabaseAdmin();
  const batchSize = 100;  // 每批次处理 100 条
  const maxRetries = 3;   // 最大重试次数
  let savedCount = 0;
  const failedBatches = [];

  console.log(`[FullImportService] 开始保存 ${records.length} 条记录，分 ${Math.ceil(records.length / batchSize)} 批次`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    let success = false;
    let lastError = null;

    // 重试机制
    for (let retry = 0; retry < maxRetries && !success; retry++) {
      try {
        const batchWithUser = batch.map(record => ({
          ...record,
          user_id: userId
        }));

        const { compositeKeyRecords, legacyRecords } = splitHistoryUpsertGroups(batchWithUser);
        const upsertGroups = [
          { rows: compositeKeyRecords, onConflict: 'user_id,game_uid,pool_id,seq_id' },
          { rows: legacyRecords, onConflict: 'user_id,record_id' }
        ];

        let error = null;
        for (const group of upsertGroups) {
          if (group.rows.length === 0) continue;

          const result = await supabase
            .from('history')
            .upsert(group.rows, { onConflict: group.onConflict });

          if (result.error) {
            error = result.error;
            break;
          }
        }

        if (error) {
          lastError = error;
          // 检查是否是 pity 约束错误
          if (error.message.includes('pity_check') || error.message.includes('pity')) {
            console.error(`[FullImportService] 批次 ${batchIndex} pity 约束错误，尝试修复数据...`);
            // 修复批次中的 pity 值
            const fixedBatch = batchWithUser.map(r => ({
              ...r,
              pity: r.pity === null ? null : Math.max(0, Math.min(80, parseInt(r.pity, 10) || 0))
            }));

            const fixedGroups = splitHistoryUpsertGroups(fixedBatch);
            const retryGroups = [
              { rows: fixedGroups.compositeKeyRecords, onConflict: 'user_id,game_uid,pool_id,seq_id' },
              { rows: fixedGroups.legacyRecords, onConflict: 'user_id,record_id' }
            ];

            let retryError = null;
            for (const group of retryGroups) {
              if (group.rows.length === 0) continue;

              const result = await supabase
                .from('history')
                .upsert(group.rows, { onConflict: group.onConflict });

              if (result.error) {
                retryError = result.error;
                break;
              }
            }

            if (!retryError) {
              success = true;
              savedCount += batch.length;
              continue;
            }
            lastError = retryError;
          }
          
          if (retry < maxRetries - 1) {
            console.warn(`[FullImportService] 批次 ${batchIndex} 失败，${retry + 1}/${maxRetries} 次重试: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // 递增延迟
          }
        } else {
          success = true;
          savedCount += batch.length;
        }
      } catch (err) {
        lastError = err;
        if (retry < maxRetries - 1) {
          console.warn(`[FullImportService] 批次 ${batchIndex} 异常，${retry + 1}/${maxRetries} 次重试: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
        }
      }
    }

    if (!success) {
      console.error(`[FullImportService] 批次 ${batchIndex} 最终失败: ${lastError?.message || 'Unknown error'}`);
      const sample = batch.slice(0, 3).map(record => ({
        record_id: record.record_id,
        pool_id: record.pool_id,
        seq_id: record.seq_id,
        pity: record.pity,
        rarity: record.rarity,
        timestamp: record.timestamp
      }));
      console.error(`[FullImportService] 批次 ${batchIndex} 示例记录:`, sample);
      failedBatches.push({ batchIndex, error: lastError?.message, recordCount: batch.length });
    }

    // 每处理 10 批输出一次进度
    if (batchIndex % 10 === 0) {
      console.log(`[FullImportService] 进度: ${savedCount}/${records.length} (${Math.round(savedCount / records.length * 100)}%)`);
    }
  }

  console.log(`[FullImportService] 保存完成: ${savedCount}/${records.length} 条记录`);

  if (failedBatches.length > 0) {
    console.error(`[FullImportService] ${failedBatches.length} 个批次失败:`, failedBatches);
    const firstFailure = failedBatches[0];
    throw new Error(
      `部分批次保存失败 (${savedCount}/${records.length})，批次 ${firstFailure?.batchIndex || '?'}: ${firstFailure?.error || 'Unknown'}`
    );
  }

  return { 
    success: true, 
    saved: savedCount,
    failed: failedBatches.length > 0 ? failedBatches : undefined
  };
}

/**
 * 处理抽卡记录（转换格式、计算 pity、去重）
 * 将 API 原始格式转换为数据库格式
 * 
 * API 原始字段 -> 数据库字段:
 *   charName/weaponName -> character_name, item_name
 *   charId/weaponId -> used for alias resolution only
 *   rarity -> rarity
 *   gachaTs -> timestamp
 *   seqId -> seq_id
 *   isFree -> is_free
 *   isNew -> is_new
 */
async function processRecords(rawRecords, account, _userId, existingSeqIds, source = 'cn') {
  const { gameUid, nickName, serverId } = account;
  const resolvedServerId = String(serverId || (source === 'intl' ? '2' : '1'));
  const resolvedRegion = resolvedServerId === '1' ? '国服' : 'intl';
  const processedRecords = [];
  const supabase = getSupabaseAdmin();
  const sourcePoolIds = [];
  const sourceCharacterIds = [];

  for (const poolData of rawRecords.results) {
    const { type, poolType, records } = poolData;

    records.forEach((record) => {
      sourcePoolIds.push(getOfficialPoolId(record, type, poolType));
      sourceCharacterIds.push(record.charId || record.weaponId || record.character_id || null);
    });
  }

  const [poolAliasMap, characterAliasMap] = await Promise.all([
    resolvePoolAliasMap(supabase, sourcePoolIds, 'official_api'),
    resolveCharacterAliasMap(supabase, sourceCharacterIds, 'official_api')
  ]);

  for (const poolData of rawRecords.results) {
    const { type, poolType, records, currentUpCharacter } = poolData;

    // 计算 pity
    const recordsWithPity = calculatePity(records);

    for (let index = 0; index < recordsWithPity.length; index++) {
      const record = recordsWithPity[index];
      // 获取 seqId（兼容不同命名格式）
      const seqRaw = record.seqId || record.seq_id;
      const seqId = seqRaw !== undefined && seqRaw !== null ? String(seqRaw) : null;
      const seqIdNum = seqId ? (parseInt(seqId, 10) || index) : index;
      const rawPoolId = getOfficialPoolId(record, type, poolType);
      const poolId = resolveAliasValue(poolAliasMap, rawPoolId);
      const poolHash = simpleStringHash(poolId || 'unknown');
      const normalizedPoolType = getPoolTypeFromId(poolId, type, poolType);
      const uniqueKey = seqId ? `${gameUid}:${poolId}:${seqId}` : null;
      const rawCharacterId = record.charId || record.weaponId || record.character_id || null;
      // eslint-disable-next-line no-unused-vars
      const characterId = resolveAliasValue(characterAliasMap, rawCharacterId);

      // 去重
      if (uniqueKey && existingSeqIds.has(uniqueKey)) {
        continue;
      }

      // 获取角色/武器名称（API 原始字段是 charName/weaponName）
      const characterName = record.charName || record.weaponName || record.character_name || record.name || '未知';
      
      // 获取稀有度（API 原始字段是 rarity）
      const rarity = record.rarity || record.qualityLevel || 4;
      const normalizedRecord = {
        ...record,
        rarity: parseInt(rarity, 10),
        character_name: characterName,
        item_name: characterName,
        name: characterName
      };

      // 归一化 isStandard
      const isStandard = normalizeIsStandard(normalizedRecord, normalizedPoolType, currentUpCharacter);
      
      // 获取时间戳（API 原始字段是 gachaTs，是毫秒级字符串）
      const timestamp = record.gachaTs 
        ? new Date(parseInt(record.gachaTs, 10)).toISOString()
        : record.timestamp 
          ? (typeof record.timestamp === 'number' 
              ? new Date(record.timestamp).toISOString() 
              : new Date(record.timestamp).toISOString())
          : new Date().toISOString();

      // 处理 pity 值：确保在 0-80 范围内（与前端 ImportManager.jsx 保持一致）
      // null/undefined 转换为 0，负数转 0，超过 80 截断为 80，避免字符串/NaN 造成约束错误
      let pityValue = 0;
      if (record.pity !== null && record.pity !== undefined) {
        const parsed = typeof record.pity === 'number' ? record.pity : parseInt(record.pity, 10);
        if (Number.isFinite(parsed)) {
          pityValue = Math.max(0, Math.min(80, parsed));
        }
      }

      processedRecords.push({
        // 主键和关联字段
        record_id: String(poolHash * 10000000 + seqIdNum),
        pool_id: poolId,
        seq_id: seqId,
        game_uid: gameUid,
        nick_name: nickName,
        
        // 数据库必需字段（与前端 ImportManager.jsx 保持一致）
        rarity: parseInt(rarity, 10),
        character_name: characterName,
        item_name: characterName,
        timestamp: timestamp,
        
        // 计算字段
        pity: pityValue,
        is_free: Boolean(record.isFree),
        is_new: Boolean(record.isNew),
        is_standard: isStandard,
        
        // 区服信息
        server_id: resolvedServerId,
        region: resolvedRegion,

        // 其他可选字段
        batch_id: null,
        special_type: null,
        
        // 时间戳
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  return assignBatchIds(processedRecords);
}

/**
 * 导出：完全后端化导入的主函数
 *
 * @param {Object} params
 * @param {string} params.token - 24 位初始 token
 * @param {number} params.accountIndex - 选择的账号索引
 * @param {string} params.userId - Supabase 用户 ID
 * @param {Function} params.updateProgress - 进度更新回调
 * @param {Object} params.authChainFunctions - 认证链函数（从 server.js 传入）
 * @returns {Promise<Object>}
 */
export async function executeFullImport({
  token,
  accountIndex,
  userId,
  updateProgress,
  authChainFunctions,
  source = 'cn'
}) {
  const supabase = getSupabaseAdmin();

  try {
    // 1. 验证用户是否存在
    updateProgress({ progress: 5, message: '验证用户身份...' });
    const { data: authData, error: authUserError } = await supabase.auth.admin.getUserById(userId);
    const authUser = authData?.user || authData || null;

    let userExists = Boolean(authUser?.id);
    let profileLookupError = null;

    // 某些部署环境下 admin.getUserById 可能因配置差异失败，回退到 profiles 再校验一次。
    if (!userExists) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      profileLookupError = error;
      userExists = Boolean(profile?.id);
    }

    if (!userExists) {
      const details = [
        authUserError?.message,
        profileLookupError?.message
      ].filter(Boolean).join(' | ');

      throw new Error(
        details
          ? `Invalid user ID. Check that backend SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY point to the same project as the frontend. Detail: ${details}`
          : 'Invalid user ID. Check that backend SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY point to the same project as the frontend.'
      );
    }

    // 2. 执行认证链 - grant
    updateProgress({ progress: 10, message: '正在验证 token...' });
    const { grantAppToken } = authChainFunctions;
    const grantResult = await grantAppToken(token);
    if (!grantResult.success) {
      throw new Error(grantResult.error || 'Grant failed');
    }
    const appToken = grantResult.data.token;

    // 3. 执行认证链 - bindings
    updateProgress({ progress: 20, message: '正在获取账号列表...' });
    const { fetchBindingList } = authChainFunctions;
    const bindingsResult = await fetchBindingList(appToken);
    if (!bindingsResult.success) {
      throw new Error(bindingsResult.error || 'Bindings failed');
    }
    const accounts = bindingsResult.data.accounts || bindingsResult.data.list;

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    if (accountIndex < 0 || accountIndex >= accounts.length) {
      throw new Error('Invalid account index');
    }

    const account = accounts[accountIndex];

    // 4. 执行认证链 - u8token
    updateProgress({ progress: 30, message: '正在获取访问凭证...' });
    const { fetchU8TokenByUid } = authChainFunctions;
    const u8Result = await fetchU8TokenByUid(account.uid, appToken);
    if (!u8Result.success) {
      throw new Error(u8Result.error || 'U8Token failed');
    }
    const u8Token = u8Result.data.token;

    // 5. 获取抽卡记录
    updateProgress({ progress: 40, message: '正在获取抽卡记录...' });
    const { fetchAllRecordsConcurrent } = authChainFunctions;
    const recordsResult = await fetchAllRecordsConcurrent(u8Token, account.serverId || '1', account.gameUid, account.nickName);
    if (!recordsResult.success) {
      throw new Error(recordsResult.error || 'Records fetch failed');
    }

    // 6. 保存卡池信息
    updateProgress({ progress: 70, message: '正在保存卡池信息...' });
    const pools = [];
    const seenPoolIds = new Set();
    for (const poolData of recordsResult.data.results) {
      const { type, poolType, records, currentUpCharacter } = poolData;

      records.forEach(record => {
        const poolId = getOfficialPoolId(record, type, poolType);
        if (seenPoolIds.has(poolId)) {
          return;
        }
        seenPoolIds.add(poolId);

        const normalizedPoolType = getPoolTypeFromId(poolId, type, poolType);
        pools.push({
          pool_id: poolId,
          name: record.poolName || record.pool_name || getDefaultPoolName(poolId, normalizedPoolType),
          type: normalizedPoolType,
          start_time: null,
          end_time: null,
          up_character: currentUpCharacter || null
        });
      });
    }

    await savePoolsToServer(pools, userId);

    // 7. 获取已存在的记录（用于去重）
    updateProgress({ progress: 75, message: '正在检查重复记录...' });
    const existingSeqIds = await getExistingSeqIds(userId, account.gameUid);

    // 8. 处理记录
    updateProgress({ progress: 80, message: '正在处理数据...' });
    const processedRecords = await processRecords(
      recordsResult.data,
      account,
      userId,
      existingSeqIds,
      source
    );

    // 9. 保存记录
    updateProgress({ progress: 90, message: '正在保存数据...' });
    await saveHistoryToServer(processedRecords, userId);

    // 10. 完成
    updateProgress({ progress: 100, message: '导入完成' });
    const poolSummary = buildImportPoolSummary(recordsResult.data.results);

    return {
      success: true,
      data: {
        totalRecords: recordsResult.data.totalRecords,
        newRecords: processedRecords.length,
        duplicates: recordsResult.data.totalRecords - processedRecords.length,
        byPool: poolSummary.byPool,
        byPoolType: poolSummary.byPoolType,
        partialPools: recordsResult.data.partial || [],
        failedPools: recordsResult.data.failed || [],
        account: {
          gameUid: account.gameUid,
          nickName: account.nickName,
          serverId: String(account.serverId || (source === 'intl' ? '2' : '1'))
        }
      }
    };

  } catch (error) {
    console.error('[FullImportService] Error:', error);
    throw error;
  }
}
