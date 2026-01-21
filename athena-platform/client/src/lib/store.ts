import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from './types';
import { clearTokens, setTokens } from './auth';
import { setStoredPreference } from './utils';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => {
        if (user?.preferredLocale) setStoredPreference('athena.locale', user.preferredLocale);
        if (user?.preferredCurrency) setStoredPreference('athena.currency', user.preferredCurrency);
        if (user?.timezone) setStoredPreference('athena.timezone', user.timezone);
        if (user?.region) setStoredPreference('athena.region', user.region);
        set({ user, isAuthenticated: true });
      },

      setTokens: (accessToken, refreshToken) => {
        setTokens(accessToken, refreshToken);
        set({ accessToken, refreshToken });
      },

      login: (user, accessToken, refreshToken) => {
        setTokens(accessToken, refreshToken);
        if (user?.preferredLocale) setStoredPreference('athena.locale', user.preferredLocale);
        if (user?.preferredCurrency) setStoredPreference('athena.currency', user.preferredCurrency);
        if (user?.timezone) setStoredPreference('athena.timezone', user.timezone);
        if (user?.region) setStoredPreference('athena.region', user.region);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        clearTokens();
        // Clear persisted auth state from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('athena-auth');
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          if (updates.preferredLocale) setStoredPreference('athena.locale', updates.preferredLocale);
          if (updates.preferredCurrency) setStoredPreference('athena.currency', updates.preferredCurrency);
          if (updates.timezone) setStoredPreference('athena.timezone', updates.timezone);
          if (updates.region) setStoredPreference('athena.region', updates.region);
          set({ user: { ...currentUser, ...updates } });
        }
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'athena-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// UI Store for global UI state
interface UIState {
  isSidebarOpen: boolean;
  sidebarOpen: boolean; // Alias
  sidebarCollapsed: boolean;
  isMobileMenuOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  toggleMobileMenu: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      isSidebarOpen: true,
      get sidebarOpen() { return get().isSidebarOpen; },
      sidebarCollapsed: false,
      isMobileMenuOpen: false,
      theme: 'system',

      toggleSidebar: () => set({ isSidebarOpen: !get().isSidebarOpen }),
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      toggleMobileMenu: () => set({ isMobileMenuOpen: !get().isMobileMenuOpen }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'athena-ui',
    }
  )
);

// Notification Store
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => set({ notifications }),
  
  addNotification: (notification) =>
    set({ 
      notifications: [notification, ...get().notifications],
      unreadCount: get().unreadCount + 1,
    }),
  
  markAsRead: (id) =>
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, get().unreadCount - 1),
    }),
  
  markAllAsRead: () =>
    set({
      notifications: get().notifications.map((n) => ({
        ...n,
        readAt: n.readAt || new Date().toISOString(),
      })),
      unreadCount: 0,
    }),
  
  setUnreadCount: (count) => set({ unreadCount: count }),
}));

// Message Store
interface Conversation {
  id: string;
  partner: {
    id: string;
    firstName: string;
    lastName: string;
    profile?: {
      avatarUrl?: string;
      headline?: string;
    };
  };
  lastMessage: {
    content: string;
    createdAt: string;
    isFromMe: boolean;
  };
  unreadCount: number;
}

interface MessageState {
  conversations: Conversation[];
  totalUnread: number;
  activeConversation: string | null;
  
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (userId: string | null) => void;
  setTotalUnread: (count: number) => void;
  updateConversation: (partnerId: string, updates: Partial<Conversation>) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  conversations: [],
  totalUnread: 0,
  activeConversation: null,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (userId) => set({ activeConversation: userId }),
  setTotalUnread: (count) => set({ totalUnread: count }),
  
  updateConversation: (partnerId, updates) =>
    set({
      conversations: get().conversations.map((c) =>
        c.id === partnerId ? { ...c, ...updates } : c
      ),
    }),
}));
