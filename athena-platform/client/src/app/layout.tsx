import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { APP_SITE_URL } from '@/lib/runtime-config';

export const metadata: Metadata = {
  metadataBase: new URL(APP_SITE_URL),
  title: 'ATHENA | The Life Operating System for Women',
  description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential. ATHENA is the all-in-one platform empowering women to thrive.',
  keywords: ['careers', 'women', 'empowerment', 'jobs', 'mentorship', 'networking', 'education'],
  authors: [{ name: 'ATHENA' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'ATHENA | The Life Operating System for Women',
    description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential.',
    url: APP_SITE_URL,
    siteName: 'ATHENA',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ATHENA Platform',
      },
    ],
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATHENA | The Life Operating System for Women',
    description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
};

const themeBootScript = `
  (function() {
    const storageKeys = ['athena-ui', 'athena-ui-store', 'athena-theme'];

    const readStoredTheme = () => {
      for (const key of storageKeys) {
        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;

          if (raw === 'light' || raw === 'dark' || raw === 'system') {
            return raw;
          }

          const parsed = JSON.parse(raw);
          const theme = parsed && typeof parsed === 'object'
            ? (parsed.state && parsed.state.theme) || parsed.theme
            : null;

          if (theme === 'light' || theme === 'dark' || theme === 'system') {
            return theme;
          }
        } catch (_) {}
      }

      return 'dark';
    };

    const storedTheme = readStoredTheme();
    const resolvedTheme = storedTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : storedTheme;

    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased transition-colors duration-300" suppressHydrationWarning>
        <Script id="athena-theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
