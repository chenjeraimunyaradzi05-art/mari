/**
 * robots.txt, pointing at the sitemap under the configured site URL rather
 * than a domain the platform does not use. Signed-in areas are kept out of
 * indexes; they need a session anyway.
 */

import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard', '/api/', '/settings', '/messages', '/onboarding', '/login', '/register', '/reset-password', '/forgot-password'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
