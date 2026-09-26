/**
 * Authentication Context
 * Manages user authentication state across the app
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, onSessionExpired, setAuthTokens, unwrapApiData } from '../services/api';
import { resolvePreferences, setLocalPreferences } from '../utils/preferences';
import { syncPushToken, unsyncPushToken } from '../services/pushNotifications';
import { socketService } from '../services/socket';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  headline?: string;
  bio?: string;
  persona: string;
  preferredLocale?: string;
  preferredCurrency?: string;
  timezone?: string;
  region?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ verificationRequired: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  persona: string;
  womanSelfAttested: boolean;
  // The server refuses a registration without one: an account created with no
  // date of birth can never be age-checked afterwards, and ATHENA is an adult
  // platform. Sent as an ISO date string, the same as the web form sends.
  dateOfBirth: string;
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

  /**
   * The API layer refreshes an expired access token behind the scenes, and
   * when that refresh fails there is no session left to salvage. It used to
   * clear only its own copy of the tokens, which left this context holding a
   * `user` and the app rendering the signed-in navigator over an account it
   * could no longer reach: every screen empty, every action failing, and no
   * way back to the sign-in form short of force-quitting the app.
   *
   * Nothing here calls the server. The tokens it would authenticate with are
   * exactly the ones that just stopped working, so /auth/logout and the
   * push-token handover would both 401; the phone keeps its push registration
   * until the next sign-in on it moves it. That handover is proved with the
   * device key this phone keeps in its secure store (see pushNotifications),
   * and it moves every row the phone has, so none is left delivering the
   * previous member's notifications to it.
   */
  useEffect(() => {
    return onSessionExpired(() => {
      socketService.disconnect();
      setUser(null);
      // Deliberately not awaited: React state is what puts the sign-in screen
      // back, and the stored copies must go too or the next cold start would
      // try the dead tokens again. A SecureStore that refuses the delete is
      // not worth holding the sign-out open for — checkAuth clears them on
      // the next launch when /auth/me fails.
      void SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined);
      void SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
    });
  }, []);

  const checkAuth = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (accessToken) {
        setAuthTokens(accessToken, storedRefreshToken);
        const response = await api.get('/auth/me');
        const userData = unwrapApiData<User>(response.data);
        setUser(userData);
        // A session restored at launch is a signed-in member: she gets the
        // same live connection a fresh sign-in does. Without this the socket
        // client had no caller at all and the app only ever saw new messages
        // on a pull-to-refresh.
        socketService.connect();
        // And the same push registration: this is the one registration a
        // cold start makes. App.tsx used to make a second at the same moment,
        // and the two raced into duplicate rows on the server.
        void syncPushToken();
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

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    const response = await api.post('/auth/login', {
      email,
      password,
      ...(twoFactorCode ? { twoFactorCode } : {}),
    });
    const { user: userData, accessToken, refreshToken } = unwrapApiData<{
      user: User;
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    }>(response.data);
    
    if (!accessToken || !userData) {
      throw new Error('Invalid login response');
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
    setAuthTokens(accessToken, refreshToken || null);
    setUser(userData);
    // A fresh sign-in registers this phone for push straight away, and opens
    // the real-time connection. Both are after setAuthTokens: the socket
    // handshake reads the access token from the API layer.
    void syncPushToken();
    socketService.connect();
    const preferences = await resolvePreferences({
      preferredLocale: userData?.preferredLocale,
      preferredCurrency: userData?.preferredCurrency,
      timezone: userData?.timezone,
      region: userData?.region,
    });
    await setLocalPreferences(preferences);
  };

  const register = async (data: RegisterData): Promise<{ verificationRequired: boolean }> => {
    const response = await api.post('/auth/register', data);
    const { user: userData, accessToken, refreshToken, verificationRequired } = unwrapApiData<{
      user?: User;
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      verificationRequired?: boolean;
    }>(response.data);

    if (verificationRequired || (!accessToken && userData)) {
      return { verificationRequired: true };
    }
    
    if (!accessToken || !userData) {
      throw new Error('Invalid registration response');
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
    setAuthTokens(accessToken, refreshToken || null);
    setUser(userData);
    // A fresh sign-in registers this phone for push straight away, and opens
    // the real-time connection.
    void syncPushToken();
    socketService.connect();
    const preferences = await resolvePreferences({
      preferredLocale: userData?.preferredLocale,
      preferredCurrency: userData?.preferredCurrency,
      timezone: userData?.timezone,
      region: userData?.region,
    });
    await setLocalPreferences(preferences);
    return { verificationRequired: false };
  };

  const logout = async () => {
    // Before anything else: the live connection carries this member's
    // messages and presence, and the next person to hold this phone must not
    // be sitting on it.
    socketService.disconnect();
    try {
      // While still signed in: this device stops receiving this member's push.
      await unsyncPushToken();
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
    setUser(unwrapApiData<User>(response.data));
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
