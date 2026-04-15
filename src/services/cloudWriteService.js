import { clampHistoryPity, splitHistoryUpsertGroups } from '../utils/historyRecordUtils.js';
import {
  resolveAliasValue,
  resolveCharacterAliasMap,
  resolvePoolAliasMap,
} from '../../shared/idAliasService.js';

function resolveOwnerId(explicitUserId, currentUserId) {
  return explicitUserId || currentUserId || null;
}

function normalizeTimestamp(timestamp) {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const date = typeof timestamp === 'number'
    ? new Date(timestamp)
    : new Date(timestamp);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeRecordId(record) {
  let recordId = record.id || record.record_id;

  if (typeof recordId === 'string') {
    recordId = parseInt(recordId, 10);
    if (Number.isNaN(recordId)) {
      recordId = parseInt(record.seqId || record.seq_id, 10) || Date.now();
    }
  }

  return recordId;
}

function detectMissingHistoryOptionalColumn(error) {
  const message = String(error?.message || '');

  for (const column of ['character_id', 'server_id', 'region']) {
    if (
      message.includes(`history.${column} does not exist`)
      || message.includes(`Could not find the '${column}' column`)
    ) {
      return column;
    }
  }

  return null;
}

function omitHistoryColumns(rows, omittedColumns) {
  return rows.map((row) => {
    const nextRow = { ...row };
    omittedColumns.forEach((column) => {
      delete nextRow[column];
    });
    return nextRow;
  });
}

export function serializePoolForUpsert(pool, currentUserId, resolvedPoolId = null) {
  const ownerId = resolveOwnerId(pool.user_id, currentUserId);

  return {
    user_id: ownerId,
    pool_id: resolvedPoolId || pool.id || pool.pool_id,
    name: pool.name,
    name_en: pool.name_en || null,
    type: pool.type,
    locked: pool.locked || false,
    is_limited_weapon: pool.isLimitedWeapon !== undefined ? pool.isLimitedWeapon : (pool.is_limited_weapon !== false),
    up_character: pool.upCharacter || pool.up_character || null,
    description: pool.description || null,
    banner_url: pool.banner_url || pool.bannerUrl || null,
    start_time: pool.start_time || pool.startTime || null,
    end_time: pool.end_time || pool.endTime || null,
    featured_characters: pool.featured_characters || null,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertPools(supabaseClient, pools, currentUserId) {
  if (!supabaseClient || !Array.isArray(pools) || pools.length === 0) {
    return;
  }

  const poolAliasMap = await resolvePoolAliasMap(
    supabaseClient,
    pools.map(pool => pool?.id || pool?.pool_id),
    'official_api'
  );

  const rows = pools.map(pool => serializePoolForUpsert(
    pool,
    currentUserId,
    resolveAliasValue(poolAliasMap, pool?.id || pool?.pool_id)
  ));
  const { error } = await supabaseClient.from('pools').upsert(rows, {
    onConflict: 'pool_id'
  });

  if (error) {
    throw error;
  }
}

export function serializeHistoryForUpsert(
  record,
  currentUserId,
  resolvedPoolId = null,
  resolvedCharacterId = null
) {
  return {
    user_id: resolveOwnerId(record.user_id, currentUserId),
    record_id: normalizeRecordId(record),
    pool_id: String(resolvedPoolId || record.poolId || record.pool_id),
    rarity: typeof record.rarity === 'number' ? record.rarity : parseInt(record.rarity, 10) || 4,
    is_standard: Boolean(record.isStandard || record.is_standard),
    special_type: record.specialType || record.special_type || null,
    character_name: record.character_name || record.characterName || record.name || null,
    item_name: record.item_name || record.name || record.character_name || record.characterName || null,
    character_id: resolvedCharacterId || record.character_id || record.item_id || null,
    batch_id: record.batchId || record.batch_id || null,
    seq_id: record.seqId || record.seq_id || null,
    pity: clampHistoryPity(record.pity),
    is_new: Boolean(record.isNew || record.is_new),
    is_free: Boolean(record.isFree || record.is_free),
    game_uid: record.gameUid || record.game_uid || null,
    nick_name: record.nickName || record.nick_name || null,
    server_id: record.serverId || record.server_id || null,
    region: record.region || record.serverRegion || null,
    timestamp: normalizeTimestamp(record.timestamp),
    updated_at: new Date().toISOString(),
  };
}

export async function upsertHistory(supabaseClient, records, currentUserId) {
  if (!supabaseClient || !Array.isArray(records) || records.length === 0) {
    return;
  }

  const [poolAliasMap, characterAliasMap] = await Promise.all([
    resolvePoolAliasMap(
      supabaseClient,
      records.map(record => record?.poolId || record?.pool_id),
      'official_api'
    ),
    resolveCharacterAliasMap(
      supabaseClient,
      records.map(record => record?.character_id || record?.item_id),
      'official_api'
    ),
  ]);

  const rows = records.map(record => serializeHistoryForUpsert(
    record,
    currentUserId,
    resolveAliasValue(poolAliasMap, record?.poolId || record?.pool_id),
    resolveAliasValue(characterAliasMap, record?.character_id || record?.item_id)
  ));
  const { compositeKeyRecords, legacyRecords } = splitHistoryUpsertGroups(rows);
  const upsertGroups = [
    { rows: compositeKeyRecords, onConflict: 'user_id,game_uid,pool_id,seq_id' },
    { rows: legacyRecords, onConflict: 'user_id,record_id' }
  ];
  const supportedOptionalColumns = new Set(['character_id', 'server_id', 'region']);

  for (const group of upsertGroups) {
    if (group.rows.length === 0) continue;

    let pendingRows = omitHistoryColumns(
      group.rows,
      ['character_id', 'server_id', 'region'].filter(column => !supportedOptionalColumns.has(column))
    );

    // 兼容真实库仍缺少 optional 列的环境，按缺失列逐步降级重试
    // 当前已知历史兼容项: character_id / server_id / region
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- retry loop mutates pendingRows between attempts and must stay sequential
      const { error } = await supabaseClient
        .from('history')
        .upsert(pendingRows, { onConflict: group.onConflict });

      if (!error) {
        break;
      }

      const missingColumn = detectMissingHistoryOptionalColumn(error);
      if (!missingColumn || !supportedOptionalColumns.has(missingColumn)) {
        throw error;
      }

      supportedOptionalColumns.delete(missingColumn);
      pendingRows = omitHistoryColumns(group.rows, ['character_id', 'server_id', 'region'].filter(
        column => !supportedOptionalColumns.has(column)
      ));
    }
  }
}
