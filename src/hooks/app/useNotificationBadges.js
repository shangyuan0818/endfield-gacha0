import { useState, useEffect } from 'react';
import { executeSupabaseRead, fetchWithTimeout } from '../../services/supabaseRequest';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';
import { STORAGE_KEYS, hasNewContent, getStorageItem } from '../../utils';
import { buildServerlessApiUrl } from '../../utils/authRedirects';

function normalizeAnnouncements(records) {
  return Array.isArray(records) ? records : [];
}

function getManualSiteAnnouncements(records) {
  return normalizeAnnouncements(records)
    .filter((record) => record?.is_active !== false && !record?.source_id)
    .sort((left, right) => {
      const priorityDiff = (Number(right?.priority) || 0) - (Number(left?.priority) || 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return new Date(right?.updated_at || right?.created_at || 0) - new Date(left?.updated_at || left?.created_at || 0);
    });
}

function getPublishedGameAnnouncements(records) {
  return normalizeAnnouncements(records)
    .filter((record) => record?.is_active !== false && record?.source_id)
    .sort((left, right) => new Date(right?.published_at || right?.updated_at || 0) - new Date(left?.published_at || left?.updated_at || 0));
}

/**
 * 通知徽标 Hook
 * 处理新公告检测、未读工单数量
 */
export function useNotificationBadges() {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);
  const setGameAnnouncements = useAppStore(state => state.setGameAnnouncements);

  const isSuperAdmin = userRole === 'super_admin';

  // UX-006: 通知气泡状态
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);

  // 加载公告 - 优先从 Supabase 加载，失败则回退到本地 JSON
  useEffect(() => {
    const fetchAnnouncements = async () => {
      let publishedGameAnnouncements = [];

      try {
        let data = null;
        let shouldFallbackToLocal = !supabase;

        // 优先尝试从 Supabase 加载
        if (supabase) {
          const { data: dbData, error } = await executeSupabaseRead(
            () => supabase
              .from('announcements')
              .select('*')
              .eq('is_active', true)
              .order('priority', { ascending: false }),
            {
              label: 'load notification announcements',
              retries: 1,
            }
          );

          if (!error) {
            data = dbData || [];
            publishedGameAnnouncements = getPublishedGameAnnouncements(dbData);
            shouldFallbackToLocal = false;
          }
        }

        // 只在真实读取失败时回退到本地 JSON；“成功但空数组”应视为合法空态
        if (shouldFallbackToLocal) {
          const response = await fetchWithTimeout('/announcements.json', undefined, {
            label: 'load announcements fallback',
            timeoutMs: 15000,
          });
          if (response.ok) {
            const jsonData = await response.json();
            data = getManualSiteAnnouncements(jsonData);
          } else {
            data = [];
          }
        }

        const siteAnnouncements = getManualSiteAnnouncements(data);

        if (siteAnnouncements.length > 0) {
          setAnnouncements(siteAnnouncements);
          // UX-006: 检测是否有新公告
          const latestAnnouncement = siteAnnouncements[0];
          if (latestAnnouncement?.updated_at) {
            const isNew = hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, latestAnnouncement.updated_at);
            setHasNewAnnouncement(isNew);
          }
        } else {
          setAnnouncements([]);
          setHasNewAnnouncement(false);
        }
      } catch {
        setAnnouncements([]);
        setHasNewAnnouncement(false);
      }

      try {
        const response = await fetchWithTimeout(buildServerlessApiUrl('/api/automation-feed?job=official-announcements'), undefined, {
          label: 'load game announcements',
          timeoutMs: 15000,
          retries: 1,
        });

        if (!response.ok) {
          throw new Error(`Game announcements request failed: ${response.status}`);
        }

        const jsonData = await response.json();
        const gameData = Array.isArray(jsonData?.records) ? jsonData.records : [];
        setGameAnnouncements(gameData);
      } catch {
        setGameAnnouncements(publishedGameAnnouncements);
      }
    };

    fetchAnnouncements();
  }, [setAnnouncements, setGameAnnouncements]);

  // UX-006: 获取未读工单数量
  useEffect(() => {
    const fetchUnreadTickets = async () => {
      if (!supabase || !user) {
        setUnreadTicketsCount(0);
        return;
      }

      try {
        const lastViewed = getStorageItem(STORAGE_KEYS.TICKETS_LAST_VIEWED, 0);
        const lastViewedDate = lastViewed ? new Date(lastViewed).toISOString() : '1970-01-01T00:00:00Z';

        let query = supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .gt('updated_at', lastViewedDate);

        if (!isSuperAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { count, error } = await executeSupabaseRead(
          () => query,
          {
            label: 'load unread ticket count',
            retries: 1,
          }
        );

        if (!error) {
          setUnreadTicketsCount(count || 0);
        }
      } catch {
        // 静默失败
      }
    };

    fetchUnreadTickets();
  }, [user, isSuperAdmin]);

  return {
    hasNewAnnouncement,
    setHasNewAnnouncement,
    unreadTicketsCount,
    setUnreadTicketsCount
  };
}

export default useNotificationBadges;
