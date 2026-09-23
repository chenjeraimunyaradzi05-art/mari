/**
 * ATHENA Mobile App - Entry Point
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinkingOptions, NavigationContainer, getStateFromPath } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator, type RootStackParamList } from './src/navigation/AppNavigator';
import { syncPushToken } from './src/services/pushNotifications';
import { startOfflineSync } from './src/services/offlineSync';
import { api } from './src/services/api';
import { track } from './src/services/analytics';

// The web's four plan pages map onto one Strategy screen, and a screen can
// only own one path, so these are rewritten to it before the default matcher
// runs: athena://housing opens the housing plan, as https://athena.app/housing
// does on the web.
const PLAN_PATHS: Record<string, string> = {
  housing: 'HOUSING',
  business: 'BUSINESS',
  tax: 'TAX',
  investing: 'INVESTMENT',
};

export default function App() {
  useEffect(() => {
    track('app_open');
    // Deliberately not awaited: registering for push must never hold up the
    // first render, and syncPushToken swallows its own failures for exactly
    // that reason. It used to be able to reject here — a build with no EAS
    // project id threw on every cold start — which surfaced as an unhandled
    // rejection nobody could act on.
    void syncPushToken();

    const unsubscribe = startOfflineSync(async (action) => {
      if (action.type === 'api') {
        const { method, url, data } = action.payload;
        await api.request({ method, url, data });
      }
    });

    return () => unsubscribe();
  }, []);

  const linking: LinkingOptions<RootStackParamList> = {
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
            More: 'more',
            Profile: 'profile',
          },
        },
        JobDetail: 'jobs/:jobId',
        Messages: 'messages',
        ChatDetail: 'messages/:conversationId',
        ProfileEdit: 'profile/edit',
        Notifications: 'notifications',
        // The pillars, mirroring the web paths.
        Wellness: 'wellness',
        Cars: 'cars',
        Strategy: 'strategy/:area?',
        Finance: 'finances',
        Formation: 'formation',
        SkillsMarketplace: 'skills-marketplace',
        MyOrders: 'skills-marketplace/orders',
        ServiceDetail: 'skills-marketplace/:serviceId',
        Apprenticeships: 'apprenticeships',
        Groups: 'groups',
        Mentors: 'mentors',
        Learn: 'learning',
        Safety: 'safety',
        Upgrade: 'pricing',
        HelpSupport: 'help',
      },
    },
    getStateFromPath: (path, options) => {
      const clean = path.replace(/^\/+/, '').split('?')[0].replace(/\/+$/, '');
      const area = PLAN_PATHS[clean];
      return getStateFromPath(area ? `/strategy/${area}` : path, options);
    },
  };

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
