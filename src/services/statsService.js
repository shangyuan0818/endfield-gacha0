import { supabase } from '../supabaseClient';
import { RARITY_CONFIG } from '../constants';
import { buildResourceSummaryFromAggregates } from '../utils/resourceEconomy';
import {
  getBootstrapCharacterRanking,
  getBootstrapGlobalSummary
} from './bootstrapService';
import {
  SUPABASE_RPC_TIMEOUT_MS,
  executeSupabaseRpc,
  fetchWithTimeout,
  isRetryableSupabaseError,
} from './supabaseRequest';

/**
 * 统计服务
 * 架构说明：
 * - 公共全服数据：Bootstrap API -> Stats API -> Supabase RPC -> localStorage
 * - 个人数据：Supabase RPC -> localStorage
 */

const GLOBAL_STATS_CACHE_TTL = 30 * 1000;
const CHARACTER_RANKING_CACHE_TTL = 30 * 1000;
const GLOBAL_STATS_SNAPSHOT_KEY = 'global_summary_stats_snapshot';
const CHARACTER_RANKING_SNAPSHOT_KEY = 'character_ranking_snapshot';
const USER_RANKING_SNAPSHOT_PREFIX = 'user_ranking_snapshot_';
const STATS_API_TIMEOUT_MS = 25000;
const IS_LOCAL_DEV = import.meta.env.DEV;
const globalStatsRequestState = {
  data: null,
  fetchedAt: 0,
  promise: null
};

const characterRankingRequestState = {
  data: null,
  fetchedAt: 0,
  promise: null
};

const userRankingRequestStates = new Map();

function readPersistedSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePersistedSnapshot(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // 忽略持久化缓存失败
  }
}

function withStatsMeta(stats, meta = {}) {
  return {
    ...stats,
    meta: {
      ...(stats?.meta || {}),
      ...meta
    }
  };
}

