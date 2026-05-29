import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import {
  buildPublicCacheKey,
  PUBLIC_CACHE_CONTROL,
  readRequestCacheVersion,
  resolvePublicCacheVersion,
  sendPublicJson,
} from '../../_lib/publicCache.js';
import { serverLogger } from '../../_lib/serverLogger.js';
import {
  resolveSupabaseServerKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

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
  characterRankingLastFetch: 0,
  characterCatalog: null,
  characterCatalogLastFetch: 0,
  metaByType: {}
};

const CACHE_TTL = 60 * 1000; // 60秒缓存
const PRIVATE_CHARACTER_CATALOG_KEYS = new Set([
  'user_id',
  'game_uid',
  'history_id',
  'record_id',
  'platform_user_id',
  'email'
]);

// 创建 Supabase 客户端
function getSupabaseClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseServerKey();
  
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

function stripPrivateCharacterCatalogFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripPrivateCharacterCatalogFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_CHARACTER_CATALOG_KEYS.has(key))
      .map(([key, nestedValue]) => [key, stripPrivateCharacterCatalogFields(nestedValue)])
  );
}

function sanitizeCharacterCatalog(catalog) {
  return catalog ? stripPrivateCharacterCatalogFields(catalog) : null;
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
  res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);

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
  const supabase = getSupabaseClient();
  const cacheVersion = await resolvePublicCacheVersion(supabase, {
    requestVersion: readRequestCacheVersion(req)
  });
  const cacheKey = getStatsPublicCacheKey(type, cacheVersion);
  const context = { cacheKey, cacheVersion };

  try {
    if (!supabase) {
      // 返回缓存数据或默认值
      return sendPublicJson(res, {
        cached: true,
        data: getCachedData(type),
        source: getAnyCachedLastFetch(type) > 0 ? 'memory-cache' : 'default',
        stale: getAnyCachedLastFetch(type) > 0,
        partial: true,
        cacheKey,
        cacheVersion,
        lastFetch: getAnyCachedLastFetch(type),
        message: 'Database not configured, returning cached/default data'
      });
    }

    switch (type) {
      case 'pools':
        return await handlePools(supabase, res, now, context);
      case 'pool_catalog':
        return await handlePoolCatalog(supabase, res, now, context);
      case 'characters':
        return await handleCharacters(supabase, res, now, context);
      case 'global_summary':
        return await handleGlobalSummary(supabase, res, now, context);
      case 'character_ranking':
        return await handleCharacterRanking(supabase, res, now, context);
      case 'character_catalog':
        return await handleCharacterCatalog(supabase, res, now, context);
      case 'all':
        return await handleAll(supabase, res, now, context);
      default:
        return res.status(400).json({ success: false, error: 'Invalid type parameter' });
    }
  } catch (error) {
    serverLogger.error('stats.api.error', {
      message: error?.message || String(error),
      type,
    });
    // 返回缓存数据
    return sendPublicJson(res, {
      cached: true,
      data: getCachedData(type),
      source: getAnyCachedLastFetch(type) > 0 ? 'memory-cache' : 'default',
      stale: getAnyCachedLastFetch(type) > 0,
      partial: true,
      cacheKey,
      cacheVersion,
      lastFetch: getAnyCachedLastFetch(type),
      error: error.message
    });
  }
}

function getStatsPublicCacheKey(type, cacheVersion) {
  return buildPublicCacheKey(['stats', type || 'unknown', `v${cacheVersion}`]);
}

function getTypeMeta(type) {
  return cache.metaByType?.[type] || null;
}

function setTypeMeta(type, meta) {
  cache.metaByType[type] = {
    ...(cache.metaByType[type] || {}),
    ...meta,
  };
}

function isFreshTypeCache(type, lastFetch, now, cacheKey) {
  const meta = getTypeMeta(type);
  return lastFetch > 0
    && now - lastFetch < CACHE_TTL
    && (!meta?.cacheKey || meta.cacheKey === cacheKey);
}

function sendStatsJson(res, _type, {
  data,
  cached = false,
  partial = false,
  stale = false,
  source = null,
  context,
  lastFetch = 0,
  error = null,
} = {}) {
  return sendPublicJson(res, {
    data,
    cached,
    partial,
    stale,
    source,
    cacheKey: context?.cacheKey,
    cacheVersion: context?.cacheVersion,
    lastFetch,
    error,
  });
}

