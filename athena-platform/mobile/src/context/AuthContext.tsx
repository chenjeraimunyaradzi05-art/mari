/**
 * Authentication Context
 * Manages user authentication state across the app
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setAuthTokens } from '../services/api';
import { resolvePreferences, setLocalPreferences } from '../utils/preferences';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  persona: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  persona: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'athena_access_token';
const REFRESH_TOKEN_KEY = 'athena_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (accessToken) {
        setAuthTokens(accessToken, storedRefreshToken);
        const response = await api.get('/auth/me');
        const userData = response.data.data;
        setUser(userData);
        const preferences = await resolvePreferences({
          preferredLocale: userData?.preferredLocale,
          preferredCurrency: userData?.preferredCurrency,
          timezone: userData?.timezone,
          region: userData?.region,
        });
        await setLocalPreferences(preferences);
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData, accessToken, refreshToken } = response.data?.data || {};
    
    if (!accessToken || !userData) {
      throw new Error('Invalid login response');
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
    setAuthTokens(accessToken, refreshToken || null);
    setUser(userData);
    const preferences = await resolvePreferences({
      preferredLocale: userData?.preferredLocale,
      preferredCurrency: userData?.preferredCurrency,
      timezone: userData?.timezone,
      region: userData?.region,
    });
    await setLocalPreferences(preferences);
  };

  const register = async (data: RegisterData) => {
    const response = await api.post('/auth/register', data);
    const { user: userData, accessToken, refreshToken } = response.data?.data || {};
    
    if (!accessToken || !userData) {
      throw new Error('Invalid registration response');
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
    setAuthTokens(accessToken, refreshToken || null);
    setUser(userData);
    const preferences = await resolvePreferences({
      preferredLocale: userData?.preferredLocale,
      preferredCurrency: userData?.preferredCurrency,
      timezone: userData?.timezone,
      region: userData?.region,
    });
    await setLocalPreferences(preferences);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    setAuthTokens(null, null);
    setUser(null);
  };

  const refreshUser = async () => {
    const response = await api.get('/auth/me');
    setUser(response.data.data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
