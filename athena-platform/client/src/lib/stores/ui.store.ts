/**
 * UI Store - Global UI State Management
 * Phase 3: Web Client - Super App Core
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'social' | 'professional' | 'learning' | 'business';
export type SidebarState = 'expanded' | 'collapsed' | 'hidden';

interface UIState {
  // App Mode
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  
  // Sidebar
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  toggleSidebar: () => void;
  
  // Modals
  activeModal: string | null;
  modalData: any;
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
  
  // Command Palette / Global Search
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  
  // Mobile
  isMobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Notification Panel
  isNotificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;
  
  // Chat Panel (for slide-out on desktop)
  isChatPanelOpen: boolean;
  setChatPanelOpen: (open: boolean) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  
  // Video Feed
  isVideoFeedFullscreen: boolean;
  setVideoFeedFullscreen: (fullscreen: boolean) => void;
  
  // Toasts queue
  toasts: Toast[];
  addToast: (toastOrMessage: Omit<Toast, 'id'> | string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // App Mode
      currentMode: 'social',
      setMode: (mode) => set({ currentMode: mode }),
      
      // Sidebar
      sidebarState: 'expanded',
      setSidebarState: (state) => set({ sidebarState: state }),
      toggleSidebar: () => set((state) => ({
        sidebarState: state.sidebarState === 'expanded' ? 'collapsed' : 'expanded'
      })),
      
      // Modals
      activeModal: null,
      modalData: null,
      openModal: (modalId, data = null) => set({ activeModal: modalId, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
      
      // Command Palette
      isSearchOpen: false,
      setSearchOpen: (open) => set({ isSearchOpen: open }),
      toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
      
      // Mobile
      isMobileNavOpen: false,
      setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
      
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      
      // Notification Panel
      isNotificationPanelOpen: false,
      setNotificationPanelOpen: (open) => set({ isNotificationPanelOpen: open }),
      
      // Chat Panel
      isChatPanelOpen: false,
      setChatPanelOpen: (open) => set({ isChatPanelOpen: open }),
      activeChatId: null,
      setActiveChatId: (id) => set({ activeChatId: id, isChatPanelOpen: id !== null }),
      
      // Video Feed
      isVideoFeedFullscreen: false,
      setVideoFeedFullscreen: (fullscreen) => set({ isVideoFeedFullscreen: fullscreen }),
      
      // Toasts
      toasts: [],
      addToast: (toastOrMessage, type) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Support both (message, type) and (toastObject) patterns
        const toast: Omit<Toast, 'id'> = typeof toastOrMessage === 'string' 
          ? { title: toastOrMessage, type: type ?? 'info' }
          : toastOrMessage;
        
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }]
        }));
        
        // Auto-remove after duration
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, duration);
        }
      },
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      })),
    }),
    {
      name: 'athena-ui-store',
      partialize: (state) => ({
        currentMode: state.currentMode,
        sidebarState: state.sidebarState,
        theme: state.theme,
      }),
    }
  )
);
