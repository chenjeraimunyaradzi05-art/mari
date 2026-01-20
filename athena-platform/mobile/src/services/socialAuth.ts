/**
 * Social Authentication Service
 * Step 83: Mobile Auth Integration - Sign in with Apple/Google
 */
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';
const GOOGLE_IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId || '';
const GOOGLE_ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.googleAndroidClientId || '';

export interface SocialAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  error?: string;
}

/**
 * Sign in with Google
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  const signInWithGoogle = async (): Promise<SocialAuthResult> => {
    try {
      const result = await promptAsync();
      
      if (result.type !== 'success' || !result.authentication?.accessToken) {
        return { success: false, error: 'Google sign in was cancelled or failed' };
      }

      // Exchange Google token with our backend
      const backendResponse = await api.post('/auth/google', {
        accessToken: result.authentication.accessToken,
        idToken: result.authentication.idToken,
        platform: Platform.OS,
      });

      if (!backendResponse.data.success) {
        return { success: false, error: backendResponse.data.message || 'Backend authentication failed' };
      }

      const { accessToken, refreshToken, user } = backendResponse.data.data;

      // Store tokens securely
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { success: true, accessToken, refreshToken, user };
    } catch (error: any) {
      console.error('Google auth error:', error);
      return { success: false, error: error.message || 'Google sign in failed' };
    }
  };

  return {
    request,
    response,
    signInWithGoogle,
    isReady: !!request,
  };
}

/**
 * Sign in with Apple (iOS only)
 */
export async function signInWithApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'Sign in with Apple is only available on iOS' };
  }

  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Sign in with Apple is not available on this device' };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { success: false, error: 'No identity token received from Apple' };
    }

    // Exchange Apple credential with our backend
    const backendResponse = await api.post('/auth/apple', {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
      platform: 'ios',
    });

    if (!backendResponse.data.success) {
      return { success: false, error: backendResponse.data.message || 'Backend authentication failed' };
    }

    const { accessToken, refreshToken, user } = backendResponse.data.data;

    // Store tokens securely
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);

    return { success: true, accessToken, refreshToken, user };
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'Sign in was cancelled' };
    }
    console.error('Apple auth error:', error);
    return { success: false, error: error.message || 'Apple sign in failed' };
  }
}

/**
 * Check if social auth providers are available
 */
export async function getSocialAuthAvailability() {
  const appleAvailable = Platform.OS === 'ios' 
    ? await AppleAuthentication.isAvailableAsync()
    : false;
  
  return {
    google: true, // Google is always available via web view
    apple: appleAvailable,
  };
}

/**
 * Clear stored auth tokens
 */
export async function clearAuthTokens(): Promise<void> {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}

/**
 * Get stored access token
 */
export async function getStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('accessToken');
}

/**
 * Get stored refresh token
 */
export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync('refreshToken');
}
