/**
 * Auth Store
 * Phase 5: Mobile Parity - Zustand state management
 * 
 * Handles authentication state for mobile app
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  persona?: string;
  role: 'USER' | 'EMPLOYER' | 'MENTOR' | 'ADMIN';
  subscriptionTier: 'FREE' | 'PREMIUM_CAREER' | 'EMPLOYER_BASIC' | 'EMPLOYER_PRO';
  onboardingComplete: boolean;
  emailVerified: boolean;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  // User
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Session
  lastActivity: number | null;
  sessionExpiry: number | null;
  
  // Biometric
  biometricEnabled: boolean;
  
  // Errors
  error: string | null;
}

interface AuthActions {
  // Auth actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  
  // Session
  updateLastActivity: () => void;
  checkSessionExpiry: () => boolean;
  
  // User updates
  updateUser: (updates: Partial<User>) => void;
  setOnboardingComplete: () => void;
  
  // Biometric
  setBiometricEnabled: (enabled: boolean) => void;
  
  // Loading/Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Reset
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  lastActivity: null,
  sessionExpiry: null,
  biometricEnabled: false,
  error: null,
};

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: user !== null 
      }),

      setTokens: (tokens) => set({ 
        tokens,
        sessionExpiry: tokens ? tokens.expiresAt : null 
      }),

      login: (user, tokens) => set({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: Date.now(),
        sessionExpiry: tokens.expiresAt,
        error: null,
      }),

      logout: () => set({
        ...initialState,
        isLoading: false,
        biometricEnabled: get().biometricEnabled, // Preserve biometric setting
      }),

      updateLastActivity: () => set({ 
        lastActivity: Date.now() 
      }),

      checkSessionExpiry: () => {
        const { sessionExpiry } = get();
        if (!sessionExpiry) return true;
        return Date.now() < sessionExpiry;
      },

      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),

      setOnboardingComplete: () => set((state) => ({
        user: state.user ? { ...state.user, onboardingComplete: true } : null,
      })),

      setBiometricEnabled: (enabled) => set({ 
        biometricEnabled: enabled 
      }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error, isLoading: false }),

      clearError: () => set({ error: null }),

      reset: () => set({ ...initialState, isLoading: false }),
    }),
    {
      name: 'athena-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
        biometricEnabled: state.biometricEnabled,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectTokens = (state: AuthStore) => state.tokens;
export const selectAccessToken = (state: AuthStore) => state.tokens?.accessToken;
