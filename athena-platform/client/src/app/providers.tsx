'use client';

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuthStore, useUIStore as useAppUIStore } from '@/lib/store';
import { authApi, impactApi } from '@/lib/api';
import { refreshSession } from '@/lib/session-refresh';
import { socketClient } from '@/lib/socket';
import { setTokens, clearTokens } from '@/lib/auth';
import { getPreferredLocale } from '@/lib/utils';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { observeTranslations, translateDocument } from '@/i18n/domTranslator';
import { I18nextProvider } from 'react-i18next';
import { initializeI18n, setI18nLocale } from '@/i18n/next-i18n';
import { PWAInstallPrompt } from '@/components/super-app/PWAInstallPrompt';
import './display-preferences.css';
import { SkipLinks, AnnouncementProvider, KeyboardShortcutsProvider } from '@/lib/accessibility';
import { ClientOnly } from '@/components/ClientOnly';
import { useVideoFeedStore } from '@/lib/stores/video.store';
import { useUIStore as useSuperUIStore } from '@/lib/stores/ui.store';
import { useSearchStore } from '@/lib/stores/search.store';

function StoreHydration() {
  // Rehydrate persisted Zustand stores after mount so the first client render
  // uses default values (matching the server render) and avoids hydration errors.
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    useAppUIStore.persist.rehydrate();
    useVideoFeedStore.persist.rehydrate();
    useSuperUIStore.persist.rehydrate();
    useSearchStore.persist.rehydrate();
  }, []);

  return null;
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setLoading, login: storeLogin, logout: storeLogout } = useAuthStore();

  useEffect(() => {
    // Silent refresh via the HttpOnly cookie on mount. Strict Mode runs this
    // effect twice, so the call is single-flight: both runs await the same
    // request. Two real requests would hand the server a rotated token and it
    // would revoke every session as a replay (see lib/session-refresh.ts).
    let mounted = true;
    (async () => {
      try {
        const { accessToken, user } = await refreshSession();
        if (!mounted) return;
        if (accessToken && user) {
          storeLogin(user as unknown as Parameters<typeof storeLogin>[0], accessToken, '');
          return;
        }
        if (accessToken) {
          setTokens(accessToken, null);
          try {
            const meRes = await authApi.me();
            if (!mounted) return;
            storeLogin(meRes.data.data, accessToken, '');
            return;
          } catch {
            // fall through to logout below
          }
        }
        // If we reach here, refresh failed or returned no usable data
        clearTokens();
        storeLogout();
      } catch {
        clearTokens();
        storeLogout();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setLoading, storeLogin, storeLogout]);

  return <>{children}</>;
}

function SocketBridge() {
  const { user, accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user?.id) {
      // Covers logout and token expiry alike: no credentials, no socket.
      socketClient.disconnect();
      return;
    }

    socketClient.connect(accessToken, user.id);
  }, [isAuthenticated, accessToken, user?.id]);

  // Deliberately not disconnecting on unmount — this lives at the root, so an
  // unmount is a full teardown and React 18 strict-mode double effects would
  // otherwise tear down a healthy connection.
  return null;
}

/**
 * Lets the socket tell the bell and the inbox badge that something changed.
 *
 * The socket client wrote every new notification into a zustand store that
 * nothing on screen reads, while the bell and the unread badge read react-query
 * — ['notifications'] and ['conversations'] — which nothing refreshed until
 * the next page load. A notification that arrived while she was looking at
 * the page never appeared. This marks those two queries stale whenever the
 * server says they are, so they refetch from the server rather than being
 * patched by hand.
 *
 * The socket is replaced on every sign-in and token change, and its listeners
 * are all removed when it is, so the handlers are attached again each time
 * the client says the socket changed.
 */
function RealtimeQueryBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let attached: Socket | null = null;
    const refreshNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    const refreshConversations = () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const detach = () => {
      if (!attached) return;
      attached.off('notifications:new', refreshNotifications);
      attached.off('notifications:updated', refreshNotifications);
      attached.off('notifications:all_read', refreshNotifications);
      attached.off('messages:unread_count_updated', refreshConversations);
      attached = null;
    };

    const attach = () => {
      const socket = socketClient.getSocket();
      if (socket === attached) return;
      detach();
      if (!socket) return;
      socket.on('notifications:new', refreshNotifications);
      socket.on('notifications:updated', refreshNotifications);
      socket.on('notifications:all_read', refreshNotifications);
      socket.on('messages:unread_count_updated', refreshConversations);
      attached = socket;
    };

    attach();
    const stopListening = socketClient.onChange(attach);
    return () => {
      stopListening();
      detach();
    };
  }, [queryClient]);

  return null;
}

