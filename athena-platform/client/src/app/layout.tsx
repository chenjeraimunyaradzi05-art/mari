import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'ATHENA | The Life Operating System for Women',
  description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential. ATHENA is the all-in-one platform empowering women to thrive.',
  keywords: ['careers', 'women', 'empowerment', 'jobs', 'mentorship', 'networking', 'education'],
  authors: [{ name: 'ATHENA' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'ATHENA | The Life Operating System for Women',
    description: 'Discover opportunities, build your career, connect with mentors, and unlock your full potential.',
    url: 'https://athena.com',
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
      <body className="min-h-screen antialiased" suppressHydrationWarning>
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