async function fetchStatsApi(type) {
  if (IS_LOCAL_DEV) {
    return null;
  }

  const response = await fetchWithTimeout(`/api/stats?type=${type}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    label: `stats api ${type}`,
    timeoutMs: STATS_API_TIMEOUT_MS,
    retries: 1
  });

  if (!response.ok) {
    throw new Error(`stats api ${type} failed with ${response.status}`);
  }

  const result = await response.json();
  if (!result?.success) {
    throw new Error(result?.error || `stats api ${type} returned failure`);
  }

  return result.data || null;
}

async function fetchGlobalSummaryDirect() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await runRpcWithTimeout('get_global_stats');
  if (error) {
    throw error;
  }

  return data ?? null;
}

async function fetchCharacterRankingDirect() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await runRpcWithTimeout('get_character_ranking_stats');
  if (error) {
    throw error;
  }

  return data ?? null;
}

function createEmptyTypeStats() {
  return {
    total: 0,
    six: 0,
    sixStarLimited: 0,
    sixStarStandard: 0,
    avgPity: null,
    avgPityUp: null,
    sparkCount: 0,
    avgPityExcludingFree: null,
    counts: {},
    distribution: [],
    chartData: [],
    resources: buildResourceSummaryFromAggregates()
  };
}

export function createEmptyGlobalSummaryStats(meta = {}) {
  return {
    totalPulls: 0,
    totalPullsWithFree: 0,
    freePullCount: 0,
    totalUsers: 0,
    totalContributors: 0,
    sixStarTotal: 0,
    sixStarLimited: 0,
    sixStarStandard: 0,
    fiveStar: 0,
    fourStar: 0,
    counts: {},
    distribution: [],
    chartData: [],
    byType: {
      limited: createEmptyTypeStats(),
      weapon: createEmptyTypeStats(),
      standard: createEmptyTypeStats(),
      character: createEmptyTypeStats()
    },
    avgPity: null,
    charGift: 0,
    weaponGiftLimited: 0,
    weaponGiftStandard: 0,
    giftTotal: 0,
    resources: buildResourceSummaryFromAggregates(),
    meta: {
      status: 'empty',
      source: 'empty',
      ...meta
    }
  };
}

function isFreshCache(state, ttl) {
  return state.data !== null && Date.now() - state.fetchedAt < ttl;
}

async function runCachedRequest(state, fetcher, { cacheTtl = 0, forceRefresh = false } = {}) {
  if (!forceRefresh && cacheTtl > 0 && isFreshCache(state, cacheTtl)) {
    return state.data;
  }

  if (!forceRefresh && state.promise) {
    return state.promise;
  }

  state.promise = (async () => {
    const result = await fetcher();
    state.data = result;
    state.fetchedAt = Date.now();
    return result;
  })();

  try {
    return await state.promise;
  } finally {
    state.promise = null;
  }
}

async function runRpcWithTimeout(rpcName, params = {}, timeoutMs = SUPABASE_RPC_TIMEOUT_MS) {
  return executeSupabaseRpc(
    () => supabase.rpc(rpcName, params),
    {
      label: rpcName,
      timeoutMs,
    }
  );
}

function generateChartData(counts) {
  if (!counts) return [];

  const rawData = [
    { name: '6星(限定)', value: counts['6'] || 0, color: RARITY_CONFIG[6].color },
    { name: '6星(常驻)', value: counts['6_std'] || 0, color: RARITY_CONFIG['6_std'].color },
    { name: '5星', value: counts['5'] || 0, color: RARITY_CONFIG[5].color },
    { name: '4星', value: counts['4'] || 0, color: RARITY_CONFIG[4].color },
  ].filter(item => item.value > 0);

  const totalValue = rawData.reduce((sum, item) => sum + item.value, 0);

  return rawData.map(item => {
    const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    let minPercent = 0;

    if (item.name.includes('6星')) minPercent = 15;
    else if (item.name.includes('5星')) minPercent = 20;

    if (currentPercent < minPercent && totalValue > 0) {
      return {
        ...item,
        displayValue: Math.ceil(totalValue * minPercent / 100)
      };
    }

    return {
      ...item,
      displayValue: item.value
    };
  });
}

function processDistribution(distribution) {
  if (!Array.isArray(distribution)) return [];

  return distribution.map(item => ({
    range: item.range,
    limited: Number(item.limited) || 0,
    standard: Number(item.standard) || 0
  }));
}

function processTypeStats(typeData) {
  if (!typeData) {
    return createEmptyTypeStats();
  }

  const total = typeData.total || 0;
  const counts = typeData.counts || {};
  const normalizedType = typeData.poolType || null;

  return {
    total,
    six: typeData.six || 0,
    sixStarLimited: typeData.sixStarLimited || 0,
    sixStarStandard: typeData.sixStarStandard || 0,
    avgPity: typeData.avgPity || null,
    avgPityUp: typeData.avgPityUp || null,
    sparkCount: typeData.sparkCount || 0,
    avgPityExcludingFree: typeData.avgPityExcludingFree || null,
    counts,
    distribution: processDistribution(typeData.distribution),
    chartData: generateChartData(counts),
    resources: buildResourceSummaryFromAggregates({
      characterPulls: normalizedType === 'weapon' ? 0 : total,
      weaponPulls: normalizedType === 'weapon' ? total : 0,
      counts
    })
  };
}

function mergeDistributions(primary = [], secondary = []) {
  const grouped = new Map();

  [...primary, ...secondary].forEach(item => {
    const existing = grouped.get(item.range);
    if (existing) {
      existing.limited += item.limited || 0;
      existing.standard += item.standard || 0;
      return;
    }

    grouped.set(item.range, {
      range: item.range,
      limited: item.limited || 0,
      standard: item.standard || 0
    });
  });

  return Array.from(grouped.values()).sort((left, right) => {
    const leftStart = parseInt(left.range.split('-')[0], 10) || 91;
    const rightStart = parseInt(right.range.split('-')[0], 10) || 91;
    return leftStart - rightStart;
  });
}

function normalizeGlobalStats(rpcData) {
  if (!rpcData) {
    return createEmptyGlobalSummaryStats();
  }

  const stats = {
    totalPulls: rpcData.totalPulls || 0,
    totalPullsWithFree: rpcData.totalPullsWithFree || rpcData.totalPulls || 0,
    freePullCount: rpcData.freePullCount || 0,
    totalUsers: rpcData.totalUsers || 0,
    totalContributors: rpcData.totalContributors || 0,
    sixStarTotal: rpcData.sixStarTotal || 0,
    sixStarLimited: rpcData.sixStarLimited || 0,
    sixStarStandard: rpcData.sixStarStandard || 0,
    fiveStar: rpcData.fiveStar || 0,
    fourStar: rpcData.fourStar || 0,
    counts: rpcData.counts || {},
    distribution: processDistribution(rpcData.distribution),
    chartData: generateChartData(rpcData.counts),
    byType: {
      limited: processTypeStats({ ...rpcData.byType?.limited, poolType: 'limited' }),
      weapon: processTypeStats({ ...rpcData.byType?.weapon, poolType: 'weapon' }),
      standard: processTypeStats({ ...rpcData.byType?.standard, poolType: 'standard' })
    },
    avgPity: rpcData.avgPity || null,
    charGift: rpcData.charGift || 0,
    weaponGiftLimited: rpcData.weaponGiftLimited || 0,
    weaponGiftStandard: rpcData.weaponGiftStandard || 0,
    giftTotal: rpcData.giftTotal || 0,
    meta: {
      status: 'ready',
      source: 'rpc',
      fetchedAt: Date.now()
    }
  };

  const limitedStats = stats.byType.limited;
  const standardStats = stats.byType.standard;
  const limitedSix = limitedStats.six || 0;
  const standardSix = standardStats.six || 0;
  const totalSix = limitedSix + standardSix;

  let characterAvgPity = null;
  if (totalSix > 0 && (limitedStats.avgPity || standardStats.avgPity)) {
    const limitedAvg = Number(limitedStats.avgPity) || 0;
    const standardAvg = Number(standardStats.avgPity) || 0;
    characterAvgPity = ((limitedAvg * limitedSix + standardAvg * standardSix) / totalSix).toFixed(1);
  }

  let characterAvgPityExcludingFree = null;
  if (totalSix > 0 && (limitedStats.avgPityExcludingFree || standardStats.avgPityExcludingFree)) {
    const limitedAvgExcludingFree = Number(limitedStats.avgPityExcludingFree) || Number(limitedStats.avgPity) || 0;
    const standardAvgExcludingFree = Number(standardStats.avgPityExcludingFree) || Number(standardStats.avgPity) || 0;
    characterAvgPityExcludingFree = ((limitedAvgExcludingFree * limitedSix + standardAvgExcludingFree * standardSix) / totalSix).toFixed(1);
  }

  stats.byType.character = {
    total: limitedStats.total + standardStats.total,
    six: limitedStats.six + standardStats.six,
    sixStarLimited: limitedStats.sixStarLimited + standardStats.sixStarLimited,
    sixStarStandard: limitedStats.sixStarStandard + standardStats.sixStarStandard,
    avgPity: characterAvgPity,
    avgPityUp: null,
    sparkCount: limitedStats.sparkCount || 0,
    avgPityExcludingFree: characterAvgPityExcludingFree,
    counts: {
      '6': (limitedStats.counts['6'] || 0) + (standardStats.counts['6'] || 0),
      '6_std': (limitedStats.counts['6_std'] || 0) + (standardStats.counts['6_std'] || 0),
      '5': (limitedStats.counts['5'] || 0) + (standardStats.counts['5'] || 0),
      '4': (limitedStats.counts['4'] || 0) + (standardStats.counts['4'] || 0)
    },
    distribution: mergeDistributions(limitedStats.distribution, standardStats.distribution),
    chartData: generateChartData({
      '6': (limitedStats.counts['6'] || 0) + (standardStats.counts['6'] || 0),
      '6_std': (limitedStats.counts['6_std'] || 0) + (standardStats.counts['6_std'] || 0),
      '5': (limitedStats.counts['5'] || 0) + (standardStats.counts['5'] || 0),
      '4': (limitedStats.counts['4'] || 0) + (standardStats.counts['4'] || 0)
    }),
    resources: buildResourceSummaryFromAggregates({
      characterPulls: limitedStats.total + standardStats.total,
      counts: {
        '6': (limitedStats.counts['6'] || 0) + (standardStats.counts['6'] || 0),
        '6_std': (limitedStats.counts['6_std'] || 0) + (standardStats.counts['6_std'] || 0),
        '5': (limitedStats.counts['5'] || 0) + (standardStats.counts['5'] || 0),
        '4': (limitedStats.counts['4'] || 0) + (standardStats.counts['4'] || 0)
      }
    })
  };

  stats.resources = buildResourceSummaryFromAggregates({
    characterPulls: stats.byType.character.total,
    weaponPulls: stats.byType.weapon.total,
    counts: stats.counts
  });

  return stats;
}

function getUserRankingRequestState(userId) {
  if (!userRankingRequestStates.has(userId)) {
    userRankingRequestStates.set(userId, {
      data: null,
      fetchedAt: 0,
      promise: null
    });
  }

  return userRankingRequestStates.get(userId);
}

function isRecoverableStatsError(error) {
  return isRetryableSupabaseError(error);
}

function logStatsFailure(scope, error) {
  if (isRecoverableStatsError(error)) {
    console.warn(`[statsService] ${scope}请求超时，已回退到缓存/空态（跨境网络较慢时可重试）`, error);
    return;
  }

  console.error(`[statsService] ${scope}失败:`, error);
}

/**
 * 获取全服统计概览
 * 单飞 + 短 TTL 缓存，避免统计页和初始化阶段重复打重 RPC
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<Object|null>} 归一化后的全服统计数据
 */
export async function getGlobalSummaryStats(forceRefresh = false) {
  try {
    return await runCachedRequest(
      globalStatsRequestState,
      async () => {
        const bootstrapSummary = await getBootstrapGlobalSummary(forceRefresh).catch(() => null);
        if (bootstrapSummary) {
          const normalizedFromBootstrap = withStatsMeta(normalizeGlobalStats(bootstrapSummary), {
            source: 'bootstrap',
            fetchedAt: Date.now()
          });
          writePersistedSnapshot(GLOBAL_STATS_SNAPSHOT_KEY, normalizedFromBootstrap);
          return normalizedFromBootstrap;
        }

        const apiPayload = await fetchStatsApi('global_summary').catch(() => null);
        if (apiPayload?.globalSummary) {
          const normalizedFromApi = withStatsMeta(normalizeGlobalStats(apiPayload.globalSummary), {
            source: 'api',
            fetchedAt: Date.now()
          });
          writePersistedSnapshot(GLOBAL_STATS_SNAPSHOT_KEY, normalizedFromApi);
          return normalizedFromApi;
        }

        const directSummary = await fetchGlobalSummaryDirect().catch(() => null);
        if (directSummary) {
          const normalizedFromDirect = withStatsMeta(normalizeGlobalStats(directSummary), {
            source: 'supabase-direct',
            fetchedAt: Date.now()
          });
          writePersistedSnapshot(GLOBAL_STATS_SNAPSHOT_KEY, normalizedFromDirect);
          return normalizedFromDirect;
        }

        const persistedSnapshot = readPersistedSnapshot(GLOBAL_STATS_SNAPSHOT_KEY);
        if (persistedSnapshot) {
          return withStatsMeta(persistedSnapshot, {
            status: 'stale',
            source: 'local-cache'
          });
        }

        return createEmptyGlobalSummaryStats({
          status: 'unavailable',
          source: 'missing-bootstrap'
        });
      },
      { cacheTtl: GLOBAL_STATS_CACHE_TTL, forceRefresh }
    );
  } catch (error) {
    logStatsFailure('获取全服统计', error);
    const persisted = readPersistedSnapshot(GLOBAL_STATS_SNAPSHOT_KEY);

    if (globalStatsRequestState.data) {
      return withStatsMeta(globalStatsRequestState.data, {
        status: 'stale',
        source: 'memory-cache',
        lastErrorCode: error?.code || null
      });
    }

    if (persisted) {
      return withStatsMeta(persisted, {
        status: 'stale',
        source: 'local-cache',
        lastErrorCode: error?.code || null
      });
    }

    return createEmptyGlobalSummaryStats({
      status: 'unavailable',
      source: 'timeout',
      lastErrorCode: error?.code || null
    });
  }
}

/**
 * 获取角色出货排名统计
 * 全服排行榜变化慢，复用短 TTL 缓存避免 StrictMode 和切页重复请求
 * @returns {Promise<Object>} 角色排名数据
 */
export async function getCharacterRankingStats(forceRefresh = false) {
  try {
    return await runCachedRequest(
      characterRankingRequestState,
      async () => {
        const bootstrapRanking = await getBootstrapCharacterRanking(forceRefresh).catch(() => null);
        if (bootstrapRanking) {
          writePersistedSnapshot(CHARACTER_RANKING_SNAPSHOT_KEY, bootstrapRanking);
          return bootstrapRanking;
        }

        const apiPayload = await fetchStatsApi('character_ranking').catch(() => null);
        if (apiPayload?.characterRanking) {
          writePersistedSnapshot(CHARACTER_RANKING_SNAPSHOT_KEY, apiPayload.characterRanking);
          return apiPayload.characterRanking;
        }

        const directRanking = await fetchCharacterRankingDirect().catch(() => null);
        if (directRanking) {
          writePersistedSnapshot(CHARACTER_RANKING_SNAPSHOT_KEY, directRanking);
          return directRanking;
        }

        return readPersistedSnapshot(CHARACTER_RANKING_SNAPSHOT_KEY);
      },
      { cacheTtl: CHARACTER_RANKING_CACHE_TTL, forceRefresh }
    );
  } catch (error) {
    logStatsFailure('获取角色排名', error);
    return characterRankingRequestState.data || readPersistedSnapshot(CHARACTER_RANKING_SNAPSHOT_KEY) || null;
  }
}

/**
 * 获取用户个人出货排名统计
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 用户个人排名数据
 */
export async function getUserRankingStats(userId) {
  try {
    if (!supabase) {
      console.warn('[statsService] Supabase 未配置，无法获取用户排名');
      return readPersistedSnapshot(`${USER_RANKING_SNAPSHOT_PREFIX}${userId}`);
    }

    if (!userId) {
      console.warn('[statsService] 未提供用户ID');
      return null;
    }

    const requestState = getUserRankingRequestState(userId);

    return await runCachedRequest(
      requestState,
      async () => {
        const { data, error } = await runRpcWithTimeout('get_user_ranking_stats', { p_user_id: userId });

        if (error) {
          throw error;
        }

        writePersistedSnapshot(`${USER_RANKING_SNAPSHOT_PREFIX}${userId}`, data);
        return data;
      }
    );
  } catch (error) {
    logStatsFailure('获取用户排名', error);
    return getUserRankingRequestState(userId).data || readPersistedSnapshot(`${USER_RANKING_SNAPSHOT_PREFIX}${userId}`) || null;
  }
}

