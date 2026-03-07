import { useState, useEffect } from 'react';
import { executeSupabaseRead, fetchWithTimeout } from '../../services/supabaseRequest';
import { supabase } from '../../supabaseClient';
import { useAuthStore, useAppStore } from '../../stores';
import { STORAGE_KEYS, hasNewContent, getStorageItem } from '../../utils';

/**
 * 通知徽标 Hook
 * 处理新公告检测、未读工单数量
 */
export function useNotificationBadges() {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);

  const isSuperAdmin = userRole === 'super_admin';

  // UX-006: 通知气泡状态
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);

  // 加载公告 - 优先从 Supabase 加载，失败则回退到本地 JSON
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        let data = null;

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

          if (!error && dbData && dbData.length > 0) {
            data = dbData;
          }
        }

        // 回退到本地 JSON
        if (!data) {
          const response = await fetchWithTimeout('/announcements.json', undefined, {
            label: 'load announcements fallback',
            timeoutMs: 15000,
          });
          if (response.ok) {
            const jsonData = await response.json();
            data = jsonData.filter(a => a.is_active).sort((a, b) => b.priority - a.priority);
          }
        }

        if (data && data.length > 0) {
          setAnnouncements(data);
          // UX-006: 检测是否有新公告
          const latestAnnouncement = data[0];
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
    };

    fetchAnnouncements();
  }, [setAnnouncements]);

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
