import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import { serverLogger } from './_lib/serverLogger.js';

// 内存缓存
const cache = {
  pools: null,
  poolsLastFetch: 0,
  poolCatalog: null,
  poolCatalogLastFetch: 0,
  characters: null,
  charactersLastFetch: 0,
  globalSummary: null,
  globalSummaryLastFetch: 0,
  characterRanking: null,
  characterRankingLastFetch: 0
};

const CACHE_TTL = 60 * 1000; // 60秒缓存

// 创建 Supabase 客户端
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

async function fetchVisiblePools(supabase) {
  const { data, error } = await supabase.rpc('get_app_visible_pools');
  if (error) {
    throw error;
  }

  return data || [];
}

function normalizeRemotePoolType(type, isLimitedWeaponFlag) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'weapon' && isLimitedWeaponFlag === false) return 'weapon';
  return type || 'standard';
}

function getPoolRecordId(record) {
  return record?.pool_id || record?.id || null;
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

  return Array.from(deduped.values()).sort(sortPoolCatalogRecords);
}

function formatVisiblePoolRecord(record) {
  return {
    id: record.pool_id,
    name: record.name,
    name_en: record.name_en || null,
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

function getPoolCatalogSortTimestamp(record) {
  const source = record?.start_time || record?.created_at || record?.updated_at || 0;
  const value = new Date(source).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortPoolCatalogRecords(left, right) {
  const diff = getPoolCatalogSortTimestamp(right) - getPoolCatalogSortTimestamp(left);
  if (diff !== 0) {
    return diff;
  }

  return String(left?.pool_id || left?.id || '').localeCompare(String(right?.pool_id || right?.id || ''));
}

async function fetchPublicProfilesMap(supabase, userIds = []) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, role')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((profile) => [profile.id, profile]));
}

async function fetchPoolCatalog(supabase) {
  const { data, error } = await supabase
    .from('pools')
    .select('pool_id, name, name_en, type, locked, is_limited_weapon, created_at, updated_at, user_id, up_character, description, banner_url, start_time, end_time, featured_characters');

  if (error) {
    throw error;
  }

  const poolRows = data || [];
  const profilesMap = await fetchPublicProfilesMap(
    supabase,
    poolRows.map((row) => row.user_id)
  );

  return poolRows
    .map((row) => ({
      ...row,
      creator_username: profilesMap.get(row.user_id)?.username || null,
      creator_role: profilesMap.get(row.user_id)?.role || null
    }))
    .sort(sortPoolCatalogRecords)
    .map(formatVisiblePoolRecord);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, OPTIONS' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { type } = req.query;
  const now = Date.now();

  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      // 返回缓存数据或默认值
      return res.status(200).json({
        success: true,
        cached: true,
        data: getCachedData(type),
        message: 'Database not configured, returning cached/default data'
      });
    }

    switch (type) {
      case 'pools':
        return await handlePools(supabase, res, now);
      case 'pool_catalog':
        return await handlePoolCatalog(supabase, res, now);
      case 'characters':
        return await handleCharacters(supabase, res, now);
      case 'global_summary':
        return await handleGlobalSummary(supabase, res, now);
      case 'character_ranking':
        return await handleCharacterRanking(supabase, res, now);
      case 'all':
        return await handleAll(supabase, res, now);
      default:
        return res.status(400).json({ success: false, error: 'Invalid type parameter' });
    }
  } catch (error) {
    serverLogger.error('stats.api.error', {
      message: error?.message || String(error),
      type,
    });
    // 返回缓存数据
    return res.status(200).json({
      success: true,
      cached: true,
      data: getCachedData(type),
      error: error.message
    });
  }
}

// 获取缓存数据
function getCachedData(type) {
  switch (type) {
    case 'pools':
      return { pools: cache.pools ?? [] };
    case 'characters':
      return { characters: cache.characters ?? [] };
    case 'pool_catalog':
      return { pools: cache.poolCatalog ?? [] };
    case 'global_summary':
      return { globalSummary: cache.globalSummary ?? null };
    case 'character_ranking':
      return { characterRanking: cache.characterRanking ?? null };
    case 'all':
      return {
        pools: cache.pools ?? [],
        poolCatalog: cache.poolCatalog ?? [],
        characters: cache.characters ?? [],
        globalSummary: cache.globalSummary ?? null,
        characterRanking: cache.characterRanking ?? null
      };
    default:
      return {};
  }
}

// 处理卡池列表
async function handlePools(supabase, res, now) {
  // 检查缓存
  if (cache.pools !== null && now - cache.poolsLastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: { pools: cache.pools }
    });
  }

  const data = dedupeVisiblePoolRecords(await fetchVisiblePools(supabase)).map(formatVisiblePoolRecord);

  cache.pools = data || [];
  cache.poolsLastFetch = now;

  return res.status(200).json({
    success: true,
    cached: false,
    data: { pools: data || [] }
  });
}

