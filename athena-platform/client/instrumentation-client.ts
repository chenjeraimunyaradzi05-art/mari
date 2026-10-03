import * as Sentry from '@sentry/nextjs';
import { scrubReport } from './src/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'cancelled',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],
  // What a report may say: no credentials, no query string on any address (the
  // page of an emailed link carries its one-time token there), no email address
  // or token in the words. See src/lib/sentry-scrub.ts.
  beforeSend: scrubReport,
  beforeSendTransaction: scrubReport,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
