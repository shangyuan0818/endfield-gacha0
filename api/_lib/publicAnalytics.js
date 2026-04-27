import {
  fetchCharacterRanking,
  fetchCharacters,
  fetchGlobalSummary,
  fetchVisiblePools,
  toPublicPoolDto,
} from './publicCatalog.js';

const HEAVY_PAGE_DEFAULT = 20;
const HEAVY_PAGE_MAX = 50;

function normalizeQueryValue(value) {
  return String(value || '').trim();
}

function normalizeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLimit(value, {
  defaultValue = 50,
  max = 100,
} = {}) {
  const parsed = normalizeInteger(value);
  if (!parsed || parsed < 1) {
    return defaultValue;
  }

  return Math.min(parsed, max);
}

function encodeCursor(offset) {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) {
    return 0;
  }

  const decoded = Number.parseInt(Buffer.from(String(cursor), 'base64url').toString('utf8'), 10);
  return Number.isFinite(decoded) && decoded > 0 ? decoded : 0;
}

function paginateArray(items, query = {}, options = {}) {
  const limit = normalizeLimit(query.limit, options);
  const offset = decodeCursor(query.cursor);
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;

  return {
    items: pageItems,
    page: {
      limit,
      nextCursor: nextOffset < items.length ? encodeCursor(nextOffset) : null,
      hasMore: nextOffset < items.length,
      total: items.length,
    },
  };
}

