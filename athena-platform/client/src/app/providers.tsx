'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore as useAppUIStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { setTokens, clearTokens } from '@/lib/auth';
import { getPreferredLocale } from '@/lib/utils';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { observeTranslations, translateDocument } from '@/i18n/domTranslator';
import { I18nextProvider } from 'react-i18next';
import { initializeI18n, setI18nLocale } from '@/i18n/next-i18n';
import { GDPRProvider } from '@/lib/contexts/GDPRContext';
import { PWAInstallPrompt } from '@/components/super-app/PWAInstallPrompt';
import FloatingAIButton from '@/components/ai/FloatingAIButton';
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
    const pathname = window.location.pathname;
    const hasStoredAuth = Boolean(window.localStorage.getItem('athena-auth'));
    const shouldBootstrapSession =
      hasStoredAuth ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/employer/organizations') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/settings');

    if (!shouldBootstrapSession) {
      setLoading(false);
      return;
    }

    // Try silent refresh via HttpOnly cookie when we likely need an authenticated session.
    let mounted = true;
    (async () => {
      try {
        const response = await authApi.refresh();
        const { accessToken, user } = response.data.data || {};
        if (!mounted) return;
        if (accessToken && user) {
          storeLogin(user, accessToken, '');
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

function ThemeSync({ children }: { children: React.ReactNode }) {
  const { theme } = useAppUIStore();

  useEffect(() => {
    const root = document.documentElement;
    const themeColor = document.querySelector('meta[name="theme-color"]');

    const applyTheme = (selected: 'light' | 'dark' | 'system') => {
      const resolvedTheme =
        selected === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : selected;

      root.classList.toggle('dark', resolvedTheme === 'dark');
      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;

      if (themeColor instanceof HTMLMetaElement) {
        themeColor.content = resolvedTheme === 'dark' ? '#020617' : '#fff7ed';
      }
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
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    const enablePwa = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true';
    const resetSessionKey = 'athena-sw-reset';

    const clearAthenaCaches = async () => {
      if (typeof window === 'undefined' || !('caches' in window)) {
        return false;
      }

      const cacheNames = await window.caches.keys();
      const athenaCacheNames = cacheNames.filter((cacheName) => cacheName.startsWith('athena-'));

      await Promise.all(athenaCacheNames.map((cacheName) => window.caches.delete(cacheName)));

      return athenaCacheNames.length > 0;
    };

    const unregisterLegacyWorker = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadRegistrations = registrations.length > 0;

        await Promise.all(registrations.map((registration) => registration.unregister()));
        const clearedCaches = await clearAthenaCaches();

        if (
          cancelled ||
          !(hadRegistrations || clearedCaches) ||
          window.sessionStorage.getItem(resetSessionKey)
        ) {
          return;
        }

        window.sessionStorage.setItem(resetSessionKey, '1');
        window.location.reload();
      } catch {
        // Silent fail for unsupported environments
      }
    };

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await registration.update();
      } catch {
        // Silent fail for unsupported environments
      }
    };

    if (enablePwa) {
      registerWorker();
    } else {
      unregisterLegacyWorker();
    }

    return () => {
      cancelled = true;
    };
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
                      <FloatingAIButton />
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
