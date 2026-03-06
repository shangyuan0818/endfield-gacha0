import { clampHistoryPity, splitHistoryUpsertGroups } from '../utils/historyRecordUtils';

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

export function serializePoolForUpsert(pool, currentUserId) {
  const ownerId = resolveOwnerId(pool.user_id, currentUserId);

  return {
    user_id: ownerId,
    pool_id: pool.id || pool.pool_id,
    name: pool.name,
    type: pool.type,
    locked: pool.locked || false,
    is_limited_weapon: pool.isLimitedWeapon !== undefined ? pool.isLimitedWeapon : (pool.is_limited_weapon !== false),
    game_uid: pool.gameUid || pool.game_uid || null,
    nick_name: pool.nickName || pool.nick_name || null,
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

  const rows = pools.map(pool => serializePoolForUpsert(pool, currentUserId));
  const { error } = await supabaseClient.from('pools').upsert(rows, {
    onConflict: 'pool_id'
  });

  if (error) {
    throw error;
  }
}

export function serializeHistoryForUpsert(record, currentUserId) {
  return {
    user_id: resolveOwnerId(record.user_id, currentUserId),
    record_id: normalizeRecordId(record),
    pool_id: String(record.poolId || record.pool_id),
    rarity: typeof record.rarity === 'number' ? record.rarity : parseInt(record.rarity, 10) || 4,
    is_standard: Boolean(record.isStandard || record.is_standard),
    special_type: record.specialType || record.special_type || null,
    character_name: record.character_name || record.characterName || record.name || null,
    item_name: record.item_name || record.name || record.character_name || record.characterName || null,
    batch_id: record.batchId || record.batch_id || null,
    seq_id: record.seqId || record.seq_id || null,
    pity: clampHistoryPity(record.pity),
    is_new: Boolean(record.isNew || record.is_new),
    is_free: Boolean(record.isFree || record.is_free),
    game_uid: record.gameUid || record.game_uid || null,
    timestamp: normalizeTimestamp(record.timestamp),
    updated_at: new Date().toISOString(),
  };
}

export async function upsertHistory(supabaseClient, records, currentUserId) {
  if (!supabaseClient || !Array.isArray(records) || records.length === 0) {
    return;
  }

  const rows = records.map(record => serializeHistoryForUpsert(record, currentUserId));
  const { compositeKeyRecords, legacyRecords } = splitHistoryUpsertGroups(rows);
  const upsertGroups = [
    { rows: compositeKeyRecords, onConflict: 'user_id,game_uid,pool_id,seq_id' },
    { rows: legacyRecords, onConflict: 'user_id,record_id' }
  ];

  for (const group of upsertGroups) {
    if (group.rows.length === 0) continue;

    const { error } = await supabaseClient
      .from('history')
      .upsert(group.rows, { onConflict: group.onConflict });

    if (error) {
      throw error;
    }
  }
}
