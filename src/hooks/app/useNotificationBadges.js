import { useState, useEffect } from 'react';
import { executeSupabaseRead, fetchWithTimeout } from '../../services/supabaseRequest';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';
import { STORAGE_KEYS, hasNewContent, getStorageItem } from '../../utils';

function isSiteAnnouncement(record) {
  return record?.is_active !== false && !record?.source_id;
}

function isGameAnnouncement(record) {
  return record?.is_active !== false && !!record?.source_id;
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

async function loadAnnouncementsFromDb() {
  if (!supabase) return null;
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false }),
    { label: 'load announcements', retries: 1 },
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

async function loadOfficialAnnouncementsFeed() {
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

  return payload.records;
}

export function useNotificationBadges() {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);
  const setGameAnnouncements = useAppStore(state => state.setGameAnnouncements);

  const isSuperAdmin = userRole === 'super_admin';

  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let allRecords;
      try {
        const dbRecords = await loadAnnouncementsFromDb();
        allRecords = dbRecords ?? await loadAnnouncementsFromLocal();
      } catch {
        allRecords = [];
      }

      let gameRecords;
      try {
        gameRecords = await loadOfficialAnnouncementsFeed();
      } catch {
        gameRecords = allRecords.filter(isGameAnnouncement);
      }

      if (cancelled) return;

      const siteRecords = sortByPriority(allRecords.filter(isSiteAnnouncement));
      const sortedGameRecords = sortGameAnnouncements(gameRecords);

      setAnnouncements(siteRecords);
      setGameAnnouncements(sortedGameRecords);

      if (siteRecords.length > 0 && siteRecords[0]?.updated_at) {
        setHasNewAnnouncement(hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, siteRecords[0].updated_at));
      } else {
        setHasNewAnnouncement(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [setAnnouncements, setGameAnnouncements, isSuperAdmin]);

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
