/**
 * ATHENA Mobile App - Entry Point
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { syncPushToken } from './src/services/pushNotifications';
import { startOfflineSync } from './src/services/offlineSync';
import { api } from './src/services/api';
import { track } from './src/services/analytics';

export default function App() {
  useEffect(() => {
    track('app_open');
    syncPushToken();

    const unsubscribe = startOfflineSync(async (action) => {
      if (action.type === 'api') {
        const { method, url, data } = action.payload;
        await api.request({ method, url, data });
      }
    });

    return () => unsubscribe();
  }, []);

  const linking = {
    prefixes: [Linking.createURL('/'), 'athena://', 'https://athena.app'],
    config: {
      screens: {
        Auth: {
          screens: {
            Login: 'login',
            Register: 'register',
            ForgotPassword: 'forgot-password',
            ResetPassword: 'reset-password/:token?',
          },
        },
        Main: {
          screens: {
            Home: 'feed',
            Explore: 'explore',
            Jobs: 'jobs',
            Community: 'community',
            Profile: 'profile',
          },
        },
        ChatDetail: 'messages/:conversationId',
        ProfileEdit: 'profile/edit',
      },
    },
  } as const;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
