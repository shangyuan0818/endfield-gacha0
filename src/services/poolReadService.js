import { supabase } from '../supabaseClient';
import { loadPublicProfilesMap } from './publicProfileService';
import { executeSupabaseRead, executeSupabaseRpc } from './supabaseRequest';

function getPoolRecordId(record) {
  return record?.pool_id || record?.id || null;
}

function getSortTimestamp(record) {
  const source = record.start_time || record.created_at || record.updated_at || 0;
  const value = new Date(source).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortVisiblePoolRecords(left, right) {
  const diff = getSortTimestamp(right) - getSortTimestamp(left);
  if (diff !== 0) return diff;
  return String(getPoolRecordId(left) || '').localeCompare(String(getPoolRecordId(right) || ''));
}

function dedupeVisiblePoolRecords(records) {
  const deduped = new Map();

  (records || []).forEach((record) => {
    const poolId = getPoolRecordId(record);
    if (!poolId) {
      return;
    }

    if (!deduped.has(poolId)) {
      deduped.set(poolId, record);
    }
  });

  return Array.from(deduped.values()).sort(sortVisiblePoolRecords);
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

async function loadAllPoolRows() {
  const { data: poolRows, error } = await executeSupabaseRead(
    () => supabase
      .from('pools')
      .select('pool_id, name, type, locked, is_limited_weapon, created_at, updated_at, user_id, up_character, description, banner_url, start_time, end_time, featured_characters'),
    {
      label: 'loadAllPoolRows',
      retries: 1
    }
  );

  if (error) {
    throw error;
  }

  return poolRows || [];
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

export function mergePoolCollections(primaryPools = [], fallbackPools = []) {
  const merged = new Map();

  [...fallbackPools, ...primaryPools].forEach((pool) => {
    if (!pool?.id) {
      return;
    }

    const existing = merged.get(pool.id) || {};
    merged.set(pool.id, {
      ...existing,
      ...pool
    });
  });

  return Array.from(merged.values()).sort(sortVisiblePoolRecords);
}

export async function loadVisiblePools() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await executeSupabaseRpc(
    () => supabase.rpc('get_app_visible_pools'),
    {
      label: 'get_app_visible_pools',
      retries: 2
    }
  );
  if (error) {
    throw error;
  }

  return dedupeVisiblePoolRecords(data || []).map(formatVisiblePoolRecord);
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

export async function loadAllPoolsForCatalog() {
  if (!supabase) {
    return [];
  }

  const poolRows = await loadAllPoolRows();
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
  loadAllPoolsForCatalog,
  mergePoolCollections,
  normalizeRemotePoolType,
  formatVisiblePoolRecord
};
