import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'JOB_MATCH' | 'APPLICATION_UPDATE' | 'MESSAGE' | 'MENTION' | 'SYSTEM' | 'MENTOR_SESSION';
  title: string;
  message: string;
  link?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
  // Actor info for social notifications
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  // Preview content
  preview?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean; // UI panel state
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  deleteNotification: (id: string) => void; // Alias for removeNotification
  clearAll: () => void;
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  setNotifications: (notifications) => set({ 
      notifications,
      unreadCount: notifications.filter(n => !n.isRead).length
  }),

  addNotification: (notification) => set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1
  })),

  markAsRead: (id) => set((state) => {
      let decodedCount = 0;
      const updated = state.notifications.map(n => {
          if (n.id === id && !n.isRead) {
              decodedCount = 1;
              return { ...n, isRead: true };
          }
          return n;
      });
      return {
          notifications: updated,
          unreadCount: state.unreadCount - decodedCount
      };
  }),

  markAllAsRead: () => set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0
  })),

  removeNotification: (id) => set((state) => {
      const removed = state.notifications.find(n => n.id === id);
      const next = state.notifications.filter(n => n.id !== id);
      return {
          notifications: next,
          unreadCount: removed && !removed.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
  }),

  // Alias for removeNotification (for compatibility)
  deleteNotification: (id) => set((state) => {
      const removed = state.notifications.find(n => n.id === id);
      const next = state.notifications.filter(n => n.id !== id);
      return {
          notifications: next,
          unreadCount: removed && !removed.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
  }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  setPanelOpen: (isOpen) => set({ isOpen })
}));
