import { supabase } from '../supabaseClient';
import { loadPublicProfilesMap } from './publicProfileService';
import { executeSupabaseRead, executeSupabaseRpc } from './supabaseRequest';

function getRoleWeight(role) {
  if (role === 'super_admin') return 3;
  if (role === 'admin') return 2;
  return 1;
}

function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function getPoolRecordId(record) {
  return record?.pool_id || record?.id || null;
}

function hasFeaturedCharacters(record) {
  return Array.isArray(record?.featured_characters) && record.featured_characters.length > 0;
}

function isSharedPoolId(poolId) {
  if (!poolId || typeof poolId !== 'string') {
    return false;
  }

  return (
    poolId === 'standard' ||
    poolId === 'beginner' ||
    poolId.startsWith('special_') ||
    poolId.startsWith('weponbox_') ||
    poolId.startsWith('weaponbox_')
  );
}

function getPoolCompletenessScore(record) {
  return (
    (hasText(record.up_character) ? 4 : 0) +
    (record.start_time ? 2 : 0) +
    (record.end_time ? 2 : 0) +
    (hasFeaturedCharacters(record) ? 1 : 0) +
    (hasText(record.banner_url) ? 1 : 0) +
    (hasText(record.description) ? 1 : 0) +
    (record.locked ? 1 : 0)
  );
}

function getSortTimestamp(record) {
  const source = record.start_time || record.created_at || record.updated_at || 0;
  const value = new Date(source).getTime();
  return Number.isFinite(value) ? value : 0;
}

function shouldPreferCandidate(existingRecord, candidateRecord, currentUserId) {
  const existingRoleWeight = getRoleWeight(existingRecord.creator_role);
  const candidateRoleWeight = getRoleWeight(candidateRecord.creator_role);
  if (existingRoleWeight !== candidateRoleWeight) {
    return candidateRoleWeight > existingRoleWeight;
  }

  const existingScore = getPoolCompletenessScore(existingRecord);
  const candidateScore = getPoolCompletenessScore(candidateRecord);
  if (existingScore !== candidateScore) {
    return candidateScore > existingScore;
  }

  const existingOwned = existingRecord.user_id && existingRecord.user_id === currentUserId;
  const candidateOwned = candidateRecord.user_id && candidateRecord.user_id === currentUserId;
  if (existingOwned !== candidateOwned) {
    return candidateOwned;
  }

  return getSortTimestamp(candidateRecord) > getSortTimestamp(existingRecord);
}

function sortVisiblePoolRecords(left, right) {
  const diff = getSortTimestamp(right) - getSortTimestamp(left);
  if (diff !== 0) return diff;
  return String(getPoolRecordId(left) || '').localeCompare(String(getPoolRecordId(right) || ''));
}

function isVisiblePoolRecord(record, currentUserId) {
  return (
    isSharedPoolId(getPoolRecordId(record)) ||
    !record?.user_id ||
    record.user_id === currentUserId ||
    record.locked === true ||
    record.creator_role === 'admin' ||
    record.creator_role === 'super_admin'
  );
}

function isTimedLimitedPool(record) {
  const poolType = normalizeRemotePoolType(record?.type, record?.is_limited_weapon);
  return poolType === 'limited' && record?.start_time && record?.end_time && hasText(record?.up_character);
}

function hasActiveTimedLimitedPool(records, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return (records || []).some((record) => {
    if (!isTimedLimitedPool(record)) {
      return false;
    }

    const start = new Date(record.start_time);
    const end = new Date(record.end_time);
    return now >= start && now < end;
  });
}

function dedupeVisiblePoolRecords(records, currentUserId) {
  const deduped = new Map();

  (records || []).forEach((record) => {
    const poolId = getPoolRecordId(record);
    if (!poolId) {
      return;
    }

    const existing = deduped.get(poolId);
    if (!existing || shouldPreferCandidate(existing, record, currentUserId)) {
      deduped.set(poolId, record);
    }
  });

  return Array.from(deduped.values()).sort(sortVisiblePoolRecords);
}

function shouldBackfillFromLegacyQuery(rpcRows) {
  if (!Array.isArray(rpcRows) || rpcRows.length === 0) {
    return true;
  }

  return !hasActiveTimedLimitedPool(rpcRows);
}

function shouldFallbackToLegacyPoolQuery(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    message.includes('get_app_visible_pools')
  );
}

async function getCurrentSessionUserId() {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.user?.id || null;
}

