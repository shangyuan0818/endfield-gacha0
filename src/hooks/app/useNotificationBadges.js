import { useState, useEffect } from 'react';
import {
  fetchPublicApiJson,
  shouldAllowPublicSupabaseFallback,
} from '../../services/publicResourceClient';
import { executeSupabaseRead, fetchWithTimeout } from '../../services/supabaseRequest';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';
import { STORAGE_KEYS, hasNewContent, getStorageItem } from '../../utils';
import { findGameAnnouncementCalendarImage } from '../../utils/gameAnnouncementCalendar.js';

const GAME_ANNOUNCEMENT_VISIBLE_DAYS = 7;
const GAME_ANNOUNCEMENT_HISTORY_FALLBACK_LIMIT = 5;
const GAME_ANNOUNCEMENT_SOURCE_GROUPS = Object.freeze(['game', 'official']);

function getRecentGameAnnouncementCutoffIso(now = Date.now()) {
  return new Date(now - GAME_ANNOUNCEMENT_VISIBLE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function isGameAnnouncement(record) {
  return record?.is_active !== false && !!record?.source_id;
}

function getAnnouncementSourceGroup(record = {}) {
  const sourceKind = String(record?.source_kind || '').toLowerCase();
  const sourceId = String(record?.source_id || '');
  const sourceUrl = String(record?.source_url || '');

  if (sourceKind === 'game-bulletin' || sourceId.startsWith('game-bulletin:') || sourceUrl.includes('game_bulletin')) {
    return 'game';
  }

  return 'official';
}

function withAnnouncementSourceMeta(record = {}) {
  if (!record?.source_id) {
    return record;
  }

  const sourceGroup = getAnnouncementSourceGroup(record);
  let sourceCategory = record.source_category || sourceGroup;

  if (sourceGroup === 'game') {
    try {
      const sourceUrl = new URL(String(record?.source_url || ''));
      sourceCategory = sourceUrl.searchParams.get('tab') || sourceCategory;
    } catch {
      sourceCategory = sourceCategory || 'game';
    }
  }

  return {
    ...record,
    source_kind: sourceGroup === 'game' ? 'game-bulletin' : 'official-site',
    source_category: sourceCategory,
    source_group: sourceGroup,
  };
}

function isRecentGameAnnouncement(record, cutoffIso = getRecentGameAnnouncementCutoffIso()) {
  if (!isGameAnnouncement(record)) {
    return false;
  }

  const timestamp = new Date(record?.published_at || record?.updated_at || record?.created_at || 0).getTime();
  const cutoff = new Date(cutoffIso).getTime();
  return Number.isFinite(timestamp) && timestamp >= cutoff;
}

function sortByPriority(records) {
  return records.slice().sort((a, b) => {
    const pd = (Number(b?.priority) || 0) - (Number(a?.priority) || 0);
    if (pd !== 0) return pd;
    return new Date(b?.updated_at || b?.created_at || 0) - new Date(a?.updated_at || a?.created_at || 0);
  });
}

function sortGameAnnouncements(records) {
  return records.slice().sort((a, b) => {
    const publishedDiff = new Date(b?.published_at || b?.updated_at || b?.created_at || 0)
      - new Date(a?.published_at || a?.updated_at || a?.created_at || 0);
    if (publishedDiff !== 0) {
      return publishedDiff;
    }

    const priorityDiff = (Number(b?.priority) || 0) - (Number(a?.priority) || 0);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return String(b?.source_id || '').localeCompare(String(a?.source_id || ''));
  });
}

function getAnnouncementKey(record) {
  return String(record?.source_id || record?.id || record?.source_url || record?.title || '');
}

function buildGameAnnouncementDisplaySet({
  recentRecords = [],
  latestRecords = [],
  cutoffIso = getRecentGameAnnouncementCutoffIso(),
  limit = GAME_ANNOUNCEMENT_HISTORY_FALLBACK_LIMIT,
}) {
  const byKey = new Map();
  const countsBySource = new Map(GAME_ANNOUNCEMENT_SOURCE_GROUPS.map(group => [group, 0]));
  const candidates = sortGameAnnouncements([
    ...(Array.isArray(recentRecords) ? recentRecords : []),
    ...(Array.isArray(latestRecords) ? latestRecords : []),
  ].map(withAnnouncementSourceMeta));

  for (const record of candidates) {
    if (!isGameAnnouncement(record)) {
      continue;
    }

    const sourceGroup = getAnnouncementSourceGroup(record);
    if ((countsBySource.get(sourceGroup) || 0) >= limit) {
      continue;
    }

    const key = getAnnouncementKey(record);
    if (!key || byKey.has(key)) {
      continue;
    }

    byKey.set(key, {
      ...record,
      is_recent_history_fallback: !isRecentGameAnnouncement(record, cutoffIso),
    });
    countsBySource.set(sourceGroup, (countsBySource.get(sourceGroup) || 0) + 1);

    if (GAME_ANNOUNCEMENT_SOURCE_GROUPS.every(group => (countsBySource.get(group) || 0) >= limit)) {
      break;
    }
  }

  return Array.from(byKey.values());
}

function appendPinnedGameCalendarRecord(records = [], candidates = []) {
  const calendar = findGameAnnouncementCalendarImage(candidates);
  const announcement = calendar?.announcement ? withAnnouncementSourceMeta(calendar.announcement) : null;
  if (!announcement || !getAnnouncementKey(announcement)) {
    return records;
  }

  const key = getAnnouncementKey(announcement);
  if (records.some(record => getAnnouncementKey(record) === key)) {
    return records;
  }

  return [...records, announcement];
}

async function loadSiteAnnouncementsFromDb() {
  if (!supabase) return null;
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .is('source_id', null)
      .order('priority', { ascending: false }),
    { label: 'load site announcements', retries: 1 },
  );
  return error ? null : (data || []);
}

async function loadGameAnnouncementsFromDb(cutoffIso = getRecentGameAnnouncementCutoffIso()) {
  if (!supabase) return null;
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .not('source_id', 'is', null)
      .gte('published_at', cutoffIso)
      .order('published_at', { ascending: false }),
    { label: 'load game announcements', retries: 1 },
  );
  return error ? null : (data || []);
}

