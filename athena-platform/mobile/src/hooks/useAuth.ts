/**
 * Auth Hooks
 * Phase 5: Mobile Parity - React Query hooks for authentication
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores';
import { api, unwrapApiData } from '../services/api';
import { unsyncPushToken } from '../services/pushNotifications';
import * as SecureStore from 'expo-secure-store';

// ============================================
// TYPES
// ============================================

interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  persona?: string;
  womanSelfAttested?: boolean;
  username?: string;
  inviteCode?: string;
  referralCode?: string;
}

interface ResetPasswordData {
  email: string;
}

interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
  location?: string;
  skills?: string[];
}

interface AuthResponseData {
  user: any;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

// ============================================
// QUERY KEYS
// ============================================

export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  profile: (userId: string) => [...authKeys.all, 'profile', userId] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

// ============================================
// SECURE STORAGE HELPERS
// ============================================

const TOKENS_KEY = 'athena_auth_tokens';

export const secureStorage = {
  async saveTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(
      TOKENS_KEY,
      JSON.stringify({ accessToken, refreshToken })
    );
  },

  async getTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
    const tokens = await SecureStore.getItemAsync(TOKENS_KEY);
    return tokens ? JSON.parse(tokens) : null;
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  },
};

// ============================================
// HOOKS
// ============================================

/**
 * Get current user profile
 */
export function useCurrentUser() {
  const { user, setUser, isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const response = await api.get('/auth/me');
      return unwrapApiData(response.data);
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onSuccess: (data) => {
      setUser(data as any);
    },
    initialData: user,
  });
}

/**
 * Login mutation
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post('/auth/login', credentials);
      return unwrapApiData<AuthResponseData>(response.data);
    },
    onSuccess: async (data) => {
      const { user, accessToken, refreshToken, expiresIn } = data;
      const resolvedRefreshToken = refreshToken || (await secureStorage.getTokens())?.refreshToken;
      
      // Save tokens securely
      if (!resolvedRefreshToken) {
        throw new Error('Missing refresh token');
      }
      await secureStorage.saveTokens(accessToken, resolvedRefreshToken);
      
      // Update store
      login(user, {
        accessToken,
        refreshToken: resolvedRefreshToken,
        expiresAt: Date.now() + (expiresIn ?? 0) * 1000,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Register mutation
 */
export function useRegister() {
  const queryClient = useQueryClient();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await api.post('/auth/register', {
        ...data,
        womanSelfAttested: data.womanSelfAttested ?? true,
      });
      return unwrapApiData<AuthResponseData>(response.data);
    },
    onSuccess: async (data) => {
      const { user, accessToken, refreshToken, expiresIn } = data;
      const resolvedRefreshToken = refreshToken || (await secureStorage.getTokens())?.refreshToken;

      if (!resolvedRefreshToken) {
        throw new Error('Missing refresh token');
      }

      await secureStorage.saveTokens(accessToken, resolvedRefreshToken);
      login(user, {
        accessToken,
        refreshToken: resolvedRefreshToken,
        expiresAt: Date.now() + (expiresIn ?? 0) * 1000,
      });
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Logout mutation
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      // While still signed in: this device stops receiving this member's push.
      await unsyncPushToken();
      await api.post('/auth/logout');
    },
    onSuccess: async () => {
      await secureStorage.clearTokens();
      logout();
      queryClient.clear();
    },
    onError: async () => {
      // Even if API call fails, clear local state
      await secureStorage.clearTokens();
      logout();
      queryClient.clear();
    },
  });
}

/**
 * Refresh token mutation
 */
export function useRefreshToken() {
  const { setTokens } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      const tokens = await secureStorage.getTokens();
      if (!tokens?.refreshToken) throw new Error('No refresh token');

      const response = await api.post('/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });
      return unwrapApiData<AuthResponseData>(response.data);
    },
    onSuccess: async (data) => {
      const { accessToken, refreshToken, expiresIn } = data;
      const existingTokens = await secureStorage.getTokens();
      const resolvedRefreshToken = refreshToken || existingTokens?.refreshToken;
      if (!resolvedRefreshToken) {
        throw new Error('Missing refresh token');
      }
      await secureStorage.saveTokens(accessToken, resolvedRefreshToken);
      setTokens({
        accessToken,
        refreshToken: resolvedRefreshToken,
        expiresAt: Date.now() + (expiresIn ?? 0) * 1000,
      });
    },
  });
}

/**
 * Reset password mutation
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const response = await api.post('/auth/reset-password', data);
      return response.data;
    },
  });
}

/**
 * Update password mutation
 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (data: UpdatePasswordData) => {
      const response = await api.put('/auth/password', data);
      return response.data;
    },
  });
}

/**
 * Update profile mutation
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();

  return useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const response = await api.put('/users/profile', data);
      return response.data;
    },
    onMutate: async (newData) => {
      // Cancel outgoing fetches
      await queryClient.cancelQueries({ queryKey: authKeys.user() });

      // Snapshot previous value
      const previousUser = user;

      // Optimistic update
      if (user) {
        setUser({ ...user, ...newData });
      }

      return { previousUser };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      if (context?.previousUser) {
        setUser(context.previousUser);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
  });
}

/**
 * Social login mutation
 */
export function useSocialLogin() {
  const queryClient = useQueryClient();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async (data: { provider: 'google' | 'apple' | 'linkedin'; token: string }) => {
      const response = await api.post('/auth/social', data);
      return response.data;
    },
    onSuccess: async (data) => {
      const { user, accessToken, refreshToken, expiresIn } = data;
      await secureStorage.saveTokens(accessToken, refreshToken);
      login(user, { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 });
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Delete account mutation
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async (password: string) => {
      const response = await api.delete('/users/account', { data: { password } });
      return response.data;
    },
    onSuccess: async () => {
      await secureStorage.clearTokens();
      logout();
      queryClient.clear();
    },
  });
}

/**
 * Check if email is available
 */
export function useCheckEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/check-email', { email });
      return response.data;
    },
  });
}

/**
 * Verify email mutation
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.post('/auth/verify-email', { token });
      return unwrapApiData(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
  });
}

/**
 * Resend verification email
 */
export function useResendVerification() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/auth/resend-verification');
      return unwrapApiData(response.data);
    },
  });
}
