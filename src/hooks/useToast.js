import { useState, useCallback, useEffect, useRef } from 'react';
import { createNotificationId, normalizeNotification } from '../utils/notificationModel.js';

/**
 * Toast 通知 Hook
 * @returns {{toasts: Array, showToast: Function, removeToast: Function}}
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', title = null, duration = undefined) => {
    const generatedId = createNotificationId('toast');
    const notification = normalizeNotification(message, { id: generatedId, type, title, duration });
    const id = notification.id || generatedId;
    const toast = { ...notification, id };
    setToasts(prev => [...prev, toast]);

    if (toast.duration > 0) {
      const timer = window.setTimeout(() => {
        removeToast(id);
      }, toast.duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return { toasts, showToast, removeToast };
};

export default useToast;