/** What ThemeSync reads from the accessibility profile; the rest of it is not about display. */
type AccessibilityDisplay = { highContrastMode?: boolean; reducedMotion?: boolean } | null;

/**
 * The accessibility page invalidates this key when it saves, so a change to
 * high contrast or reduced motion shows at once rather than on the next visit.
 */
export const ACCESSIBILITY_PROFILE_QUERY_KEY = ['accessibility-profile'] as const;

/**
 * Applies the member's display choices to the whole page.
 *
 * Only the theme used to be applied. The appearance page's accent colour, text
 * size, compact and reduce-motion switches were saved and read by nothing,
 * under a line promising "Changes apply straight away"; the accessibility
 * profile's high contrast and reduced motion likewise. Each is now written onto
 * <html> as a data attribute, and display-preferences.css is what those
 * attributes do.
 *
 * Reduced motion is on when either the appearance switch or the profile asks
 * for it. The profile is only fetched for a signed-in member, and a profile
 * that cannot be read simply leaves contrast as it was: this is a display
 * preference, not an answer anyone is waiting on.
 */
function ThemeSync({ children }: { children: React.ReactNode }) {
  const { theme, accentColor, fontSize, compactMode, reduceMotion } = useAppUIStore();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const accessibility = useQuery({
    queryKey: ACCESSIBILITY_PROFILE_QUERY_KEY,
    queryFn: async (): Promise<AccessibilityDisplay> => {
      const response = await impactApi.getAccessibilityProfile();
      return (response.data?.data as AccessibilityDisplay) ?? null;
    },
    enabled: isAuthenticated && !authLoading,
    staleTime: 5 * 60 * 1000,
  });
  const profile = isAuthenticated ? accessibility.data ?? null : null;
  const highContrast = Boolean(profile?.highContrastMode);
  const motionReduced = reduceMotion || Boolean(profile?.reducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accentColor = accentColor;
    root.dataset.fontSize = fontSize;
    root.dataset.compact = String(compactMode);
    root.dataset.reduceMotion = String(motionReduced);
    if (highContrast) {
      root.dataset.contrast = 'high';
    } else {
      delete root.dataset.contrast;
    }
  }, [accentColor, fontSize, compactMode, motionReduced, highContrast]);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (selected: 'light' | 'dark' | 'system') => {
      if (selected === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
        return;
      }

      root.classList.toggle('dark', selected === 'dark');
    };

    applyTheme(theme);

    // If following system theme, respond to changes.
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    // Safari fallback - these methods are deprecated but still exist in older Safari
    const mediaList = mql as MediaQueryList & {
      addListener?: (callback: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
      removeListener?: (callback: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
    };
    mediaList.addListener?.(onChange);
    return () => mediaList.removeListener?.(onChange);
  }, [theme]);

  return <>{children}</>;
}

function LocaleSync({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const locale = getPreferredLocale();
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale.split('-')[0] || 'en';
    }
    setI18nLocale(locale);
    translateDocument(locale);
    const disconnect = observeTranslations(locale);
    return () => disconnect?.();
  }, []);

  return <>{children}</>;
}

function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail for unsupported environments
      });
    }
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  // Use a default locale for server-side rendering to avoid hydration mismatch
  const [i18n, setI18n] = useState(() => initializeI18n('en-AU'));
  
  // Update i18n with client-side locale after mount
  useEffect(() => {
    const clientLocale = getPreferredLocale();
    if (clientLocale !== 'en-AU') {
      setI18n(initializeI18n(clientLocale));
    }
  }, []);

  // There used to be a GDPRProvider around all of this. It kept a second copy
  // of the cookie consent, wrote it through a second path to /api/gdpr/cookies,
  // showed its banner only to visitors it guessed were in the UK or the EU,
  // and nothing read it. CookieConsentBanner below is the one consent record.
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsProvider>
          <AnnouncementProvider>
            <ThemeSync>
              <LocaleSync>
                <StoreHydration />
                <SkipLinks />
                <AuthInitializer>
                  {children}
                  <ClientOnly>
                    <SocketBridge />
                  </ClientOnly>
                  <ClientOnly>
                    <RealtimeQueryBridge />
                  </ClientOnly>
                  <ClientOnly>
                    <PWAInstallPrompt />
                  </ClientOnly>
                  <ClientOnly>
                    <ServiceWorkerRegister />
                  </ClientOnly>
                </AuthInitializer>
              </LocaleSync>
            </ThemeSync>
          </AnnouncementProvider>
        </KeyboardShortcutsProvider>
        <ClientOnly>
          <CookieConsentBanner />
        </ClientOnly>
        <ClientOnly>
          <ReactQueryDevtools initialIsOpen={false} />
        </ClientOnly>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
