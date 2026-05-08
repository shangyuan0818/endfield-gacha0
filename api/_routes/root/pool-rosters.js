import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import {
  resolveSupabaseServerKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

const CACHE_TTL = 60 * 1000;
const MAX_POOL_IDS = 120;

const cacheByKey = new Map();
const inFlightByKey = new Map();

function getSupabaseClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

function parsePoolIds(req) {
  const url = new URL(req.url || '', 'https://example.com');
  const rawValues = [
    ...url.searchParams.getAll('poolIds'),
    ...url.searchParams.getAll('poolId')
  ];

  return Array.from(new Set(
    rawValues
      .flatMap((value) => String(value || '').split(','))
      .map((value) => value.trim())
      .filter((value) => value && value.length <= 128)
  )).slice(0, MAX_POOL_IDS);
}

function getCacheKey(poolIds) {
  return poolIds.slice().sort().join(',');
}

function createEmptyPayload(poolIds = []) {
  return {
    poolRosters: Object.fromEntries(poolIds.map((poolId) => [poolId, []]))
  };
}

function groupPoolRosterRows(rows = [], poolIds = []) {
  const grouped = createEmptyPayload(poolIds).poolRosters;

  rows.forEach((row) => {
    const poolId = row?.pool_id;
    if (!poolId) {
      return;
    }

    if (!Array.isArray(grouped[poolId])) {
      grouped[poolId] = [];
    }

    grouped[poolId].push(row);
  });

  return {
    poolRosters: grouped
  };
}

async function fetchPoolRosterPayload(supabase, poolIds) {
  const { data, error } = await supabase
    .from('pool_characters')
    .select(`
      pool_id,
      character_id,
      is_up,
      characters (
        id,
        name,
        rarity,
        type,
        is_limited,
        aliases,
        pool_config
      )
    `)
    .in('pool_id', poolIds);

  if (error) {
    throw error;
  }

  return groupPoolRosterRows(data || [], poolIds);
}

async function getFreshPayload(supabase, poolIds, cacheKey) {
  if (inFlightByKey.has(cacheKey)) {
    return inFlightByKey.get(cacheKey);
  }

  const promise = fetchPoolRosterPayload(supabase, poolIds)
    .finally(() => {
      inFlightByKey.delete(cacheKey);
    });

  inFlightByKey.set(cacheKey, promise);
  return promise;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

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

  const poolIds = parsePoolIds(req);
  if (poolIds.length === 0) {
    return res.status(200).json({
      success: true,
      cached: false,
      partial: false,
      data: createEmptyPayload()
    });
  }

  const now = Date.now();
  const cacheKey = getCacheKey(poolIds);
  const cached = cacheByKey.get(cacheKey);

  if (cached && now - cached.lastFetch < CACHE_TTL) {
    return res.status(200).json({
      success: true,
      cached: true,
      partial: Boolean(cached.partial),
      data: cached.payload
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(200).json({
      success: true,
      cached: true,
      partial: true,
      data: cached?.payload || createEmptyPayload(poolIds),
      message: 'Database not configured, returning cached/default data'
    });
  }

  try {
    const payload = await getFreshPayload(supabase, poolIds, cacheKey);
    cacheByKey.set(cacheKey, {
      payload,
      partial: false,
      lastFetch: Date.now()
    });

    return res.status(200).json({
      success: true,
      cached: false,
      partial: false,
      data: payload
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      cached: Boolean(cached),
      partial: true,
      data: cached?.payload || createEmptyPayload(poolIds),
      message: error?.message || 'Failed to load pool rosters'
    });
  }
}

export const __internal = {
  CACHE_TTL,
  MAX_POOL_IDS,
  cacheByKey,
  createEmptyPayload,
  getCacheKey,
  groupPoolRosterRows,
  parsePoolIds
};
