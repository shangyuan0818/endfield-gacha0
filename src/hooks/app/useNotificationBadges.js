import { useState, useEffect } from 'react';
import { executeSupabaseRead, fetchWithTimeout } from '../../services/supabaseRequest';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';
import { STORAGE_KEYS, hasNewContent, getStorageItem } from '../../utils';
import { buildServerlessApiUrl } from '../../utils/authRedirects';

// ---------------------------------------------------------------------------
// 站内公告（DB）
// ---------------------------------------------------------------------------

function isSiteAnnouncement(record) {
  return record?.is_active !== false && !record?.source_id;
}

function sortByPriority(records) {
  return records.slice().sort((a, b) => {
    const pd = (Number(b?.priority) || 0) - (Number(a?.priority) || 0);
    if (pd !== 0) return pd;
    return new Date(b?.updated_at || b?.created_at || 0) - new Date(a?.updated_at || a?.created_at || 0);
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

// ---------------------------------------------------------------------------
// 游戏公告（静态 JSON，由 npm run fetch:announcements 生成）
// ---------------------------------------------------------------------------

async function loadGameAnnouncementsFromStatic() {
  const resp = await fetchWithTimeout('/game-announcements.json', undefined, {
    label: 'load game announcements',
    timeoutMs: 10000,
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// 新公告检测（超管用：对比静态 JSON 与实时 API）
// ---------------------------------------------------------------------------

async function checkForNewGameAnnouncements(staticRecords) {
  try {
    const resp = await fetchWithTimeout(
      buildServerlessApiUrl('/api/automation-feed?job=official-announcements'),
      undefined,
      { label: 'check new game announcements', timeoutMs: 15000, retries: 1 },
    );
    if (!resp.ok) return 0;
    const json = await resp.json();
    const apiRecords = Array.isArray(json?.records) ? json.records : [];
    const staticIds = new Set(staticRecords.map(r => r.source_id));
    return apiRecords.filter(r => r?.source_id && !staticIds.has(r.source_id)).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotificationBadges() {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);
  const setGameAnnouncements = useAppStore(state => state.setGameAnnouncements);

  const isSuperAdmin = userRole === 'super_admin';

  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);
  const [newGameAnnouncementCount, setNewGameAnnouncementCount] = useState(0);

  // 加载公告
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 1. 站内公告：DB → 本地 JSON 回退
      let allRecords;
      try {
        const dbRecords = await loadAnnouncementsFromDb();
        allRecords = dbRecords ?? await loadAnnouncementsFromLocal();
      } catch {
        allRecords = [];
      }
      if (cancelled) return;

      const siteRecords = sortByPriority(allRecords.filter(isSiteAnnouncement));
      setAnnouncements(siteRecords);
      if (siteRecords.length > 0 && siteRecords[0]?.updated_at) {
        setHasNewAnnouncement(hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, siteRecords[0].updated_at));
      } else {
        setHasNewAnnouncement(false);
      }

      // 2. 游戏公告：直接读取静态 JSON
      let gameRecords = [];
      try {
        gameRecords = await loadGameAnnouncementsFromStatic();
      } catch {
        // 静默失败
      }
      if (cancelled) return;
      setGameAnnouncements(gameRecords);

      // 3. 超管：检测是否有新公告可同步（对比静态 JSON 与实时 API）
      if (isSuperAdmin) {
        const newCount = await checkForNewGameAnnouncements(gameRecords);
        if (!cancelled) setNewGameAnnouncementCount(newCount);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [setAnnouncements, setGameAnnouncements, isSuperAdmin]);

  // 未读工单计数
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
        // 静默失败
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
    newGameAnnouncementCount,
  };
}

export default useNotificationBadges;
