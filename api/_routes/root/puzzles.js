import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import {
  resolveSupabaseServerKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

const CACHE_TTL = 5 * 60 * 1000;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 80;
const VALID_DIFFICULTIES = new Set([1, 2, 3]);

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

function normalizeDifficulty(value) {
  const parsed = Number.parseInt(value, 10);
  return VALID_DIFFICULTIES.has(parsed) ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function parseQuery(req) {
  const url = new URL(req.url || '', 'https://example.com');
  return {
    difficulty: normalizeDifficulty(url.searchParams.get('difficulty')),
    limit: normalizeLimit(url.searchParams.get('limit'))
  };
}

function getCacheKey({ difficulty, limit }) {
  return `${difficulty}:${limit}`;
}

function createEmptyPayload() {
  return {
    puzzles: []
  };
}

async function fetchPuzzlesPayload(supabase, query) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, author, data, difficulty, status')
    .eq('status', 'approved')
    .eq('difficulty', query.difficulty)
    .order('created_at', { ascending: false })
    .limit(query.limit);

  if (error) {
    throw error;
  }

  return {
    puzzles: data || []
  };
}

async function getFreshPayload(supabase, query, cacheKey) {
  if (inFlightByKey.has(cacheKey)) {
    return inFlightByKey.get(cacheKey);
  }

  const promise = fetchPuzzlesPayload(supabase, query)
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

  const query = parseQuery(req);
  const cacheKey = getCacheKey(query);
  const now = Date.now();
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
      data: cached?.payload || createEmptyPayload(),
      message: 'Database not configured, returning cached/default data'
    });
  }

  try {
    const payload = await getFreshPayload(supabase, query, cacheKey);
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
      data: cached?.payload || createEmptyPayload(),
      message: error?.message || 'Failed to load puzzles'
    });
  }
}

export const __internal = {
  CACHE_TTL,
  cacheByKey,
  createEmptyPayload,
  getCacheKey,
  normalizeDifficulty,
  normalizeLimit,
  parseQuery
};
