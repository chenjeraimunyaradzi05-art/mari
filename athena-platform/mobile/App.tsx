/**
 * ATHENA Mobile App - Entry Point
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinkingOptions, NavigationContainer, getStateFromPath } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator, type RootStackParamList } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { UnreplayableAction, startOfflineSync } from './src/services/offlineSync';
import { api, webUrl } from './src/services/api';
import { destinationForNotification } from './src/services/notificationRouting';
import { flushCrashReports, installGlobalCrashHandler, reportCrash } from './src/services/crashReporter';

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

/**
 * Turns a tapped notification into something the app can act on.
 *
 * Returns the deep link React Navigation should follow, or null when the
 * notification's destination only exists on the web — in which case the
 * browser has already been sent there. Either way the tap goes somewhere; it
 * used to go nowhere at all, because nothing in the app ever read a
 * notification response.
 */
function followNotification(response: Notifications.NotificationResponse | null | undefined): string | null {
  const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined;
  const destination = destinationForNotification(data);
  if (!destination) return null;
  if (destination.kind === 'app') return `athena://${destination.path}`;
  // Not awaited and not allowed to reject: a browser that refuses to open is
  // a tap that does nothing, which is bad, but it is not a reason to fail the
  // deep-link subscription that every other notification depends on.
  void Linking.openURL(webUrl(destination.path)).catch((error) => {
    console.warn('[push] Could not open this notification on the web:', error instanceof Error ? error.message : error);
  });
  return null;
}

export default function App() {
  useEffect(() => {
    // No analytics call here. There used to be track('app_open'), which read
    // as if app opens were being counted; the analytics module has no
    // provider SDK behind it and every send in it is commented out, so it
    // counted nothing, and a line that looks like measurement is worse than
    // none when someone goes looking for the numbers.
    //
    // Push registration is not started here either. It used to be, and
    // AuthContext registered again after a sign-in, so a cold start that ended
    // in one sent two registrations at once; the server wrote a row for each
    // and the phone buzzed twice for every notification. AuthContext now
    // registers once whenever a session begins — restored at launch or
    // freshly signed in — which also means a phone with nobody signed in no
    // longer asks for notification permission before anyone has an account
    // to receive them.

    // Errors nothing else caught go to the crash reporter as well as to the
    // handler that was there before; and any report a previous launch wrote
    // down but could not send — a fatal crash ends the process before the
    // request finishes — goes now.
    const uninstallCrashHandler = installGlobalCrashHandler();
    void flushCrashReports();

    const unsubscribe = startOfflineSync(async (action) => {
      if (action.type !== 'api') return;
      const { method, url, data } = action.payload;
      try {
        await api.request({ method, url, data });
      } catch (error: any) {
        // A request the server answered with a 4xx is a request it has judged,
        // and replaying it produces the same judgement every time. 408 and 429
        // are the exceptions: those are the server asking us to come back.
        const status = error?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw new UnreplayableAction(`${String(method).toUpperCase()} ${url} answered ${status}`);
        }
        throw error;
      }
    });

    return () => {
      unsubscribe();
      uninstallCrashHandler();
    };
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
        // Registered because notifications point at them. A destination that
        // notificationRouting resolves to but that is missing here drops the
        // member on the default screen, which is exactly the silence the
        // notification routing was added to end.
        Applications: 'applications',
        GroupDetail: 'groups/:groupId',
        PostComments: 'posts/:postId',
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
    // Cold start. A notification that launched the app is the reason the app
    // is open, so it wins over nothing; a real deep link still wins over it,
    // because that is the URL the operating system actually opened us with.
    getInitialURL: async () => {
      const url = await Linking.getInitialURL();
      if (url) return url;
      const response = await Notifications.getLastNotificationResponseAsync();
      return followNotification(response);
    },
    // Warm start. Providing `subscribe` replaces React Navigation's own URL
    // listener, so the ordinary deep-link channel has to be re-registered
    // here alongside the notification one.
    subscribe: (listener) => {
      const urlSubscription = Linking.addEventListener('url', ({ url }) => listener(url));
      const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const url = followNotification(response);
        if (url) listener(url);
      });
      return () => {
        urlSubscription.remove();
        notificationSubscription.remove();
      };
    },
  };

  // The boundary is outermost on purpose. It was written, exported and never
  // mounted, so any error thrown while rendering — a malformed row from the
  // API, a screen reading a field that is suddenly null — unmounted the whole
  // tree and left a white screen with no way back but force-quitting. Outside
  // AuthProvider so that a crash inside the provider itself is caught too,
  // and the fallback's "Try again" remounts everything below it.
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // To the API, which logs it and hands it to Sentry beside the web's
        // and the server's crashes (services/crashReporter.ts). This used to
        // stop at the console, with a comment admitting there was no crash
        // reporter, so a crash in a store build reached nobody.
        console.error('[app] Unhandled render error:', error?.message, error?.stack);
        void reportCrash(error, 'render', errorInfo?.componentStack);
      }}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <AppNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
