import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from './_lib/http.js';

const CACHE_TTL = 60 * 1000;

const cache = {
  payload: null,
  lastFetch: 0
};

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

function normalizeRemotePoolType(type, isLimitedWeaponFlag) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'weapon' && isLimitedWeaponFlag === false) return 'weapon';
  return type || 'standard';
}

function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function isSharedPoolId(poolId) {
  if (!poolId || typeof poolId !== 'string') {
    return false;
  }

  return (
    poolId === 'standard'
    || poolId === 'beginner'
    || poolId.startsWith('special_')
    || poolId.startsWith('weponbox_')
    || poolId.startsWith('weaponbox_')
  );
}

function getPoolRecordId(record) {
  return record?.pool_id || record?.id || null;
}

function hasFeaturedCharacters(record) {
  return Array.isArray(record?.featured_characters) && record.featured_characters.length > 0;
}

function getRoleWeight(role) {
  if (role === 'super_admin') return 3;
  if (role === 'admin') return 2;
  return 1;
}

function getPoolCompletenessScore(record) {
  return (
    (hasText(record?.up_character) ? 4 : 0)
    + (record?.start_time ? 2 : 0)
    + (record?.end_time ? 2 : 0)
    + (hasFeaturedCharacters(record) ? 1 : 0)
    + (hasText(record?.banner_url) ? 1 : 0)
    + (hasText(record?.description) ? 1 : 0)
    + (record?.locked ? 1 : 0)
  );
}

function getSortTimestamp(record) {
  const source = record?.start_time || record?.created_at || record?.updated_at || 0;
  const value = new Date(source).getTime();
  return Number.isFinite(value) ? value : 0;
}

function shouldPreferCandidate(existingRecord, candidateRecord) {
  const existingRoleWeight = getRoleWeight(existingRecord?.creator_role);
  const candidateRoleWeight = getRoleWeight(candidateRecord?.creator_role);
  if (existingRoleWeight !== candidateRoleWeight) {
    return candidateRoleWeight > existingRoleWeight;
  }

  const existingScore = getPoolCompletenessScore(existingRecord);
  const candidateScore = getPoolCompletenessScore(candidateRecord);
  if (existingScore !== candidateScore) {
    return candidateScore > existingScore;
  }

  return getSortTimestamp(candidateRecord) > getSortTimestamp(existingRecord);
}

function sortVisiblePoolRecords(left, right) {
  const diff = getSortTimestamp(right) - getSortTimestamp(left);
  if (diff !== 0) {
    return diff;
  }

  return String(getPoolRecordId(left) || '').localeCompare(String(getPoolRecordId(right) || ''));
}

function isVisiblePoolRecord(record) {
  return (
    isSharedPoolId(getPoolRecordId(record))
    || !record?.user_id
    || record?.locked === true
    || record?.creator_role === 'admin'
    || record?.creator_role === 'super_admin'
  );
}

function isTimedLimitedPool(record) {
  const poolType = normalizeRemotePoolType(record?.type, record?.is_limited_weapon);
  return poolType === 'limited' && record?.start_time && record?.end_time && hasText(record?.up_character);
}

function shouldBackfillFromLegacyQuery(rpcRows) {
  if (!Array.isArray(rpcRows) || rpcRows.length === 0) {
    return true;
  }

  const now = new Date();
  return !rpcRows.some((record) => {
    if (!isTimedLimitedPool(record)) {
      return false;
    }

    const start = new Date(record.start_time);
    const end = new Date(record.end_time);
    return now >= start && now < end;
  });
}

function dedupeVisiblePoolRecords(records) {
  const deduped = new Map();

  (records || []).forEach((record) => {
    const poolId = getPoolRecordId(record);
    if (!poolId) {
      return;
    }

    const existing = deduped.get(poolId);
    if (!existing || shouldPreferCandidate(existing, record)) {
      deduped.set(poolId, record);
    }
  });

  return Array.from(deduped.values()).sort(sortVisiblePoolRecords);
}

