import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  NOTIFICATIONS_EVENT,
} from "../utils/notificationStorage";

/**
 * Live view of the logged-in user's notifications. Subscribes to the
 * custom NOTIFICATIONS_EVENT (fired by notificationStorage.js on every
 * write) so the topbar bell, its dropdown, and the full /notifications
 * page all stay in sync instantly — including across browser tabs via
 * the native `storage` event — without any shared React context.
 */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const refresh = useCallback(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setNotifications(getNotificationsForUser(user.id, user.role));
  }, [user]);

  useEffect(() => {
    refresh();
    window.addEventListener(NOTIFICATIONS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id) => {
    markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(() => {
    if (!user) return;
    markAllNotificationsRead(user.id, user.role);
  }, [user]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, refresh };
}