async function loadLatestGameAnnouncementsFromDb(limit = GAME_ANNOUNCEMENT_HISTORY_FALLBACK_LIMIT * GAME_ANNOUNCEMENT_SOURCE_GROUPS.length) {
  if (!supabase) return null;
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .not('source_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit),
    { label: 'load latest game announcements', retries: 1 },
  );
  return error ? null : (data || []);
}

async function loadAnnouncementsFromLocal() {
  const resp = await fetchWithTimeout('/announcements.json', undefined, {
    label: 'load announcements fallback',
    timeoutMs: 15000,
  });
  if (!resp.ok) return [];
  return resp.json();
}

async function loadAnnouncementsFromApi({
  cutoffIso = getRecentGameAnnouncementCutoffIso(),
  limit = GAME_ANNOUNCEMENT_HISTORY_FALLBACK_LIMIT,
} = {}) {
  const response = await fetchPublicApiJson('/api/announcements', {
    params: {
      cutoffIso,
      limit: String(limit * GAME_ANNOUNCEMENT_SOURCE_GROUPS.length),
    },
    label: 'load announcements api',
    timeoutMs: 15000,
    retries: 1,
  });

  return response?.data || null;
}

async function loadOfficialAnnouncementsFeed({
  cutoffIso = getRecentGameAnnouncementCutoffIso(),
} = {}) {
  const resp = await fetchWithTimeout('/api/automation-feed?job=official-announcements', undefined, {
    label: 'load official announcements feed',
    timeoutMs: 20000,
    retries: 1,
  });

  if (!resp.ok) {
    throw new Error(`official announcements feed returned ${resp.status}`);
  }

  const payload = await resp.json();
  if (payload?.success !== true || !Array.isArray(payload?.records)) {
    throw new Error(payload?.error || 'invalid official announcements feed payload');
  }

  const records = payload.records.filter(record => isGameAnnouncement(record));
  const recentRecords = records.filter(record => isRecentGameAnnouncement(record, cutoffIso));
  const displayRecords = buildGameAnnouncementDisplaySet({
    recentRecords,
    latestRecords: records,
    cutoffIso,
  });
  return appendPinnedGameCalendarRecord(displayRecords, records);
}

