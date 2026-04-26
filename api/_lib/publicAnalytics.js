import {
  fetchCharacterRanking,
  fetchCharacters,
  fetchGlobalSummary,
  fetchVisiblePools,
  toPublicPoolDto,
} from './publicCatalog.js';

const ANALYTICS_CACHE_KEY = 'public_analytics:v1';
const ANALYTICS_CACHE_TTL_MS = 15 * 60 * 1000;
const HISTORY_PAGE_SIZE = 1000;
const MAX_HISTORY_ROWS = 200000;

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

function paginateArray(items, query = {}) {
  const limit = normalizeLimit(query.limit);
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

function toIsoDate(value) {
  const ms = parseDateMs(value);
  if (!Number.isFinite(ms)) {
    return null;
  }

  return new Date(ms).toISOString().slice(0, 10);
}

function getWeekKey(dateValue) {
  const ms = parseDateMs(dateValue);
  if (!Number.isFinite(ms)) {
    return null;
  }

  const date = new Date(ms);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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

function isGiftPull(record) {
  return record?.special_type === 'gift';
}

function isFreePull(record) {
  return record?.is_free === true;
}

function splitFeaturedValue(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[、,，/|]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFeaturedNames(pool) {
  if (Array.isArray(pool?.featured_characters)) {
    return pool.featured_characters
      .map((item) => (typeof item === 'string'
        ? item
        : item?.name || item?.character_name || item?.item_name || ''))
      .filter(Boolean);
  }

  return splitFeaturedValue(pool?.up_character);
}

function namesMatch(itemName, targetName) {
  const left = String(itemName || '').trim().toLowerCase();
  const right = String(targetName || '').trim().toLowerCase();

  if (!left || !right) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
}

function isTargetSixStar(record, pool) {
  if (Number(record?.rarity) !== 6 || !pool) {
    return false;
  }

  const poolType = normalizePoolType(pool.type, pool.id || pool.pool_id);
  if (poolType === 'standard') {
    return false;
  }

  return getFeaturedNames(pool).some((name) => namesMatch(record.item_name, name));
}

function createCounter() {
  return {
    totalPulls: 0,
    totalPullsWithFree: 0,
    freePullCount: 0,
    rarityCounts: {
      4: 0,
      5: 0,
      6: 0,
    },
    targetSixStar: 0,
    offrateSixStar: 0,
    fiveStar: 0,
    fourStar: 0,
    pitySamples: {
      sixStar: [],
      fiveStar: [],
      targetSixStar: [],
    },
    distributionBuckets: {},
  };
}

function addPitySample(samples, value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    samples.push(numericValue);
  }
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function getPityBucket(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return 'unknown';
  }

  const start = Math.floor((numericValue - 1) / 10) * 10 + 1;
  const end = Math.min(start + 9, 80);
  return `${start}-${end}`;
}

function incrementBucket(buckets, bucket) {
  buckets[bucket] = (buckets[bucket] || 0) + 1;
}

function incrementTrend(trends, key, record) {
  if (!key) {
    return;
  }

  if (!trends[key]) {
    trends[key] = {
      pulls: 0,
      six_star: 0,
      five_star: 0,
    };
  }

  trends[key].pulls += 1;
  if (Number(record.rarity) === 6) trends[key].six_star += 1;
  if (Number(record.rarity) === 5) trends[key].five_star += 1;
}

function sanitizeCounter(counter) {
  return {
    totalPulls: counter.totalPulls,
    totalPullsWithFree: counter.totalPullsWithFree,
    freePullCount: counter.freePullCount,
    rarityCounts: counter.rarityCounts,
    targetSixStar: counter.targetSixStar,
    offrateSixStar: counter.offrateSixStar,
    averagePity: {
      sixStar: average(counter.pitySamples.sixStar),
      fiveStar: average(counter.pitySamples.fiveStar),
      targetSixStar: average(counter.pitySamples.targetSixStar),
    },
    distribution: Object.entries(counter.distributionBuckets)
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
      .map(([bucket, count]) => ({ bucket, count })),
  };
}

function createStatsCacheClient(adminClient) {
  return {
    async get(rowFingerprint) {
      const { data, error } = await adminClient
        .from('stats_cache')
        .select('cached_data, row_fingerprint, computed_at')
        .eq('cache_key', ANALYTICS_CACHE_KEY)
        .limit(1)
        .maybeSingle();

      if (error || !data?.cached_data) {
        return null;
      }

      const computedAtMs = parseDateMs(data.computed_at);
      if (
        Number(data.row_fingerprint) !== Number(rowFingerprint)
        || !Number.isFinite(computedAtMs)
        || Date.now() - computedAtMs > ANALYTICS_CACHE_TTL_MS
      ) {
        return null;
      }

      return data.cached_data;
    },

    async set(rowFingerprint, payload) {
      await adminClient
        .from('stats_cache')
        .upsert({
          cache_key: ANALYTICS_CACHE_KEY,
          cached_data: payload,
          row_fingerprint: rowFingerprint,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'cache_key' });
    },
  };
}

async function fetchHistoryRowCount(adminClient) {
  const { count, error } = await adminClient
    .from('history')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count || 0;
}

async function fetchHistoryRows(adminClient) {
  const rows = [];

  for (let from = 0; from < MAX_HISTORY_ROWS; from += HISTORY_PAGE_SIZE) {
    const { data, error } = await adminClient
      .from('history')
      .select('pool_id, item_name, rarity, pity, is_free, special_type, timestamp, server_id, region')
      .order('timestamp', { ascending: true, nullsFirst: true })
      .range(from, from + HISTORY_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < HISTORY_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function buildPoolLookup(pools) {
  return new Map((pools || []).map((pool) => [pool.id || pool.pool_id, pool]));
}

function buildCharacterLookup(characters) {
  return new Map((characters || []).map((character) => [character.name, character]));
}

function updateCounter(counter, record, pool) {
  if (isGiftPull(record)) {
    return;
  }

  counter.totalPullsWithFree += 1;

  if (isFreePull(record)) {
    counter.freePullCount += 1;
    return;
  }

  counter.totalPulls += 1;

  const rarity = Number(record.rarity);
  if ([4, 5, 6].includes(rarity)) {
    counter.rarityCounts[rarity] += 1;
  }

  if (rarity === 4) {
    counter.fourStar += 1;
  }

  if (rarity === 5) {
    counter.fiveStar += 1;
    addPitySample(counter.pitySamples.fiveStar, record.pity);
  }

  if (rarity === 6) {
    addPitySample(counter.pitySamples.sixStar, record.pity);
    incrementBucket(counter.distributionBuckets, getPityBucket(record.pity));

    if (isTargetSixStar(record, pool)) {
      counter.targetSixStar += 1;
      addPitySample(counter.pitySamples.targetSixStar, record.pity);
    } else {
      counter.offrateSixStar += 1;
    }
  }
}

function getItemType(record, character, poolType) {
  if (character?.type) {
    return character.type;
  }

  return poolType === 'weapon' ? 'weapon' : 'character';
}

function buildAnalyticsPayload({ rows, pools, characters, rowCount }) {
  const nowMs = Date.now();
  const poolLookup = buildPoolLookup(pools);
  const characterLookup = buildCharacterLookup(characters);
  const globalCounter = createCounter();
  const poolTypeCounters = new Map();
  const poolCounters = new Map();
  const itemCounters = new Map();
  const trends = {};

  rows.forEach((record) => {
    const poolId = record.pool_id || 'unknown';
    const pool = poolLookup.get(poolId) || {
      id: poolId,
      name: '未知卡池',
      type: normalizePoolType(null, poolId),
    };
    const poolType = normalizePoolType(pool.type, poolId);
    const character = characterLookup.get(record.item_name);

    if (!poolTypeCounters.has(poolType)) {
      poolTypeCounters.set(poolType, createCounter());
    }

    if (!poolCounters.has(poolId)) {
      poolCounters.set(poolId, {
        pool,
        poolType,
        firstPullAt: null,
        lastPullAt: null,
        counter: createCounter(),
      });
    }

    const poolStat = poolCounters.get(poolId);
    const timestampMs = parseDateMs(record.timestamp);
    if (Number.isFinite(timestampMs)) {
      const isoTimestamp = new Date(timestampMs).toISOString();
      if (!poolStat.firstPullAt || timestampMs < parseDateMs(poolStat.firstPullAt)) {
        poolStat.firstPullAt = isoTimestamp;
      }
      if (!poolStat.lastPullAt || timestampMs > parseDateMs(poolStat.lastPullAt)) {
        poolStat.lastPullAt = isoTimestamp;
      }
    }

    updateCounter(globalCounter, record, pool);
    updateCounter(poolTypeCounters.get(poolType), record, pool);
    updateCounter(poolStat.counter, record, pool);

    if (!isGiftPull(record) && !isFreePull(record)) {
      incrementTrend(trends, toIsoDate(record.timestamp), record);
    }

    if (!isGiftPull(record) && record.item_name) {
      const itemType = getItemType(record, character, poolType);
      const itemKey = `${itemType}:${record.item_name}`;
      if (!itemCounters.has(itemKey)) {
        itemCounters.set(itemKey, {
          id: character?.id || record.item_name,
          name: record.item_name,
          type: itemType,
          rarity: Number(record.rarity) || character?.rarity || null,
          isLimited: character?.is_limited === true,
          totalPulls: 0,
          poolTypes: {},
          pools: {},
        });
      }

      const itemStat = itemCounters.get(itemKey);
      itemStat.totalPulls += 1;
      itemStat.poolTypes[poolType] = (itemStat.poolTypes[poolType] || 0) + 1;
      itemStat.pools[poolId] = (itemStat.pools[poolId] || 0) + 1;
    }
  });

  const poolStats = Array.from(poolCounters.values())
    .map(({ pool, poolType, firstPullAt, lastPullAt, counter }) => ({
      pool: toPublicPoolDto(pool, { nowMs }),
      poolType,
      status: getPoolStatus(pool, nowMs),
      firstPullAt,
      lastPullAt,
      stats: sanitizeCounter(counter),
    }))
    .sort((left, right) => right.stats.totalPulls - left.stats.totalPulls);

  const itemStats = Array.from(itemCounters.values())
    .map((item) => ({
      ...item,
      pools: Object.entries(item.pools || {})
        .map(([poolId, count]) => {
          const pool = poolLookup.get(poolId) || {
            id: poolId,
            name: '未知卡池',
            type: normalizePoolType(null, poolId),
          };

          return {
            pool: toPublicPoolDto(pool, { nowMs }),
            count,
          };
        })
        .sort((left, right) => right.count - left.count),
    }))
    .sort((left, right) => right.totalPulls - left.totalPulls);

  return {
    generatedAt: new Date().toISOString(),
    rowCount,
    capped: rows.length >= MAX_HISTORY_ROWS,
    summary: sanitizeCounter(globalCounter),
    byPoolType: Object.fromEntries(
      Array.from(poolTypeCounters.entries()).map(([type, counter]) => [type, sanitizeCounter(counter)])
    ),
    pools: poolStats,
    items: itemStats,
    trends,
  };
}

export async function fetchPublicAnalytics(adminClient) {
  const [rowCount, pools, characters] = await Promise.all([
    fetchHistoryRowCount(adminClient),
    fetchVisiblePools(adminClient),
    fetchCharacters(adminClient),
  ]);
  const cache = createStatsCacheClient(adminClient);
  const cached = await cache.get(rowCount);

  if (cached) {
    return cached;
  }

  const rows = await fetchHistoryRows(adminClient);
  const payload = buildAnalyticsPayload({
    rows,
    pools,
    characters,
    rowCount,
  });

  await cache.set(rowCount, payload);
  return payload;
}

export async function buildPublicGlobalStats(adminClient) {
  const [globalSummary, analytics] = await Promise.all([
    fetchGlobalSummary(adminClient),
    fetchPublicAnalytics(adminClient),
  ]);

  return {
    global: globalSummary || analytics.summary,
    analytics: {
      summary: analytics.summary,
      byPoolType: analytics.byPoolType,
      rowCount: analytics.rowCount,
      capped: analytics.capped,
    },
  };
}

export async function buildPublicRankings(adminClient) {
  const [characterRanking, analytics] = await Promise.all([
    fetchCharacterRanking(adminClient),
    fetchPublicAnalytics(adminClient),
  ]);

  return {
    rankings: characterRanking || {},
    itemTop: analytics.items.slice(0, 30),
  };
}

export async function buildPublicPoolStats(adminClient, query = {}) {
  const analytics = await fetchPublicAnalytics(adminClient);
  const type = normalizeQueryValue(query.type).toLowerCase();
  const status = normalizeQueryValue(query.status).toLowerCase();
  const fromMs = parseDateMs(query.from);
  const toMs = parseDateMs(query.to);

  const filtered = analytics.pools.filter((item) => {
    if (type && item.poolType !== type) return false;
    if (status && item.status !== status) return false;

    const lastPullMs = parseDateMs(item.lastPullAt);
    if (Number.isFinite(fromMs) && Number.isFinite(lastPullMs) && lastPullMs < fromMs) return false;
    if (Number.isFinite(toMs) && Number.isFinite(lastPullMs) && lastPullMs > toMs) return false;

    return true;
  });
  const { items, page } = paginateArray(filtered, query);

  return {
    pools: items,
    page,
  };
}

export async function buildPublicSinglePoolStats(adminClient, {
  id,
} = {}) {
  const analytics = await fetchPublicAnalytics(adminClient);
  const pool = analytics.pools.find((item) => item.pool.id === id || item.pool.pool_id === id);

  if (!pool) {
    return null;
  }

  return {
    pool,
  };
}

export async function buildPublicItemStats(adminClient, query = {}) {
  const analytics = await fetchPublicAnalytics(adminClient);
  const type = normalizeQueryValue(query.type).toLowerCase();
  const poolType = normalizeQueryValue(query.poolType).toLowerCase();
  const rarity = normalizeInteger(query.rarity);

  const filtered = analytics.items.filter((item) => {
    if (type && item.type !== type) return false;
    if (rarity && Number(item.rarity) !== rarity) return false;
    if (poolType && !item.poolTypes?.[poolType]) return false;
    return true;
  });
  const { items, page } = paginateArray(filtered, query);

  return {
    items,
    page,
  };
}

export async function buildPublicSingleItemStats(adminClient, {
  id,
  type = '',
} = {}) {
  const analytics = await fetchPublicAnalytics(adminClient);
  const normalizedId = normalizeQueryValue(id).toLowerCase();
  const normalizedType = normalizeQueryValue(type).toLowerCase();

  if (!normalizedId) {
    return null;
  }

  const matches = analytics.items
    .filter((item) => {
      if (normalizedType && item.type !== normalizedType) {
        return false;
      }

      const ids = [
        item.id,
        item.name,
      ].map((value) => normalizeQueryValue(value).toLowerCase());

      return ids.includes(normalizedId);
    })
    .sort((left, right) => right.totalPulls - left.totalPulls);

  if (matches.length === 0) {
    return null;
  }

  return {
    item: matches[0],
  };
}

export async function buildPublicTrends(adminClient, query = {}) {
  const analytics = await fetchPublicAnalytics(adminClient);
  const metric = ['pulls', 'six_star', 'five_star'].includes(query.metric)
    ? query.metric
    : 'pulls';
  const granularity = query.granularity === 'week' ? 'week' : 'day';
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const cutoff = Date.now() - (days * 86400000);
  const buckets = new Map();

  Object.entries(analytics.trends || {}).forEach(([date, values]) => {
    const dateMs = parseDateMs(date);
    if (!Number.isFinite(dateMs) || dateMs < cutoff) {
      return;
    }

    const key = granularity === 'week' ? getWeekKey(date) : date;
    if (!key) {
      return;
    }

    buckets.set(key, (buckets.get(key) || 0) + (values?.[metric] || 0));
  });

  return {
    metric,
    granularity,
    days,
    points: Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([period, value]) => ({ period, value })),
  };
}

export async function buildPublicDistributions(adminClient, query = {}) {
  const analytics = await fetchPublicAnalytics(adminClient);
  const poolType = normalizeQueryValue(query.poolType || 'all').toLowerCase();

  if (poolType === 'all') {
    return {
      poolType,
      distribution: analytics.summary.distribution,
    };
  }

  if (poolType === 'character') {
    const limited = analytics.byPoolType.limited?.distribution || [];
    const extra = analytics.byPoolType.extra?.distribution || [];
    const standard = analytics.byPoolType.standard?.distribution || [];
    const bucketMap = new Map();

    [...limited, ...extra, ...standard].forEach(({ bucket, count }) => {
      bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + count);
    });

    return {
      poolType,
      distribution: Array.from(bucketMap.entries()).map(([bucket, count]) => ({ bucket, count })),
    };
  }

  return {
    poolType,
    distribution: analytics.byPoolType[poolType]?.distribution || [],
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
