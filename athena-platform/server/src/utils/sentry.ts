import * as Sentry from '@sentry/node';
import { logger } from './logger';

/**
 * Initialize Sentry error tracking for production
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn || process.env.NODE_ENV !== 'production') {
    logger.info('Sentry: Skipping initialization (not in production or DSN not set)');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.npm_package_version || '1.0.0',
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Set sampling rate for profiling
    profilesSampleRate: 0.1,
    
    // Capture unhandled promise rejections
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
    ],
    
    // Filter out sensitive data
    beforeSend(event) {
      // Don't send events in development
      if (process.env.NODE_ENV !== 'production') {
        return null;
      }
      
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      return event;
    },
    
    // Ignore common non-error exceptions
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'cancelled',
    ],
  });

  logger.info('Sentry: Initialized successfully');
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

/**
 * A crash the mobile app reported about itself (see client-crash-report.ts).
 * Built as an Error carrying the phone's own stack, so Sentry groups repeats
 * of one crash together, and tagged so it never reads as a server fault.
 */
export function captureClientCrash(report: {
  kind: string;
  message: string;
  stack?: string;
  componentStack?: string;
  platform?: string;
  appVersion?: string;
}): void {
  if (process.env.NODE_ENV !== 'production' || !process.env.SENTRY_DSN) return;
  const error = new Error(report.message);
  error.name = `MobileCrash(${report.kind})`;
  if (report.stack) error.stack = `${error.name}: ${report.message}\n${report.stack}`;
  Sentry.captureException(error, {
    tags: { source: 'mobile', kind: report.kind, platform: report.platform ?? 'unknown', appVersion: report.appVersion ?? 'unknown' },
    extra: report.componentStack ? { componentStack: report.componentStack } : undefined,
  });
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; role?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Don't include PII beyond what's necessary
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };
