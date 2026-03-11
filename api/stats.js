import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from './_lib/http.js';

// 内存缓存
const cache = {
  pools: null,
  poolsLastFetch: 0,
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

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
    console.error('API Error:', error);
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
    case 'global_summary':
      return { globalSummary: cache.globalSummary ?? null };
    case 'character_ranking':
      return { characterRanking: cache.characterRanking ?? null };
    case 'all':
      return {
        pools: cache.pools ?? [],
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

  const data = await fetchVisiblePools(supabase);

  cache.pools = data || [];
  cache.poolsLastFetch = now;

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
    .select('*')
    .order('rarity', { ascending: false });

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

  const { data, error } = await supabase.rpc('get_global_stats');
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

  const { data, error } = await supabase.rpc('get_character_ranking_stats');
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
    characters: [],
    globalSummary: null,
    characterRanking: null
  };

  // 并行获取所有数据
  const [poolsResult, charactersResult, globalSummaryResult, characterRankingResult] = await Promise.allSettled([
    fetchVisiblePools(supabase),
    supabase.from('characters').select('*').order('rarity', { ascending: false }),
    supabase.rpc('get_global_stats'),
    supabase.rpc('get_character_ranking_stats')
  ]);

  // 处理卡池
  if (poolsResult.status === 'fulfilled') {
    result.pools = poolsResult.value || [];
    cache.pools = result.pools;
    cache.poolsLastFetch = now;
  } else if (cache.pools !== null) {
    result.pools = cache.pools;
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