async function loadPoolRowsByIds(poolIds) {
  const normalizedIds = [...new Set(
    (Array.isArray(poolIds) ? poolIds : [])
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean)
  )];

  if (normalizedIds.length === 0) {
    return [];
  }

  const { data: poolRows, error } = await executeSupabaseRead(
    () => supabase
      .from('pools')
      .select('pool_id, name, type, locked, is_limited_weapon, created_at, updated_at, user_id, up_character, description, banner_url, start_time, end_time, featured_characters')
      .in('pool_id', normalizedIds),
    {
      label: 'loadPoolRowsByIds',
      retries: 1
    }
  );

  if (error) {
    throw error;
  }

  return poolRows || [];
}

async function loadVisiblePoolsFromLegacyQuery(currentUserId = null, options = {}) {
  const { format = true } = options;
  const { data: poolRows, error } = await executeSupabaseRead(
    () => supabase
      .from('pools')
      .select('pool_id, name, type, locked, is_limited_weapon, created_at, updated_at, user_id, up_character, description, banner_url, start_time, end_time, featured_characters'),
    {
      label: 'loadVisiblePoolsFromLegacyQuery',
      retries: 2
    }
  );

  if (error) {
    throw error;
  }

  const resolvedUserId = currentUserId ?? await getCurrentSessionUserId();
  const profilesMap = await loadPublicProfilesMap((poolRows || []).map((row) => row.user_id));

  const visibleRows = (poolRows || [])
    .map((row) => ({
      ...row,
      creator_username: profilesMap.get(row.user_id)?.username || null,
      creator_role: profilesMap.get(row.user_id)?.role || null
    }))
    .filter((row) => isVisiblePoolRecord(row, resolvedUserId));

  const dedupedRows = dedupeVisiblePoolRecords(visibleRows, resolvedUserId);
  return format ? dedupedRows.map(formatVisiblePoolRecord) : dedupedRows;
}

export function normalizeRemotePoolType(type, isLimitedWeaponFlag) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'weapon' && isLimitedWeaponFlag === false) return 'weapon';
  return type || 'standard';
}

export function formatVisiblePoolRecord(record) {
  return {
    id: record.pool_id,
    name: record.name,
    type: normalizeRemotePoolType(record.type, record.is_limited_weapon),
    locked: record.locked || false,
    isLimitedWeapon: record.is_limited_weapon !== false,
    created_at: record.created_at || null,
    updated_at: record.updated_at || null,
    user_id: record.user_id || null,
    creator_username: record.creator_username || null,
    creator_role: record.creator_role || null,
    up_character: record.up_character || null,
    description: record.description || null,
    banner_url: record.banner_url || null,
    start_time: record.start_time || null,
    end_time: record.end_time || null,
    featured_characters: record.featured_characters || null
  };
}

export async function loadVisiblePools() {
  if (!supabase) {
    return [];
  }

  const currentUserId = await getCurrentSessionUserId();
  const { data, error } = await executeSupabaseRpc(
    () => supabase.rpc('get_app_visible_pools'),
    {
      label: 'get_app_visible_pools',
      retries: 2
    }
  );
  if (error) {
    if (!shouldFallbackToLegacyPoolQuery(error)) {
      throw error;
    }

    return loadVisiblePoolsFromLegacyQuery(currentUserId);
  }

  const rpcRows = dedupeVisiblePoolRecords(data || [], currentUserId);
  if (!shouldBackfillFromLegacyQuery(rpcRows)) {
    return rpcRows.map(formatVisiblePoolRecord);
  }

  const legacyRows = await loadVisiblePoolsFromLegacyQuery(currentUserId, { format: false });
  const mergedRows = dedupeVisiblePoolRecords([...rpcRows, ...legacyRows], currentUserId);
  return mergedRows.map(formatVisiblePoolRecord);
}

export async function loadPoolsByIds(poolIds) {
  if (!supabase) {
    return [];
  }

  const poolRows = await loadPoolRowsByIds(poolIds);
  if (poolRows.length === 0) {
    return [];
  }

  const profilesMap = await loadPublicProfilesMap((poolRows || []).map((row) => row.user_id));

  return poolRows
    .map((row) => ({
      ...row,
      creator_username: profilesMap.get(row.user_id)?.username || null,
      creator_role: profilesMap.get(row.user_id)?.role || null
    }))
    .sort(sortVisiblePoolRecords)
    .map(formatVisiblePoolRecord);
}

export default {
  loadVisiblePools,
  loadPoolsByIds,
  normalizeRemotePoolType,
  formatVisiblePoolRecord
};