export function useNotificationBadges() {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);
  const setGameAnnouncements = useAppStore(state => state.setGameAnnouncements);
  const setGameAnnouncementDigest = useAppStore(state => state.setGameAnnouncementDigest);

  const isSuperAdmin = userRole === 'super_admin';

  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cutoffIso = getRecentGameAnnouncementCutoffIso();
      let apiPayload = null;
      try {
        apiPayload = await loadAnnouncementsFromApi({ cutoffIso });
      } catch {
        apiPayload = null;
      }

      let siteRecords;
      if (apiPayload) {
        siteRecords = Array.isArray(apiPayload.siteAnnouncements) ? apiPayload.siteAnnouncements : [];
      } else {
        try {
          const dbRecords = shouldAllowPublicSupabaseFallback()
            ? await loadSiteAnnouncementsFromDb()
            : null;
          siteRecords = dbRecords ?? await loadAnnouncementsFromLocal();
        } catch {
          siteRecords = [];
        }
      }

      if (cancelled) return;

      const sortedSiteRecords = sortByPriority(siteRecords);
      setAnnouncements(sortedSiteRecords);

      if (sortedSiteRecords.length > 0 && sortedSiteRecords[0]?.updated_at) {
        setHasNewAnnouncement(hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, sortedSiteRecords[0].updated_at));
      } else {
        setHasNewAnnouncement(false);
      }

      let dbGameRecords = Array.isArray(apiPayload?.recentGameAnnouncements)
        ? apiPayload.recentGameAnnouncements
        : [];
      let latestDbGameRecords = Array.isArray(apiPayload?.latestGameAnnouncements)
        ? apiPayload.latestGameAnnouncements
        : [];

      if (!apiPayload) {
        if (shouldAllowPublicSupabaseFallback()) {
          try {
            dbGameRecords = await loadGameAnnouncementsFromDb(cutoffIso) || [];
          } catch {
            dbGameRecords = [];
          }

          try {
            latestDbGameRecords = await loadLatestGameAnnouncementsFromDb() || [];
          } catch {
            latestDbGameRecords = [];
          }
        }
      }

      let gameRecords = buildGameAnnouncementDisplaySet({
        recentRecords: dbGameRecords,
        latestRecords: latestDbGameRecords,
        cutoffIso,
      });

      const sourceGroups = new Set(gameRecords.map(getAnnouncementSourceGroup));
      const hasGameCalendarCandidate = Boolean(findGameAnnouncementCalendarImage(gameRecords));

      if (
        gameRecords.length < GAME_ANNOUNCEMENT_HISTORY_FALLBACK_LIMIT * GAME_ANNOUNCEMENT_SOURCE_GROUPS.length
        || GAME_ANNOUNCEMENT_SOURCE_GROUPS.some(group => !sourceGroups.has(group))
        || !hasGameCalendarCandidate
      ) {
        try {
          const feedRecords = await loadOfficialAnnouncementsFeed({ cutoffIso });
          gameRecords = buildGameAnnouncementDisplaySet({
            recentRecords: gameRecords.filter(record => !record?.is_recent_history_fallback),
            // Prefer the live feed when DB still contains an older generated summary for the same source_id.
            latestRecords: [...feedRecords, ...gameRecords],
            cutoffIso,
          });
          gameRecords = appendPinnedGameCalendarRecord(gameRecords, [...feedRecords, ...gameRecords]);
        } catch {
          // keep database-derived records
        }
      }

      if (cancelled) return;

      setGameAnnouncements(sortGameAnnouncements(gameRecords));
      setGameAnnouncementDigest(apiPayload?.gameAnnouncementDigest || null);
    };

    load();
    return () => { cancelled = true; };
  }, [setAnnouncements, setGameAnnouncements, setGameAnnouncementDigest, isSuperAdmin]);

  useEffect(() => {
    const load = async () => {
      if (!supabase || !user) return 0;
      try {
        const lastViewed = getStorageItem(STORAGE_KEYS.TICKETS_LAST_VIEWED, 0);
        const since = lastViewed ? new Date(lastViewed).toISOString() : '1970-01-01T00:00:00Z';
        let query = supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .gt('updated_at', since);
        if (!isSuperAdmin) query = query.eq('user_id', user.id);
        const { count, error } = await executeSupabaseRead(
          () => query,
          { label: 'load unread ticket count', retries: 1 },
        );
        if (!error) return count || 0;
      } catch {
        // ignored
      }
      return 0;
    };
    load().then(setUnreadTicketsCount);
  }, [user, isSuperAdmin]);

  return {
    hasNewAnnouncement,
    setHasNewAnnouncement,
    unreadTicketsCount,
    setUnreadTicketsCount,
  };
}

export default useNotificationBadges;
