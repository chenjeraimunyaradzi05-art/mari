import * as Sentry from '@sentry/node';
/**
 * Initialize Sentry error tracking for production
 */
export declare function initSentry(): void;
/**
 * Capture an exception manually
 */
export declare function captureException(error: Error, context?: Record<string, unknown>): void;
/**
 * Capture a message manually
 */
export declare function captureMessage(message: string, level?: Sentry.SeverityLevel): void;
/**
 * Set user context for error tracking
 */
export declare function setUser(user: {
    id: string;
    email?: string;
    role?: string;
}): void;
/**
 * Clear user context (on logout)
 */
export declare function clearUser(): void;
/**
 * Add breadcrumb for debugging
 */
export declare function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void;
export { Sentry };
//# sourceMappingURL=sentry.d.ts.map