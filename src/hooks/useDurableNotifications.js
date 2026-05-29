import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearReadDurableNotifications,
  dismissDurableNotification,
  getUnreadDurableNotificationCount,
  markAllDurableNotificationsRead,
  markDurableNotificationRead,
  parseStoredDurableNotifications,
  upsertDurableNotification,
} from '../utils/notificationModel.js';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils/storageUtils.js';

function loadInitialNotifications() {
  return parseStoredDurableNotifications(
    getStorageItem(STORAGE_KEYS.DURABLE_NOTIFICATIONS, [])
  );
}

export function useDurableNotifications() {
  const [notifications, setNotifications] = useState(loadInitialNotifications);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.DURABLE_NOTIFICATIONS, notifications);
  }, [notifications]);

  const addNotification = useCallback((notification) => {
    let addedNotification = null;
    setNotifications((previous) => {
      const next = upsertDurableNotification(previous, notification);
      addedNotification = next[0] || null;
      return next;
    });
    return addedNotification;
  }, []);

  const markRead = useCallback((id) => {
    setNotifications((previous) => markDurableNotificationRead(previous, id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((previous) => markAllDurableNotificationsRead(previous));
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((previous) => dismissDurableNotification(previous, id));
  }, []);

  const clearRead = useCallback(() => {
    setNotifications((previous) => clearReadDurableNotifications(previous));
  }, []);

  const unreadCount = useMemo(
    () => getUnreadDurableNotificationCount(notifications),
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
    dismissNotification,
    clearRead,
  };
}

export default useDurableNotifications;
