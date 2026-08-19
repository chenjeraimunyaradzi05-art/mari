"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = void 0;
exports.initSentry = initSentry;
exports.captureException = captureException;
exports.captureMessage = captureMessage;
exports.setUser = setUser;
exports.clearUser = clearUser;
exports.addBreadcrumb = addBreadcrumb;
const Sentry = __importStar(require("@sentry/node"));
exports.Sentry = Sentry;
const logger_1 = require("./logger");
/**
 * Initialize Sentry error tracking for production
 */
function initSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn || process.env.NODE_ENV !== 'production') {
        logger_1.logger.info('Sentry: Skipping initialization (not in production or DSN not set)');
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
    logger_1.logger.info('Sentry: Initialized successfully');
}
/**
 * Capture an exception manually
 */
function captureException(error, context) {
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
        Sentry.captureException(error, { extra: context });
    }
}
/**
 * Capture a message manually
 */
function captureMessage(message, level = 'info') {
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
        Sentry.captureMessage(message, level);
    }
}
/**
 * Set user context for error tracking
 */
function setUser(user) {
    Sentry.setUser({
        id: user.id,
        email: user.email,
        // Don't include PII beyond what's necessary
    });
}
/**
 * Clear user context (on logout)
 */
function clearUser() {
    Sentry.setUser(null);
}
/**
 * Add breadcrumb for debugging
 */
function addBreadcrumb(message, category, data) {
    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
    });
}
//# sourceMappingURL=sentry.js.map