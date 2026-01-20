/**
 * Presence Store - Real-time User Presence
 * Phase 3: Web Client - Super App Core
 */

import { create } from 'zustand';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen?: string;
  statusMessage?: string;
  currentActivity?: string;
}

interface PresenceState {
  // Online users map
  onlineUsers: Map<string, UserPresence>;
  
  // Actions
  setUserPresence: (userId: string, presence: Partial<UserPresence>) => void;
  setUsersPresence: (presences: UserPresence[]) => void;
  removeUser: (userId: string) => void;
  
  // Getters
  isOnline: (userId: string) => boolean;
  getPresence: (userId: string) => UserPresence | undefined;
  getOnlineCount: () => number;
  
  // Current user status
  myStatus: PresenceStatus;
  myStatusMessage: string;
  setMyStatus: (status: PresenceStatus, message?: string) => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Map(),
  
  setUserPresence: (userId, presence) => {
    set((state) => {
      const newMap = new Map(state.onlineUsers);
      const existing = newMap.get(userId) || { userId, status: 'offline' };
      newMap.set(userId, { ...existing, ...presence });
      return { onlineUsers: newMap };
    });
  },
  
  setUsersPresence: (presences) => {
    set((state) => {
      const newMap = new Map(state.onlineUsers);
      presences.forEach((p) => {
        newMap.set(p.userId, p);
      });
      return { onlineUsers: newMap };
    });
  },
  
  removeUser: (userId) => {
    set((state) => {
      const newMap = new Map(state.onlineUsers);
      newMap.delete(userId);
      return { onlineUsers: newMap };
    });
  },
  
  isOnline: (userId) => {
    const presence = get().onlineUsers.get(userId);
    return presence?.status === 'online' || presence?.status === 'away';
  },
  
  getPresence: (userId) => get().onlineUsers.get(userId),
  
  getOnlineCount: () => {
    let count = 0;
    get().onlineUsers.forEach((p) => {
      if (p.status === 'online' || p.status === 'away') count++;
    });
    return count;
  },
  
  // Current user
  myStatus: 'online',
  myStatusMessage: '',
  setMyStatus: (status, message = '') => set({ myStatus: status, myStatusMessage: message }),
}));