function formatVisiblePoolRecord(record) {
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

function createEmptyBootstrapPayload() {
  return {
    siteConfig: {},
    pools: [],
    globalSummary: null,
    characterRanking: null
  };
}

function mergeBootstrapPayload(previousPayload, nextPartialPayload) {
  const previous = previousPayload || createEmptyBootstrapPayload();
  const next = nextPartialPayload || {};

  return {
    siteConfig: next.siteConfig ?? previous.siteConfig ?? {},
    pools: next.pools ?? previous.pools ?? [],
    globalSummary: next.globalSummary ?? previous.globalSummary ?? null,
    characterRanking: next.characterRanking ?? previous.characterRanking ?? null
  };
}

async function fetchSiteConfig(supabase) {
  const { data, error } = await supabase
    .from('site_config')
    .select('key, value');

  if (error) {
    throw error;
  }

  return (data || []).reduce((config, row) => {
    config[row.key] = row.value;
    return config;
  }, {});
}

async function fetchVisiblePools(supabase) {
  const { data, error } = await supabase.rpc('get_app_visible_pools');
  const rpcRows = dedupeVisiblePoolRecords(data || []);

  if (!error && !shouldBackfillFromLegacyQuery(rpcRows)) {
    return rpcRows.map(formatVisiblePoolRecord);
  }

  const { data: poolRows, error: poolError } = await supabase
    .from('pools')
    .select('pool_id, name, type, locked, is_limited_weapon, created_at, updated_at, user_id, up_character, description, banner_url, start_time, end_time, featured_characters');

  if (poolError) {
    if (error) {
      throw error;
    }
    throw poolError;
  }

  const userIds = [...new Set((poolRows || []).map((row) => row.user_id).filter(Boolean))];
  let publicProfilesMap = new Map();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('public_profiles')
      .select('id, username, role')
      .in('id', userIds);

    publicProfilesMap = new Map((profileRows || []).map((profile) => [profile.id, profile]));
  }

  const visibleLegacyRows = (poolRows || [])
    .map((row) => ({
      ...row,
      creator_username: publicProfilesMap.get(row.user_id)?.username || null,
      creator_role: publicProfilesMap.get(row.user_id)?.role || null
    }))
    .filter(isVisiblePoolRecord);

  const mergedRows = dedupeVisiblePoolRecords([...rpcRows, ...visibleLegacyRows]);
  return mergedRows.map(formatVisiblePoolRecord);
}

async function fetchGlobalSummary(supabase) {
  const { data, error } = await supabase.rpc('get_global_stats');
  if (error) {
    throw error;
  }

  return data ?? null;
}

async function fetchCharacterRanking(supabase) {
  const { data, error } = await supabase.rpc('get_character_ranking_stats');
  if (error) {
    throw error;
  }

  return data ?? null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, OPTIONS'
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const now = Date.now();
  const cachedPayload = cache.payload || createEmptyBootstrapPayload();

  if (cache.payload && now - cache.lastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      partial: false,
      data: cache.payload
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(200).json({
      success: true,
      cached: true,
      partial: false,
      data: cachedPayload,
      message: 'Database not configured, returning cached/default data'
    });
  }

  const [siteConfigResult, poolsResult, globalSummaryResult, characterRankingResult] = await Promise.allSettled([
    fetchSiteConfig(supabase),
    fetchVisiblePools(supabase),
    fetchGlobalSummary(supabase),
    fetchCharacterRanking(supabase)
  ]);

  const nextPayload = mergeBootstrapPayload(cachedPayload, {
    siteConfig: siteConfigResult.status === 'fulfilled' ? siteConfigResult.value : undefined,
    pools: poolsResult.status === 'fulfilled' ? poolsResult.value : undefined,
    globalSummary: globalSummaryResult.status === 'fulfilled' ? globalSummaryResult.value : undefined,
    characterRanking: characterRankingResult.status === 'fulfilled' ? characterRankingResult.value : undefined
  });

  cache.payload = nextPayload;
  cache.lastFetch = now;

  const criticalResults = [poolsResult, globalSummaryResult, characterRankingResult];
  const partial = criticalResults.some((result) => result.status === 'rejected');

  return res.status(200).json({
    success: true,
    cached: false,
    partial,
    data: nextPayload
  });
}
