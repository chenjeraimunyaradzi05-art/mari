'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore } from '@/lib/store';
import { bootstrapAuthFromStorage } from '@/lib/auth';
import { getPreferredLocale } from '@/lib/utils';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { observeTranslations, translateDocument } from '@/i18n/domTranslator';
import { I18nextProvider } from 'react-i18next';
import { initializeI18n, setI18nLocale } from '@/i18n/next-i18n';
import { GDPRProvider } from '@/lib/contexts/GDPRContext';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setLoading, isLoading } = useAuthStore();

  useEffect(() => {
    // Check for existing auth on mount
    const token = bootstrapAuthFromStorage();
    if (!token) {
      setLoading(false);
    }
    // Auth will be validated by the useAuth hook in layout
  }, [setLoading]);

  return <>{children}</>;
}

function ThemeSync({ children }: { children: React.ReactNode }) {
  const { theme } = useUIStore();

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

    // Safari fallback
    (mql as any).addListener?.(onChange);
    return () => (mql as any).removeListener?.(onChange);
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
  const i18n = initializeI18n(getPreferredLocale());

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <GDPRProvider>
          <ThemeSync>
            <LocaleSync>
              <AuthInitializer>{children}</AuthInitializer>
            </LocaleSync>
          </ThemeSync>
          <CookieConsentBanner />
        </GDPRProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
