/**
 * Notifications Store
 * Phase 5: Mobile Parity - Zustand state management
 * 
 * Handles push notifications, in-app notifications, and badges for mobile
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// TYPES
// ============================================

export type NotificationType = 
  | 'message'
  | 'job_match'
  | 'job_alert'
  | 'application_update'
  | 'interview_scheduled'
  | 'video_like'
  | 'video_comment'
  | 'video_share'
  | 'new_follower'
  | 'mention'
  | 'system'
  | 'achievement'
  | 'reminder';

export type NotificationCategory = 'social' | 'jobs' | 'messages' | 'system';

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  payload?: Record<string, any>;
}

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  imageUrl?: string;
  iconUrl?: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
  deepLink?: string;
  isRead: boolean;
  isArchived: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationGroup {
  type: NotificationType;
  notifications: Notification[];
  count: number;
  latestAt: Date;
}

export interface NotificationPreferences {
  // Push notifications
  pushEnabled: boolean;
  
  // Categories
  messages: boolean;
  jobAlerts: boolean;
  applicationUpdates: boolean;
  socialActivity: boolean;
  systemAlerts: boolean;
  achievements: boolean;
  reminders: boolean;
  
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string;
  
  // Sounds & Vibration
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  
  // Badge
  showBadge: boolean;
  
  // Frequency
  digest: 'instant' | 'hourly' | 'daily' | 'weekly';
}

interface NotificationBadges {
  total: number;
  messages: number;
  jobs: number;
  social: number;
  system: number;
}

interface NotificationsState {
  // Notifications
  notifications: Notification[];
  groupedNotifications: NotificationGroup[];
  
  // Badges
  badges: NotificationBadges;
  
  // Preferences
  preferences: NotificationPreferences;
  
  // Permission
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  pushToken?: string;
  
  // UI State
  isNotificationPanelOpen: boolean;
  selectedCategory: NotificationCategory | 'all';
  
  // Filter
  showUnreadOnly: boolean;
  
  // Loading
  isLoading: boolean;
  error: string | null;
}

interface NotificationsActions {
  // Notifications
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  addNotifications: (notifications: Notification[]) => void;
  removeNotification: (id: string) => void;
  
  // Read status
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  markCategoryAsRead: (category: NotificationCategory) => void;
  
  // Archive
  archiveNotification: (id: string) => void;
  archiveAll: () => void;
  deleteArchived: () => void;
  
  // Badges
  updateBadges: () => void;
  clearBadge: (category: NotificationCategory) => void;
  clearAllBadges: () => void;
  
  // Preferences
  setPreferences: (preferences: Partial<NotificationPreferences>) => void;
  toggleCategory: (category: keyof Pick<
    NotificationPreferences,
    'messages' | 'jobAlerts' | 'applicationUpdates' | 'socialActivity' | 'systemAlerts' | 'achievements' | 'reminders'
  >) => void;
  setQuietHours: (enabled: boolean, start?: string, end?: string) => void;
  
  // Permission
  setPermissionStatus: (status: 'granted' | 'denied' | 'undetermined') => void;
  setPushToken: (token: string) => void;
  
  // UI State
  toggleNotificationPanel: () => void;
  closeNotificationPanel: () => void;
  setSelectedCategory: (category: NotificationCategory | 'all') => void;
  toggleUnreadFilter: () => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Reset
  reset: () => void;
}

type NotificationsStore = NotificationsState & NotificationsActions;

// ============================================
// INITIAL STATE
// ============================================

const defaultPreferences: NotificationPreferences = {
  pushEnabled: true,
  messages: true,
  jobAlerts: true,
  applicationUpdates: true,
  socialActivity: true,
  systemAlerts: true,
  achievements: true,
  reminders: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  soundEnabled: true,
  vibrationEnabled: true,
  showBadge: true,
  digest: 'instant',
};

const initialState: NotificationsState = {
  notifications: [],
  groupedNotifications: [],
  badges: {
    total: 0,
    messages: 0,
    jobs: 0,
    social: 0,
    system: 0,
  },
  preferences: defaultPreferences,
  permissionStatus: 'undetermined',
  pushToken: undefined,
  isNotificationPanelOpen: false,
  selectedCategory: 'all',
  showUnreadOnly: false,
  isLoading: false,
  error: null,
};

// ============================================
// HELPERS
// ============================================

const calculateBadges = (notifications: Notification[]): NotificationBadges => {
  const unread = notifications.filter((n) => !n.isRead && !n.isArchived);
  return {
    total: unread.length,
    messages: unread.filter((n) => n.category === 'messages').length,
    jobs: unread.filter((n) => n.category === 'jobs').length,
    social: unread.filter((n) => n.category === 'social').length,
    system: unread.filter((n) => n.category === 'system').length,
  };
};

const groupNotifications = (notifications: Notification[]): NotificationGroup[] => {
  const groups: Record<NotificationType, Notification[]> = {} as any;
  
  notifications
    .filter((n) => !n.isArchived)
    .forEach((n) => {
      if (!groups[n.type]) {
        groups[n.type] = [];
      }
      groups[n.type].push(n);
    });
  
  return Object.entries(groups).map(([type, items]) => ({
    type: type as NotificationType,
    notifications: items.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    count: items.length,
    latestAt: new Date(Math.max(...items.map((i) => new Date(i.createdAt).getTime()))),
  })).sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
};

// ============================================
// STORE
// ============================================

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Notifications
      setNotifications: (notifications) => {
        const grouped = groupNotifications(notifications);
        const badges = calculateBadges(notifications);
        set({ notifications, groupedNotifications: grouped, badges });
      },

      addNotification: (notification) => set((state) => {
        const notifications = [notification, ...state.notifications];
        return {
          notifications,
          groupedNotifications: groupNotifications(notifications),
          badges: calculateBadges(notifications),
        };
      }),

      addNotifications: (newNotifications) => set((state) => {
        const notifications = [...newNotifications, ...state.notifications];
        return {
          notifications,
          groupedNotifications: groupNotifications(notifications),
          badges: calculateBadges(notifications),
        };
      }),

      removeNotification: (id) => set((state) => {
        const notifications = state.notifications.filter((n) => n.id !== id);
        return {
          notifications,
          groupedNotifications: groupNotifications(notifications),
          badges: calculateBadges(notifications),
        };
      }),

      // Read status
      markAsRead: (id) => set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        return {
          notifications,
          badges: calculateBadges(notifications),
        };
      }),

      markAllAsRead: () => set((state) => {
        const notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
        return {
          notifications,
          badges: calculateBadges(notifications),
        };
      }),

      markCategoryAsRead: (category) => set((state) => {
        const notifications = state.notifications.map((n) =>
          n.category === category ? { ...n, isRead: true } : n
        );
        return {
          notifications,
          badges: calculateBadges(notifications),
        };
      }),

      // Archive
      archiveNotification: (id) => set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, isArchived: true } : n
        );
        return {
          notifications,
          groupedNotifications: groupNotifications(notifications),
          badges: calculateBadges(notifications),
        };
      }),

      archiveAll: () => set((state) => {
        const notifications = state.notifications.map((n) => ({
          ...n,
          isArchived: true,
          isRead: true,
        }));
        return {
          notifications,
          groupedNotifications: [],
          badges: calculateBadges(notifications),
        };
      }),

      deleteArchived: () => set((state) => {
        const notifications = state.notifications.filter((n) => !n.isArchived);
        return {
          notifications,
          groupedNotifications: groupNotifications(notifications),
        };
      }),

      // Badges
      updateBadges: () => set((state) => ({
        badges: calculateBadges(state.notifications),
      })),

      clearBadge: (category) => set((state) => ({
        badges: { ...state.badges, [category]: 0 },
      })),

      clearAllBadges: () => set({
        badges: { total: 0, messages: 0, jobs: 0, social: 0, system: 0 },
      }),

      // Preferences
      setPreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences },
      })),

      toggleCategory: (category) => set((state) => ({
        preferences: {
          ...state.preferences,
          [category]: !state.preferences[category],
        },
      })),

      setQuietHours: (enabled, start, end) => set((state) => ({
        preferences: {
          ...state.preferences,
          quietHoursEnabled: enabled,
          ...(start && { quietHoursStart: start }),
          ...(end && { quietHoursEnd: end }),
        },
      })),

      // Permission
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setPushToken: (pushToken) => set({ pushToken }),

      // UI State
      toggleNotificationPanel: () => set((state) => ({
        isNotificationPanelOpen: !state.isNotificationPanelOpen,
      })),

      closeNotificationPanel: () => set({ isNotificationPanelOpen: false }),

      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

      toggleUnreadFilter: () => set((state) => ({
        showUnreadOnly: !state.showUnreadOnly,
      })),

      // Loading
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'athena-notifications-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        pushToken: state.pushToken,
        permissionStatus: state.permissionStatus,
        notifications: state.notifications.slice(0, 100),
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectUnreadNotifications = (state: NotificationsStore) =>
  state.notifications.filter((n) => !n.isRead && !n.isArchived);

export const selectNotificationsByCategory = (category: NotificationCategory) => (state: NotificationsStore) =>
  state.notifications.filter((n) => n.category === category && !n.isArchived);

export const selectArchivedNotifications = (state: NotificationsStore) =>
  state.notifications.filter((n) => n.isArchived);

export const selectHighPriorityNotifications = (state: NotificationsStore) =>
  state.notifications.filter((n) => 
    (n.priority === 'high' || n.priority === 'urgent') && !n.isRead && !n.isArchived
  );

export const selectTotalBadgeCount = (state: NotificationsStore) => state.badges.total;

export const selectIsQuietHoursActive = (state: NotificationsStore) => {
  if (!state.preferences.quietHoursEnabled) return false;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const { quietHoursStart, quietHoursEnd } = state.preferences;
  
  if (quietHoursStart <= quietHoursEnd) {
    return currentTime >= quietHoursStart && currentTime <= quietHoursEnd;
  } else {
    // Overnight quiet hours (e.g., 22:00 to 08:00)
    return currentTime >= quietHoursStart || currentTime <= quietHoursEnd;
  }
};