function getAnyCachedLastFetch(type) {
  switch (type) {
    case 'pools':
      return cache.poolsLastFetch || 0;
    case 'characters':
      return cache.charactersLastFetch || 0;
    case 'pool_catalog':
      return cache.poolCatalogLastFetch || 0;
    case 'global_summary':
      return cache.globalSummaryLastFetch || 0;
    case 'character_ranking':
      return cache.characterRankingLastFetch || 0;
    case 'character_catalog':
      return cache.characterCatalogLastFetch || 0;
    case 'all':
      return Math.max(
        cache.poolsLastFetch || 0,
        cache.poolCatalogLastFetch || 0,
        cache.charactersLastFetch || 0,
        cache.globalSummaryLastFetch || 0,
        cache.characterRankingLastFetch || 0,
        cache.characterCatalogLastFetch || 0
      );
    default:
      return 0;
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
    case 'character_catalog':
      return { characterCatalog: sanitizeCharacterCatalog(cache.characterCatalog) };
    case 'all':
      return {
        pools: cache.pools ?? [],
        poolCatalog: cache.poolCatalog ?? [],
        characters: cache.characters ?? [],
        globalSummary: cache.globalSummary ?? null,
        characterRanking: cache.characterRanking ?? null,
        characterCatalog: sanitizeCharacterCatalog(cache.characterCatalog)
      };
    default:
      return {};
  }
}

// 处理卡池列表
async function handlePools(supabase, res, now, context) {
  // 检查缓存
  if (cache.pools !== null && isFreshTypeCache('pools', cache.poolsLastFetch, now, context.cacheKey)) {
    return sendStatsJson(res, 'pools', {
      cached: true,
      data: { pools: cache.pools },
      source: 'memory-cache',
      context,
      lastFetch: cache.poolsLastFetch
    });
  }

  const data = dedupeVisiblePoolRecords(await fetchVisiblePools(supabase)).map(formatVisiblePoolRecord);

  cache.pools = data || [];
  cache.poolsLastFetch = now;
  setTypeMeta('pools', context);

  return sendStatsJson(res, 'pools', {
    cached: false,
    data: { pools: data || [] },
    source: 'origin',
    context,
    lastFetch: cache.poolsLastFetch
  });
}

// 处理角色列表
async function handlePoolCatalog(supabase, res, now, context) {
  if (cache.poolCatalog !== null && isFreshTypeCache('pool_catalog', cache.poolCatalogLastFetch, now, context.cacheKey)) {
    return sendStatsJson(res, 'pool_catalog', {
      cached: true,
      data: { pools: cache.poolCatalog },
      source: 'memory-cache',
      context,
      lastFetch: cache.poolCatalogLastFetch
    });
  }

  const data = await fetchPoolCatalog(supabase);

  cache.poolCatalog = data || [];
  cache.poolCatalogLastFetch = now;
  setTypeMeta('pool_catalog', context);

  return sendStatsJson(res, 'pool_catalog', {
    cached: false,
    data: { pools: data || [] },
    source: 'origin',
    context,
    lastFetch: cache.poolCatalogLastFetch
  });
}