// 处理角色列表
async function handlePoolCatalog(supabase, res, now) {
  if (cache.poolCatalog !== null && now - cache.poolCatalogLastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: { pools: cache.poolCatalog }
    });
  }

  const data = await fetchPoolCatalog(supabase);

  cache.poolCatalog = data || [];
  cache.poolCatalogLastFetch = now;

  return res.status(200).json({
    success: true,
    cached: false,
    data: { pools: data || [] }
  });
}

// 处理角色列表
async function handleCharacters(supabase, res, now) {
  // 检查缓存
  if (cache.characters !== null && now - cache.charactersLastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: { characters: cache.characters }
    });
  }

  const { data, error } = await supabase
    .from('characters')
    .select('id, name, avatar_url, rarity, type, aliases, is_limited, release_date, created_at, updated_at, pool_config')
    .order('name');

  if (error) {
    throw error;
  }

  cache.characters = data || [];
  cache.charactersLastFetch = now;

  return res.status(200).json({
    success: true,
    cached: false,
    data: { characters: data || [] }
  });
}

async function handleGlobalSummary(supabase, res, now) {
  if (cache.globalSummary !== null && now - cache.globalSummaryLastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: { globalSummary: cache.globalSummary }
    });
  }

  const { data, error } = await supabase.rpc('get_global_stats_cached');
  if (error) {
    throw error;
  }

  cache.globalSummary = data ?? null;
  cache.globalSummaryLastFetch = now;

  return res.status(200).json({
    success: true,
    cached: false,
    data: { globalSummary: data ?? null }
  });
}

async function handleCharacterRanking(supabase, res, now) {
  if (cache.characterRanking !== null && now - cache.characterRankingLastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: { characterRanking: cache.characterRanking }
    });
  }

  const { data, error } = await supabase.rpc('get_character_ranking_stats_cached');
  if (error) {
    throw error;
  }

  cache.characterRanking = data ?? null;
  cache.characterRankingLastFetch = now;

  return res.status(200).json({
    success: true,
    cached: false,
    data: { characterRanking: data ?? null }
  });
}

// 处理所有数据（一次性获取）
async function handleAll(supabase, res, now) {
  const result = {
    pools: [],
    poolCatalog: [],
    characters: [],
    globalSummary: null,
    characterRanking: null
  };

  // 并行获取所有数据
  const [poolsResult, poolCatalogResult, charactersResult, globalSummaryResult, characterRankingResult] = await Promise.allSettled([
    fetchVisiblePools(supabase),
    fetchPoolCatalog(supabase),
    supabase
      .from('characters')
      .select('id, name, avatar_url, rarity, type, aliases, is_limited, release_date, created_at, updated_at, pool_config')
      .order('name'),
    supabase.rpc('get_global_stats_cached'),
    supabase.rpc('get_character_ranking_stats_cached')
  ]);

  // 处理卡池
  if (poolsResult.status === 'fulfilled') {
    result.pools = dedupeVisiblePoolRecords(poolsResult.value || []).map(formatVisiblePoolRecord);
    cache.pools = result.pools;
    cache.poolsLastFetch = now;
  } else if (cache.pools !== null) {
    result.pools = cache.pools;
  }

  if (poolCatalogResult.status === 'fulfilled') {
    result.poolCatalog = poolCatalogResult.value || [];
    cache.poolCatalog = result.poolCatalog;
    cache.poolCatalogLastFetch = now;
  } else if (cache.poolCatalog !== null) {
    result.poolCatalog = cache.poolCatalog;
  }

  // 处理角色
  if (charactersResult.status === 'fulfilled' && !charactersResult.value.error) {
    result.characters = charactersResult.value.data || [];
    cache.characters = result.characters;
    cache.charactersLastFetch = now;
  } else if (cache.characters !== null) {
    result.characters = cache.characters;
  }

  if (globalSummaryResult.status === 'fulfilled' && !globalSummaryResult.value.error) {
    result.globalSummary = globalSummaryResult.value.data ?? null;
    cache.globalSummary = result.globalSummary;
    cache.globalSummaryLastFetch = now;
  } else if (cache.globalSummary !== null) {
    result.globalSummary = cache.globalSummary;
  }

  if (characterRankingResult.status === 'fulfilled' && !characterRankingResult.value.error) {
    result.characterRanking = characterRankingResult.value.data ?? null;
    cache.characterRanking = result.characterRanking;
    cache.characterRankingLastFetch = now;
  } else if (cache.characterRanking !== null) {
    result.characterRanking = cache.characterRanking;
  }

  return res.status(200).json({
    success: true,
    cached: false,
    data: result
  });
}

