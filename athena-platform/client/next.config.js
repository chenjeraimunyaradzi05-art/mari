/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // Enable standalone output for Docker/Railway deployments only.
  // Netlify's @netlify/plugin-nextjs manages output automatically.
  ...(process.env.NETLIFY ? {} : { output: 'standalone' }),
  // Security headers (DNS_SSL_CONFIGURATION.md §6)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'athena-media.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'athena-media.s3.ap-southeast-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
      },
    ],
  },
  async rewrites() {
    // On Netlify, the public/_redirects file handles API proxying.
    // Only use Next.js rewrites for local development.
    if (process.env.NETLIFY) return [];

    // Auth routes (/api/auth/*) MUST be handled by Next.js API route handlers
    // in app/api/auth/* so they can forward Set-Cookie headers (refresh token).
    // All other /api/* and /uploads/* requests proxy directly to the backend.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return {
      beforeFiles: [
        {
          source: '/uploads/:path*',
          destination: `${backendUrl}/uploads/:path*`,
        },
      ],
      afterFiles: [
        {
          source: '/api/auth/:path*',
          destination: '/api/auth/:path*',
        },
      ],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

// Sentry configuration for production error tracking
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in production
  dryRun: process.env.NODE_ENV !== 'production',
};

// Export with Sentry wrapper if DSN is configured
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
