import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Fraunces } from 'next/font/google';
import './globals.css';

// The display face: a soft, warm serif for the headings and italic eyebrows
// on the public pages. Exposed as a variable so Tailwind's `font-display`
// and the home page's `.eyebrow-soft` can reach it.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { SiteFooter } from '@/components/layout/SiteFooter';

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ATHENA | The Life Operating System for Women',
  description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential. ATHENA is the all-in-one platform empowering women to thrive.',
  keywords: ['careers', 'women', 'empowerment', 'jobs', 'mentorship', 'networking', 'education'],
  authors: [{ name: 'ATHENA' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'ATHENA | The Life Operating System for Women',
    description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential.',
    url: siteUrl,
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
  themeColor: '#7c3aed',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fraunces.variable} min-h-screen antialiased`} suppressHydrationWarning>
        {/* The stored theme, applied before the page becomes interactive so a
            dark reader never sees a white flash. Mirrors ThemeSync in providers.tsx. */}
        <Script id="athena-theme-init" strategy="beforeInteractive">
          {"(function(){try{var s=JSON.parse(localStorage.getItem('athena-ui')||'{}').state;var t=s&&s.theme;var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();"}
        </Script>
        <Providers>
          {children}
          <SiteFooter />
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
