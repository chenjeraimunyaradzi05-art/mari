'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore as useAppUIStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { refreshSession } from '@/lib/session-refresh';
import { socketClient } from '@/lib/socket';
import { setTokens, clearTokens } from '@/lib/auth';
import { getPreferredLocale } from '@/lib/utils';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { observeTranslations, translateDocument } from '@/i18n/domTranslator';
import { I18nextProvider } from 'react-i18next';
import { initializeI18n, setI18nLocale } from '@/i18n/next-i18n';
import { GDPRProvider } from '@/lib/contexts/GDPRContext';
import { PWAInstallPrompt } from '@/components/super-app/PWAInstallPrompt';
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

function ThemeSync({ children }: { children: React.ReactNode }) {
  const { theme } = useAppUIStore();

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

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <GDPRProvider>
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
        </GDPRProvider>
        <ClientOnly>
          <ReactQueryDevtools initialIsOpen={false} />
        </ClientOnly>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