// 处理角色列表
async function handleCharacters(supabase, res, now, context) {
  // 检查缓存
  if (cache.characters !== null && isFreshTypeCache('characters', cache.charactersLastFetch, now, context.cacheKey)) {
    return sendStatsJson(res, 'characters', {
      cached: true,
      data: { characters: cache.characters },
      source: 'memory-cache',
      context,
      lastFetch: cache.charactersLastFetch
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
  setTypeMeta('characters', context);

  return sendStatsJson(res, 'characters', {
    cached: false,
    data: { characters: data || [] },
    source: 'origin',
    context,
    lastFetch: cache.charactersLastFetch
  });
}

async function handleGlobalSummary(supabase, res, now, context) {
  if (cache.globalSummary !== null && isFreshTypeCache('global_summary', cache.globalSummaryLastFetch, now, context.cacheKey)) {
    return sendStatsJson(res, 'global_summary', {
      cached: true,
      data: { globalSummary: cache.globalSummary },
      source: 'memory-cache',
      context,
      lastFetch: cache.globalSummaryLastFetch
    });
  }

  const { data, error } = await supabase.rpc('get_global_stats_cached');
  if (error) {
    throw error;
  }

  cache.globalSummary = data ?? null;
  cache.globalSummaryLastFetch = now;
  setTypeMeta('global_summary', context);

  return sendStatsJson(res, 'global_summary', {
    cached: false,
    data: { globalSummary: data ?? null },
    source: 'origin',
    context,
    lastFetch: cache.globalSummaryLastFetch
  });
}

async function handleCharacterRanking(supabase, res, now, context) {
  if (cache.characterRanking !== null && isFreshTypeCache('character_ranking', cache.characterRankingLastFetch, now, context.cacheKey)) {
    return sendStatsJson(res, 'character_ranking', {
      cached: true,
      data: { characterRanking: cache.characterRanking },
      source: 'memory-cache',
      context,
      lastFetch: cache.characterRankingLastFetch
    });
  }

  const { data, error } = await supabase.rpc('get_character_ranking_stats_cached');
  if (error) {
    throw error;
  }

  cache.characterRanking = data ?? null;
  cache.characterRankingLastFetch = now;
  setTypeMeta('character_ranking', context);

  return sendStatsJson(res, 'character_ranking', {
    cached: false,
    data: { characterRanking: data ?? null },
    source: 'origin',
    context,
    lastFetch: cache.characterRankingLastFetch
  });
}

async function handleCharacterCatalog(supabase, res, now, context) {
  if (cache.characterCatalog !== null && isFreshTypeCache('character_catalog', cache.characterCatalogLastFetch, now, context.cacheKey)) {
    return sendStatsJson(res, 'character_catalog', {
      cached: true,
      data: { characterCatalog: sanitizeCharacterCatalog(cache.characterCatalog) },
      source: 'memory-cache',
      context,
      lastFetch: cache.characterCatalogLastFetch
    });
  }

  const { data, error } = await supabase.rpc('get_character_catalog_stats_cached');
  if (error) {
    throw error;
  }

  cache.characterCatalog = sanitizeCharacterCatalog(data);
  cache.characterCatalogLastFetch = now;
  setTypeMeta('character_catalog', context);

  return sendStatsJson(res, 'character_catalog', {
    cached: false,
    data: { characterCatalog: cache.characterCatalog },
    source: 'origin',
    context,
    lastFetch: cache.characterCatalogLastFetch
  });
}

// 处理所有数据（一次性获取）
async function handleAll(supabase, res, now, context) {
  const result = {
    pools: [],
    poolCatalog: [],
    characters: [],
    globalSummary: null,
    characterRanking: null,
    characterCatalog: null
  };

  // 并行获取所有数据
  const [
    poolsResult,
    poolCatalogResult,
    charactersResult,
    globalSummaryResult,
    characterRankingResult,
    characterCatalogResult
  ] = await Promise.allSettled([
    fetchVisiblePools(supabase),
    fetchPoolCatalog(supabase),
    supabase
      .from('characters')
      .select('id, name, avatar_url, rarity, type, aliases, is_limited, release_date, created_at, updated_at, pool_config')
      .order('name'),
    supabase.rpc('get_global_stats_cached'),
    supabase.rpc('get_character_ranking_stats_cached'),
    supabase.rpc('get_character_catalog_stats_cached')
  ]);

  // 处理卡池
  if (poolsResult.status === 'fulfilled') {
    result.pools = dedupeVisiblePoolRecords(poolsResult.value || []).map(formatVisiblePoolRecord);
    cache.pools = result.pools;
    cache.poolsLastFetch = now;
    setTypeMeta('pools', getAllChildContext(context, 'pools'));
  } else if (cache.pools !== null) {
    result.pools = cache.pools;
  }

  if (poolCatalogResult.status === 'fulfilled') {
    result.poolCatalog = poolCatalogResult.value || [];
    cache.poolCatalog = result.poolCatalog;
    cache.poolCatalogLastFetch = now;
    setTypeMeta('pool_catalog', getAllChildContext(context, 'pool_catalog'));
  } else if (cache.poolCatalog !== null) {
    result.poolCatalog = cache.poolCatalog;
  }

  // 处理角色
  if (charactersResult.status === 'fulfilled' && !charactersResult.value.error) {
    result.characters = charactersResult.value.data || [];
    cache.characters = result.characters;
    cache.charactersLastFetch = now;
    setTypeMeta('characters', getAllChildContext(context, 'characters'));
  } else if (cache.characters !== null) {
    result.characters = cache.characters;
  }

  if (globalSummaryResult.status === 'fulfilled' && !globalSummaryResult.value.error) {
    result.globalSummary = globalSummaryResult.value.data ?? null;
    cache.globalSummary = result.globalSummary;
    cache.globalSummaryLastFetch = now;
    setTypeMeta('global_summary', getAllChildContext(context, 'global_summary'));
  } else if (cache.globalSummary !== null) {
    result.globalSummary = cache.globalSummary;
  }

  if (characterRankingResult.status === 'fulfilled' && !characterRankingResult.value.error) {
    result.characterRanking = characterRankingResult.value.data ?? null;
    cache.characterRanking = result.characterRanking;
    cache.characterRankingLastFetch = now;
    setTypeMeta('character_ranking', getAllChildContext(context, 'character_ranking'));
  } else if (cache.characterRanking !== null) {
    result.characterRanking = cache.characterRanking;
  }

  if (characterCatalogResult.status === 'fulfilled' && !characterCatalogResult.value.error) {
    result.characterCatalog = sanitizeCharacterCatalog(characterCatalogResult.value.data);
    cache.characterCatalog = result.characterCatalog;
    cache.characterCatalogLastFetch = now;
    setTypeMeta('character_catalog', getAllChildContext(context, 'character_catalog'));
  } else if (cache.characterCatalog !== null) {
    result.characterCatalog = sanitizeCharacterCatalog(cache.characterCatalog);
  }

  return sendStatsJson(res, 'all', {
    cached: false,
    partial: [
      poolsResult,
      poolCatalogResult,
      charactersResult,
      globalSummaryResult,
      characterRankingResult,
      characterCatalogResult
    ].some((resultItem) => resultItem.status === 'rejected' || resultItem.value?.error),
    data: result,
    source: 'origin',
    context,
    lastFetch: getAnyCachedLastFetch('all')
  });
}

function getAllChildContext(context, type) {
  return {
    ...context,
    cacheKey: getStatsPublicCacheKey(type, context.cacheVersion),
  };
}

