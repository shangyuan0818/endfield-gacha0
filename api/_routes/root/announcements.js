import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import {
  resolveSupabaseServerKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

const CACHE_TTL = 60 * 1000;
const DEFAULT_GAME_LIMIT = 5;
const MAX_GAME_LIMIT = 20;
const DEFAULT_RECENT_DAYS = 7;
const ANNOUNCEMENT_COLUMNS = [
  'id',
  'title',
  'title_en',
  'content',
  'content_en',
  'version',
  'announcement_type',
  'severity',
  'is_active',
  'priority',
  'source_id',
  'source_url',
  'published_at',
  'summary',
  'created_at',
  'updated_at'
].join(', ');

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

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_GAME_LIMIT;
  }

  return Math.min(parsed, MAX_GAME_LIMIT);
}

function normalizeCutoffIso(value) {
  const parsed = new Date(value || '').getTime();
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return new Date(Date.now() - DEFAULT_RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function parseQuery(req) {
  const url = new URL(req.url || '', 'https://example.com');
  return {
    cutoffIso: normalizeCutoffIso(url.searchParams.get('cutoffIso')),
    limit: normalizeLimit(url.searchParams.get('limit'))
  };
}

function getCacheKey({ cutoffIso, limit }) {
  return `${cutoffIso}:${limit}`;
}

function createEmptyPayload() {
  return {
    siteAnnouncements: [],
    recentGameAnnouncements: [],
    latestGameAnnouncements: []
  };
}

function inferAnnouncementSourceMeta(record = {}) {
  const sourceId = String(record.source_id || '');
  const sourceUrl = String(record.source_url || '');
  const isGameBulletin = sourceId.startsWith('game-bulletin:') || sourceUrl.includes('game_bulletin');
  let sourceCategory = isGameBulletin ? 'game' : 'official';

  if (isGameBulletin) {
    try {
      const url = new URL(sourceUrl);
      sourceCategory = url.searchParams.get('tab') || sourceCategory;
    } catch {
      sourceCategory = 'game';
    }
  }

  if (!sourceId) {
    return record;
  }

  return {
    ...record,
    source_kind: isGameBulletin ? 'game-bulletin' : 'official-site',
    source_category: sourceCategory,
  };
}

function decorateAnnouncementRecords(records) {
  return (Array.isArray(records) ? records : []).map(inferAnnouncementSourceMeta);
}

function mergePayload(previousPayload, nextPartialPayload) {
  const previous = previousPayload || createEmptyPayload();
  const next = nextPartialPayload || {};

  return {
    siteAnnouncements: next.siteAnnouncements ?? previous.siteAnnouncements ?? [],
    recentGameAnnouncements: next.recentGameAnnouncements ?? previous.recentGameAnnouncements ?? [],
    latestGameAnnouncements: next.latestGameAnnouncements ?? previous.latestGameAnnouncements ?? []
  };
}

async function fetchSiteAnnouncements(supabase) {
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('is_active', true)
    .is('source_id', null)
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return decorateAnnouncementRecords(data || []);
}

async function fetchRecentGameAnnouncements(supabase, cutoffIso) {
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('is_active', true)
    .not('source_id', 'is', null)
    .gte('published_at', cutoffIso)
    .order('published_at', { ascending: false });

  if (error) {
    throw error;
  }

  return decorateAnnouncementRecords(data || []);
}

async function fetchLatestGameAnnouncements(supabase, limit) {
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('is_active', true)
    .not('source_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return decorateAnnouncementRecords(data || []);
}

async function fetchAnnouncementsPayload(supabase, query, previousPayload) {
  const [siteResult, recentGameResult, latestGameResult] = await Promise.allSettled([
    fetchSiteAnnouncements(supabase),
    fetchRecentGameAnnouncements(supabase, query.cutoffIso),
    fetchLatestGameAnnouncements(supabase, query.limit)
  ]);

  const payload = mergePayload(previousPayload, {
    siteAnnouncements: siteResult.status === 'fulfilled' ? siteResult.value : undefined,
    recentGameAnnouncements: recentGameResult.status === 'fulfilled' ? recentGameResult.value : undefined,
    latestGameAnnouncements: latestGameResult.status === 'fulfilled' ? latestGameResult.value : undefined
  });

  const partial = [siteResult, recentGameResult, latestGameResult]
    .some((result) => result.status === 'rejected');

  return {
    payload,
    partial
  };
}

async function getFreshPayload(supabase, query, cacheKey, previousPayload) {
  if (inFlightByKey.has(cacheKey)) {
    return inFlightByKey.get(cacheKey);
  }

  const promise = fetchAnnouncementsPayload(supabase, query, previousPayload)
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
    const { payload, partial } = await getFreshPayload(supabase, query, cacheKey, cached?.payload);
    cacheByKey.set(cacheKey, {
      payload,
      partial,
      lastFetch: Date.now()
    });

    return res.status(200).json({
      success: true,
      cached: false,
      partial,
      data: payload
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      cached: Boolean(cached),
      partial: true,
      data: cached?.payload || createEmptyPayload(),
      message: error?.message || 'Failed to load announcements'
    });
  }
}

export const __internal = {
  CACHE_TTL,
  cacheByKey,
  createEmptyPayload,
  getCacheKey,
  mergePayload,
  normalizeCutoffIso,
  normalizeLimit,
  parseQuery
};
