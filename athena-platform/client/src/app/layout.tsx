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
  // Favicon + apple-touch icons are auto-detected from app/icon.svg and app/apple-icon.svg.
  // The public/logo.png stays available as a fallback raster icon.
  icons: {
    shortcut: '/logo.png',
  },
  openGraph: {
    title: 'ATHENA | The Life Operating System for Women',
    description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential.',
    url: APP_SITE_URL,
    siteName: 'ATHENA',
    images: [
      {
        url: '/logo.png',
        width: 2048,
        height: 2048,
        alt: 'ATHENA logo',
      },
    ],
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATHENA | The Life Operating System for Women',
    description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff1f2' },
    { media: '(prefers-color-scheme: dark)', color: '#1b0713' },
  ],
};

const themeBootScript = `
  (function() {
    const storageKeys = ['athena-ui', 'athena-ui-store', 'athena-theme'];
    const allowedAccentColors = ['rose', 'purple', 'blue', 'green', 'pink', 'orange', 'teal'];
    const allowedFontSizes = ['small', 'medium', 'large'];
    const state = {
      theme: 'system',
      accentColor: 'rose',
      fontSize: 'medium',
      compactMode: false,
      reduceMotion: false
    };

    const readStoredUIState = () => {
      for (const key of storageKeys) {
        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;

          if (raw === 'light' || raw === 'dark' || raw === 'system') {
            state.theme = raw;
            continue;
          }

          const parsed = JSON.parse(raw);
          const stored = parsed && typeof parsed === 'object'
            ? (parsed.state && typeof parsed.state === 'object' ? parsed.state : parsed)
            : null;

          const theme = stored ? stored.theme : null;
          if (theme === 'light' || theme === 'dark' || theme === 'system') {
            state.theme = theme;
          }

          if (key === 'athena-ui' && stored) {
            if (allowedAccentColors.indexOf(stored.accentColor) >= 0) {
              state.accentColor = stored.accentColor;
            }
            if (allowedFontSizes.indexOf(stored.fontSize) >= 0) {
              state.fontSize = stored.fontSize;
            }
            if (typeof stored.compactMode === 'boolean') {
              state.compactMode = stored.compactMode;
            }
            if (typeof stored.reduceMotion === 'boolean') {
              state.reduceMotion = stored.reduceMotion;
            }
          }
        } catch (_) {}
      }
    };

    readStoredUIState();

    const resolvedTheme = state.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : state.theme;

    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.classList.toggle('compact', state.compactMode);
    root.classList.toggle('reduce-motion', state.reduceMotion);
    root.dataset.theme = resolvedTheme;
    root.dataset.accentColor = state.accentColor;
    root.dataset.fontSize = state.fontSize;
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
