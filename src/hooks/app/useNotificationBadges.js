import { useState, useEffect } from 'react';
import { executeSupabaseRead, fetchWithTimeout } from '../../services/supabaseRequest';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';
import { STORAGE_KEYS, hasNewContent, getStorageItem } from '../../utils';
import { buildServerlessApiUrl } from '../../utils/authRedirects';

// ---------------------------------------------------------------------------
// 公告分类与合并
// ---------------------------------------------------------------------------

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

function sortByPublishedAt(records) {
  return records.slice().sort((a, b) =>
    new Date(b?.published_at || b?.updated_at || 0) - new Date(a?.published_at || a?.updated_at || 0)
  );
}

/**
 * 合并 DB 已发布游戏公告与 API 实时公告
 * - 以 source_id 去重，DB 版本优先（已审核发布）
 * - API 中有但 DB 中没有的公告补入（未发布的实时公告）
 */
function mergeGameAnnouncements(dbRecords, apiRecords) {
  const seen = new Set(dbRecords.map(r => r.source_id));
  const extra = apiRecords.filter(r => r?.source_id && !seen.has(r.source_id));
  return sortByPublishedAt([...dbRecords, ...extra]);
}

// ---------------------------------------------------------------------------
// 公告加载
// ---------------------------------------------------------------------------

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
  const response = await fetchWithTimeout('/announcements.json', undefined, {
    label: 'load announcements fallback',
    timeoutMs: 15000,
  });
  if (!response.ok) return [];
  return response.json();
}

async function loadGameAnnouncementsFromApi() {
  const response = await fetchWithTimeout(
    buildServerlessApiUrl('/api/automation-feed?job=official-announcements'),
    undefined,
    { label: 'load game announcements', timeoutMs: 15000, retries: 1 },
  );
  if (!response.ok) return [];
  const json = await response.json();
  return Array.isArray(json?.records) ? json.records : [];
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

  // 加载公告（站内 + 游戏）
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 1. 从 DB 加载全部公告，失败则回退本地 JSON
      let allRecords;
      try {
        const dbRecords = await loadAnnouncementsFromDb();
        allRecords = dbRecords ?? await loadAnnouncementsFromLocal();
      } catch {
        allRecords = [];
      }

      if (cancelled) return;

      // 2. 拆分站内公告与已发布的游戏公告
      const siteRecords = sortByPriority(allRecords.filter(isSiteAnnouncement));
      const dbGameRecords = sortByPublishedAt(allRecords.filter(isGameAnnouncement));

      // 3. 设置站内公告 + 新公告检测
      setAnnouncements(siteRecords);
      if (siteRecords.length > 0 && siteRecords[0]?.updated_at) {
        setHasNewAnnouncement(hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, siteRecords[0].updated_at));
      } else {
        setHasNewAnnouncement(false);
      }

      // 4. 从 API 加载实时游戏公告，与 DB 已发布的合并
      let apiGameRecords = [];
      try {
        apiGameRecords = await loadGameAnnouncementsFromApi();
      } catch {
        // API 失败时仅使用 DB 数据
      }

      if (cancelled) return;

      setGameAnnouncements(mergeGameAnnouncements(dbGameRecords, apiGameRecords));
    };

    load();
    return () => { cancelled = true; };
  }, [setAnnouncements, setGameAnnouncements]);

  // 未读工单计数
  useEffect(() => {
    const load = async () => {
      if (!supabase || !user) {
        return 0;
      }

      try {
        const lastViewed = getStorageItem(STORAGE_KEYS.TICKETS_LAST_VIEWED, 0);
        const since = lastViewed ? new Date(lastViewed).toISOString() : '1970-01-01T00:00:00Z';

        let query = supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .gt('updated_at', since);

        if (!isSuperAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { count, error } = await executeSupabaseRead(
          () => query,
          { label: 'load unread ticket count', retries: 1 },
        );

        if (!error) {
          return count || 0;
        }
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
  };
}

export default useNotificationBadges;
