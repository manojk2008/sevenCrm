import { create } from "zustand";

export interface AppNotification {
  id: string;
  type: "enquiry" | "follow-up" | "quotation" | "deal" | "system" | "task";
  title: string;
  message: string;
  read: boolean;
  href?: string;
  createdAt: string;
  actor?: {
    name: string;
    avatar?: string;
  };
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  setNotifications: (notifications: AppNotification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: AppNotification) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    }),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    })),
  removeNotification: (id) =>
    set((state) => {
      const removed = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount:
          state.unreadCount - (removed && !removed.read ? 1 : 0),
      };
    }),
}));