function parseDateMs(value) {
  if (!value) {
    return NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getPoolStatus(pool, nowMs = Date.now()) {
  const startMs = parseDateMs(pool?.start_time);
  const endMs = parseDateMs(pool?.end_time);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 'permanent';
  }

  if (nowMs < startMs) {
    return 'upcoming';
  }

  if (nowMs >= endMs) {
    return 'ended';
  }

  return 'active';
}

function normalizePoolType(type, poolId = '') {
  if (type === 'limited_character' || type === 'limited') return 'limited';
  if (type === 'limited_weapon' || type === 'weapon') return 'weapon';
  if (type === 'extra') return 'extra';
  if (type === 'beginner' || type === 'standard') return 'standard';
  if (String(poolId).startsWith('special_')) return 'limited';
  if (String(poolId).startsWith('weapon') || String(poolId).startsWith('wepon')) return 'weapon';
  return 'standard';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDistribution(distribution = []) {
  if (!Array.isArray(distribution)) {
    return [];
  }

  return distribution.map((bucket) => {
    const bucketName = bucket.bucket || bucket.range || 'unknown';
    const count = Object.entries(bucket)
      .filter(([key, value]) => key !== 'bucket' && key !== 'range' && Number.isFinite(Number(value)))
      .reduce((total, [, value]) => total + Number(value), 0);

    return {
      bucket: bucketName,
      count,
      segments: Object.fromEntries(
        Object.entries(bucket).filter(([key]) => key !== 'bucket' && key !== 'range')
      ),
    };
  });
}

function normalizeSummaryCounter(raw = {}) {
  const counts = raw.counts || {};
  const sixStarTotal = toNumber(raw.six ?? raw.sixStarTotal ?? counts[6] ?? raw.sixStarLimited, 0)
    + toNumber(counts['6_std'], 0);

  return {
    totalPulls: toNumber(raw.chargedPulls ?? raw.total ?? raw.totalPulls, 0),
    totalPullsWithFree: toNumber(raw.total ?? raw.totalPullsWithFree ?? raw.chargedPulls ?? raw.totalPulls, 0),
    freePullCount: toNumber(raw.freePullCount, 0),
    rarityCounts: {
      4: toNumber(counts[4] ?? raw.fourStar, 0),
      5: toNumber(counts[5] ?? raw.fiveStar, 0),
      6: sixStarTotal,
    },
    targetSixStar: toNumber(raw.sixStarLimited ?? counts[6] ?? raw.six, 0),
    offrateSixStar: toNumber(raw.sixStarStandard ?? counts['6_std'], 0),
    averagePity: {
      sixStar: raw.avgPity ?? null,
      fiveStar: raw.avgPityFiveStar ?? null,
      targetSixStar: raw.avgPityTarget ?? raw.avgPityUp ?? null,
    },
    distribution: normalizeDistribution(raw.distribution),
  };
}

function buildTypeSummary(globalSummary = {}) {
  return Object.fromEntries(
    Object.entries(globalSummary.byType || {}).map(([type, value]) => [
      normalizePoolType(type),
      normalizeSummaryCounter(value),
    ])
  );
}

function applyPublicHistoryBaseFilters(query) {
  return query
    .or('special_type.is.null,special_type.neq.gift')
    .or('is_free.is.null,is_free.eq.false');
}

async function countHistory(adminClient, applyFilters) {
  let query = adminClient
    .from('history')
    .select('id', { count: 'exact', head: true });

  query = applyPublicHistoryBaseFilters(query);
  query = applyFilters(query);

  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return count || 0;
}

async function fetchBoundaryTimestamp(adminClient, applyFilters, ascending) {
  let query = adminClient
    .from('history')
    .select('timestamp')
    .order('timestamp', { ascending, nullsFirst: false })
    .limit(1);

  query = applyPublicHistoryBaseFilters(query);
  query = applyFilters(query);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return Array.isArray(data) && data[0]?.timestamp ? data[0].timestamp : null;
}

async function buildScopedCounter(adminClient, applyFilters) {
  const [
    totalPulls,
    fourStar,
    fiveStar,
    sixStar,
    firstPullAt,
    lastPullAt,
  ] = await Promise.all([
    countHistory(adminClient, applyFilters),
    countHistory(adminClient, (query) => applyFilters(query).eq('rarity', 4)),
    countHistory(adminClient, (query) => applyFilters(query).eq('rarity', 5)),
    countHistory(adminClient, (query) => applyFilters(query).eq('rarity', 6)),
    fetchBoundaryTimestamp(adminClient, applyFilters, true),
    fetchBoundaryTimestamp(adminClient, applyFilters, false),
  ]);

  return {
    firstPullAt,
    lastPullAt,
    stats: {
      totalPulls,
      totalPullsWithFree: totalPulls,
      freePullCount: 0,
      rarityCounts: {
        4: fourStar,
        5: fiveStar,
        6: sixStar,
      },
      targetSixStar: null,
      offrateSixStar: null,
      averagePity: {
        sixStar: null,
        fiveStar: null,
        targetSixStar: null,
      },
      distribution: [],
      source: 'bounded_count_queries',
    },
  };
}

function flattenRankingItems(characterRanking = {}) {
  const itemMap = new Map();

  Object.entries(characterRanking || {}).forEach(([poolType, group]) => {
    Object.entries(group || {}).forEach(([bucket, rows]) => {
      if (!Array.isArray(rows)) {
        return;
      }

      rows.forEach((row) => {
        const name = normalizeQueryValue(row?.name);
        if (!name) {
          return;
        }

        const key = `${poolType}:${name}`;
        const current = itemMap.get(key) || {
          id: name,
          name,
          type: poolType === 'weapon' ? 'weapon' : 'character',
          rarity: bucket.toLowerCase().includes('six') ? 6 : bucket.toLowerCase().includes('five') ? 5 : null,
          isLimited: poolType === 'limited' || poolType === 'extra',
          totalPulls: 0,
          poolTypes: {},
          pools: [],
          sourceBuckets: [],
        };

        const count = toNumber(row.count, 0);
        current.totalPulls += count;
        current.poolTypes[poolType] = (current.poolTypes[poolType] || 0) + count;
        current.sourceBuckets.push({ poolType, bucket, count });
        itemMap.set(key, current);
      });
    });
  });

  return Array.from(itemMap.values())
    .sort((left, right) => right.totalPulls - left.totalPulls);
}

export async function fetchPublicAnalytics(adminClient) {
  const [globalSummary, characterRanking] = await Promise.all([
    fetchGlobalSummary(adminClient),
    fetchCharacterRanking(adminClient),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    rowCount: toNumber(globalSummary?.totalPullsWithFree ?? globalSummary?.totalPulls, 0),
    capped: false,
    source: 'cached_rpc',
    summary: normalizeSummaryCounter(globalSummary || {}),
    byPoolType: buildTypeSummary(globalSummary || {}),
    items: flattenRankingItems(characterRanking || {}),
    rankings: characterRanking || {},
    trends: {},
  };
}

export async function buildPublicGlobalStats(adminClient) {
  const globalSummary = await fetchGlobalSummary(adminClient);
  const analytics = {
    summary: normalizeSummaryCounter(globalSummary || {}),
    byPoolType: buildTypeSummary(globalSummary || {}),
    rowCount: toNumber(globalSummary?.totalPullsWithFree ?? globalSummary?.totalPulls, 0),
    capped: false,
    source: 'cached_rpc',
  };

  return {
    global: globalSummary || {},
    analytics,
  };
}

export async function buildPublicRankings(adminClient) {
  const characterRanking = await fetchCharacterRanking(adminClient);

  return {
    rankings: characterRanking || {},
    itemTop: flattenRankingItems(characterRanking || {}).slice(0, 30),
  };
}

export async function buildPublicPoolStats(adminClient, query = {}) {
  const pools = await fetchVisiblePools(adminClient);
  const nowMs = Date.now();
  const type = normalizeQueryValue(query.type).toLowerCase();
  const status = normalizeQueryValue(query.status).toLowerCase();
  const fromMs = parseDateMs(query.from);
  const toMs = parseDateMs(query.to);

  const filtered = (pools || [])
    .map((pool) => ({
      pool,
      poolType: normalizePoolType(pool.type, pool.id || pool.pool_id),
      status: getPoolStatus(pool, nowMs),
    }))
    .filter((item) => {
      if (type && item.poolType !== type) return false;
      if (status && item.status !== status) return false;

      const startMs = parseDateMs(item.pool.start_time);
      const endMs = parseDateMs(item.pool.end_time);
      if (Number.isFinite(fromMs) && Number.isFinite(endMs) && endMs < fromMs) return false;
      if (Number.isFinite(toMs) && Number.isFinite(startMs) && startMs > toMs) return false;

      return true;
    })
    .sort((left, right) => parseDateMs(right.pool.start_time) - parseDateMs(left.pool.start_time));

  const { items, page } = paginateArray(filtered, query, {
    defaultValue: HEAVY_PAGE_DEFAULT,
    max: HEAVY_PAGE_MAX,
  });

  const poolStats = await Promise.all(items.map(async (item) => {
    const poolId = item.pool.id || item.pool.pool_id;
    const counter = await buildScopedCounter(
      adminClient,
      (historyQuery) => historyQuery.eq('pool_id', poolId)
    );

    return {
      pool: toPublicPoolDto(item.pool, { nowMs }),
      poolType: item.poolType,
      status: item.status,
      ...counter,
    };
  }));

  return {
    pools: poolStats,
    page,
  };
}

export async function buildPublicSinglePoolStats(adminClient, {
  id,
} = {}) {
  const pools = await fetchVisiblePools(adminClient);
  const normalizedId = normalizeQueryValue(id);
  const nowMs = Date.now();
  const pool = (pools || []).find((item) => String(item.id || item.pool_id) === normalizedId);

  if (!pool) {
    return null;
  }

  const counter = await buildScopedCounter(
    adminClient,
    (historyQuery) => historyQuery.eq('pool_id', pool.id || pool.pool_id)
  );

  return {
    pool: {
      pool: toPublicPoolDto(pool, { nowMs }),
      poolType: normalizePoolType(pool.type, pool.id || pool.pool_id),
      status: getPoolStatus(pool, nowMs),
      ...counter,
    },
  };
}

export async function buildPublicItemStats(adminClient, query = {}) {
  const [characters, characterRanking] = await Promise.all([
    fetchCharacters(adminClient),
    fetchCharacterRanking(adminClient),
  ]);
  const type = normalizeQueryValue(query.type).toLowerCase();
  const poolType = normalizeQueryValue(query.poolType).toLowerCase();
  const rarity = normalizeInteger(query.rarity);
  const rankedItems = flattenRankingItems(characterRanking || {});

  const rankedByName = new Map(rankedItems.map((item) => [item.name, item]));
  const catalogItems = (characters || [])
    .map((character) => rankedByName.get(character.name) || {
      id: character.id || character.name,
      name: character.name,
      type: character.type || 'character',
      rarity: character.rarity || null,
      isLimited: character.is_limited === true,
      totalPulls: null,
      poolTypes: {},
      pools: [],
      sourceBuckets: [],
    })
    .filter((item) => {
      if (type && item.type !== type) return false;
      if (rarity && Number(item.rarity) !== rarity) return false;
      if (poolType && !item.poolTypes?.[poolType]) return false;
      return true;
    })
    .sort((left, right) => toNumber(right.totalPulls, -1) - toNumber(left.totalPulls, -1));

  const { items, page } = paginateArray(catalogItems, query, {
    defaultValue: HEAVY_PAGE_DEFAULT,
    max: HEAVY_PAGE_MAX,
  });

  return {
    items,
    page,
  };
}

export async function buildPublicSingleItemStats(adminClient, {
  id,
  type = '',
} = {}) {
  const [characters, characterRanking] = await Promise.all([
    fetchCharacters(adminClient),
    fetchCharacterRanking(adminClient),
  ]);
  const normalizedId = normalizeQueryValue(id).toLowerCase();
  const normalizedType = normalizeQueryValue(type).toLowerCase();

  if (!normalizedId) {
    return null;
  }

  const rankedItems = flattenRankingItems(characterRanking || {});
  const matches = rankedItems.filter((item) => {
    if (normalizedType && item.type !== normalizedType) {
      return false;
    }

    return [item.id, item.name]
      .map((value) => normalizeQueryValue(value).toLowerCase())
      .includes(normalizedId);
  });

  if (matches.length > 0) {
    return { item: matches[0] };
  }

  const character = (characters || []).find((item) => {
    if (normalizedType && item.type !== normalizedType) {
      return false;
    }

    return [item.id, item.name]
      .map((value) => normalizeQueryValue(value).toLowerCase())
      .includes(normalizedId);
  });

  if (!character) {
    return null;
  }

  const counter = await buildScopedCounter(
    adminClient,
    (historyQuery) => historyQuery.eq('item_name', character.name)
  );

  return {
    item: {
      id: character.id || character.name,
      name: character.name,
      type: character.type || 'character',
      rarity: character.rarity || null,
      isLimited: character.is_limited === true,
      totalPulls: counter.stats.totalPulls,
      rarityCounts: counter.stats.rarityCounts,
      firstPullAt: counter.firstPullAt,
      lastPullAt: counter.lastPullAt,
      poolTypes: {},
      pools: [],
      source: counter.stats.source,
    },
  };
}

export async function buildPublicTrends(adminClient, query = {}) {
  const metric = ['pulls', 'six_star', 'five_star'].includes(query.metric)
    ? query.metric
    : 'pulls';
  const granularity = query.granularity === 'week' ? 'week' : 'day';
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;

  return {
    metric,
    granularity,
    days,
    points: [],
    source: 'trend_cache_not_available',
    note: 'Trend buckets require a dedicated precomputed aggregate and are intentionally not computed from raw history during API requests.',
  };
}

export async function buildPublicDistributions(adminClient, query = {}) {
  const globalSummary = await fetchGlobalSummary(adminClient);
  const byPoolType = buildTypeSummary(globalSummary || {});
  const summary = normalizeSummaryCounter(globalSummary || {});
  const poolType = normalizeQueryValue(query.poolType || 'all').toLowerCase();

  if (poolType === 'all') {
    return {
      poolType,
      distribution: summary.distribution,
    };
  }

  if (poolType === 'character') {
    const bucketMap = new Map();
    ['limited', 'extra', 'standard'].forEach((type) => {
      (byPoolType[type]?.distribution || []).forEach(({ bucket, count }) => {
        bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + count);
      });
    });

    return {
      poolType,
      distribution: Array.from(bucketMap.entries()).map(([bucket, count]) => ({ bucket, count })),
    };
  }

  return {
    poolType,
    distribution: byPoolType[poolType]?.distribution || [],
  };
}

export default {
  buildPublicDistributions,
  buildPublicGlobalStats,
  buildPublicItemStats,
  buildPublicSingleItemStats,
  buildPublicPoolStats,
  buildPublicRankings,
  buildPublicSinglePoolStats,
  buildPublicTrends,
  fetchPublicAnalytics,
};
