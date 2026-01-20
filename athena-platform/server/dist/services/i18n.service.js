"use strict";
/**
 * Backend i18n Service
 * Manages i18n keys for server-side messages, errors, and notifications
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18nService = exports.EMAIL_SUBJECT_KEYS = exports.NOTIFICATION_KEYS = exports.ERROR_KEYS = void 0;
exports.t = t;
exports.tSync = tSync;
exports.preloadTranslations = preloadTranslations;
exports.i18nError = i18nError;
exports.i18nNotification = i18nNotification;
exports.clearTranslationCache = clearTranslationCache;
const logger_1 = require("../utils/logger");
// ==========================================
// TRANSLATION KEYS
// ==========================================
// Error message keys
exports.ERROR_KEYS = {
    // Authentication
    AUTH_INVALID_CREDENTIALS: 'errors.auth.invalidCredentials',
    AUTH_SESSION_EXPIRED: 'errors.auth.sessionExpired',
    AUTH_UNAUTHORIZED: 'errors.auth.unauthorized',
    AUTH_FORBIDDEN: 'errors.auth.forbidden',
    AUTH_EMAIL_NOT_VERIFIED: 'errors.auth.emailNotVerified',
    AUTH_ACCOUNT_LOCKED: 'errors.auth.accountLocked',
    AUTH_ACCOUNT_SUSPENDED: 'errors.auth.accountSuspended',
    AUTH_MFA_REQUIRED: 'errors.auth.mfaRequired',
    AUTH_MFA_INVALID: 'errors.auth.mfaInvalid',
    AUTH_PASSWORD_TOO_WEAK: 'errors.auth.passwordTooWeak',
    // Validation
    VALIDATION_REQUIRED: 'errors.validation.required',
    VALIDATION_EMAIL_INVALID: 'errors.validation.emailInvalid',
    VALIDATION_MIN_LENGTH: 'errors.validation.minLength',
    VALIDATION_MAX_LENGTH: 'errors.validation.maxLength',
    VALIDATION_INVALID_FORMAT: 'errors.validation.invalidFormat',
    VALIDATION_FILE_TOO_LARGE: 'errors.validation.fileTooLarge',
    VALIDATION_FILE_TYPE_INVALID: 'errors.validation.fileTypeInvalid',
    // Resource
    RESOURCE_NOT_FOUND: 'errors.resource.notFound',
    RESOURCE_ALREADY_EXISTS: 'errors.resource.alreadyExists',
    RESOURCE_CONFLICT: 'errors.resource.conflict',
    RESOURCE_DELETED: 'errors.resource.deleted',
    // Payment
    PAYMENT_FAILED: 'errors.payment.failed',
    PAYMENT_CARD_DECLINED: 'errors.payment.cardDeclined',
    PAYMENT_INSUFFICIENT_FUNDS: 'errors.payment.insufficientFunds',
    PAYMENT_EXPIRED_CARD: 'errors.payment.expiredCard',
    PAYMENT_INVALID_CARD: 'errors.payment.invalidCard',
    PAYMENT_SUBSCRIPTION_REQUIRED: 'errors.payment.subscriptionRequired',
    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'errors.rateLimit.exceeded',
    RATE_LIMIT_TOO_MANY_REQUESTS: 'errors.rateLimit.tooManyRequests',
    // Server
    SERVER_INTERNAL_ERROR: 'errors.server.internalError',
    SERVER_SERVICE_UNAVAILABLE: 'errors.server.serviceUnavailable',
    SERVER_MAINTENANCE: 'errors.server.maintenance',
    SERVER_TIMEOUT: 'errors.server.timeout',
};
// Notification message keys
exports.NOTIFICATION_KEYS = {
    // Social
    NEW_FOLLOWER: 'notifications.social.newFollower',
    POST_LIKED: 'notifications.social.postLiked',
    POST_COMMENTED: 'notifications.social.postCommented',
    COMMENT_REPLIED: 'notifications.social.commentReplied',
    MENTION_IN_POST: 'notifications.social.mentionInPost',
    MENTION_IN_COMMENT: 'notifications.social.mentionInComment',
    CONNECTION_REQUEST: 'notifications.social.connectionRequest',
    CONNECTION_ACCEPTED: 'notifications.social.connectionAccepted',
    // Jobs
    JOB_APPLICATION_RECEIVED: 'notifications.jobs.applicationReceived',
    JOB_APPLICATION_VIEWED: 'notifications.jobs.applicationViewed',
    JOB_APPLICATION_SHORTLISTED: 'notifications.jobs.applicationShortlisted',
    JOB_APPLICATION_REJECTED: 'notifications.jobs.applicationRejected',
    JOB_INTERVIEW_SCHEDULED: 'notifications.jobs.interviewScheduled',
    JOB_OFFER_RECEIVED: 'notifications.jobs.offerReceived',
    JOB_MATCH_FOUND: 'notifications.jobs.matchFound',
    // Mentorship
    MENTOR_SESSION_BOOKED: 'notifications.mentorship.sessionBooked',
    MENTOR_SESSION_REMINDER: 'notifications.mentorship.sessionReminder',
    MENTOR_SESSION_STARTED: 'notifications.mentorship.sessionStarted',
    MENTOR_SESSION_COMPLETED: 'notifications.mentorship.sessionCompleted',
    MENTOR_SESSION_CANCELLED: 'notifications.mentorship.sessionCancelled',
    MENTOR_REVIEW_REQUESTED: 'notifications.mentorship.reviewRequested',
    // Courses
    COURSE_ENROLLED: 'notifications.courses.enrolled',
    COURSE_LESSON_UNLOCKED: 'notifications.courses.lessonUnlocked',
    COURSE_ASSIGNMENT_DUE: 'notifications.courses.assignmentDue',
    COURSE_CERTIFICATE_EARNED: 'notifications.courses.certificateEarned',
    COURSE_NEW_CONTENT: 'notifications.courses.newContent',
    // Groups
    GROUP_INVITATION: 'notifications.groups.invitation',
    GROUP_REQUEST_APPROVED: 'notifications.groups.requestApproved',
    GROUP_NEW_POST: 'notifications.groups.newPost',
    GROUP_ROLE_CHANGED: 'notifications.groups.roleChanged',
    GROUP_EVENT_REMINDER: 'notifications.groups.eventReminder',
    // Payments
    PAYMENT_SUCCESSFUL: 'notifications.payments.successful',
    PAYMENT_FAILED_NOTIFICATION: 'notifications.payments.failed',
    SUBSCRIPTION_RENEWED: 'notifications.payments.subscriptionRenewed',
    SUBSCRIPTION_EXPIRING: 'notifications.payments.subscriptionExpiring',
    PAYOUT_SENT: 'notifications.payments.payoutSent',
    // Safety
    REPORT_RECEIVED: 'notifications.safety.reportReceived',
    REPORT_RESOLVED: 'notifications.safety.reportResolved',
    CONTENT_REMOVED: 'notifications.safety.contentRemoved',
    ACCOUNT_WARNING: 'notifications.safety.accountWarning',
    // GDPR
    DATA_EXPORT_READY: 'notifications.gdpr.dataExportReady',
    DATA_DELETION_SCHEDULED: 'notifications.gdpr.dataDeletionScheduled',
    DATA_DELETION_COMPLETE: 'notifications.gdpr.dataDeletionComplete',
};
// Email subject keys
exports.EMAIL_SUBJECT_KEYS = {
    WELCOME: 'emails.subjects.welcome',
    VERIFY_EMAIL: 'emails.subjects.verifyEmail',
    PASSWORD_RESET: 'emails.subjects.passwordReset',
    PASSWORD_CHANGED: 'emails.subjects.passwordChanged',
    MENTOR_BOOKING: 'emails.subjects.mentorBooking',
    SESSION_REMINDER: 'emails.subjects.sessionReminder',
    APPLICATION_UPDATE: 'emails.subjects.applicationUpdate',
    PAYMENT_RECEIPT: 'emails.subjects.paymentReceipt',
    COURSE_COMPLETED: 'emails.subjects.courseCompleted',
    ACCOUNT_SUSPENDED: 'emails.subjects.accountSuspended',
    WEEKLY_DIGEST: 'emails.subjects.weeklyDigest',
};
// ==========================================
// DEFAULT TRANSLATIONS (English fallback)
// ==========================================
const DEFAULT_TRANSLATIONS = {
    // Errors - Auth
    'errors.auth.invalidCredentials': 'Invalid email or password',
    'errors.auth.sessionExpired': 'Your session has expired. Please log in again.',
    'errors.auth.unauthorized': 'You need to be logged in to access this resource',
    'errors.auth.forbidden': 'You do not have permission to access this resource',
    'errors.auth.emailNotVerified': 'Please verify your email address to continue',
    'errors.auth.accountLocked': 'Your account has been locked due to multiple failed login attempts',
    'errors.auth.accountSuspended': 'Your account has been suspended. Please contact support.',
    'errors.auth.mfaRequired': 'Two-factor authentication is required',
    'errors.auth.mfaInvalid': 'Invalid verification code',
    'errors.auth.passwordTooWeak': 'Password does not meet security requirements',
    // Errors - Validation
    'errors.validation.required': '{{field}} is required',
    'errors.validation.emailInvalid': 'Please enter a valid email address',
    'errors.validation.minLength': '{{field}} must be at least {{min}} characters',
    'errors.validation.maxLength': '{{field}} must be less than {{max}} characters',
    'errors.validation.invalidFormat': '{{field}} has an invalid format',
    'errors.validation.fileTooLarge': 'File size exceeds the limit of {{limit}}',
    'errors.validation.fileTypeInvalid': 'File type {{type}} is not allowed',
    // Errors - Resource
    'errors.resource.notFound': '{{resource}} not found',
    'errors.resource.alreadyExists': '{{resource}} already exists',
    'errors.resource.conflict': 'A conflict occurred while updating {{resource}}',
    'errors.resource.deleted': 'This {{resource}} has been deleted',
    // Errors - Payment
    'errors.payment.failed': 'Payment failed. Please try again.',
    'errors.payment.cardDeclined': 'Your card was declined',
    'errors.payment.insufficientFunds': 'Insufficient funds',
    'errors.payment.expiredCard': 'Your card has expired',
    'errors.payment.invalidCard': 'Invalid card number',
    'errors.payment.subscriptionRequired': 'A subscription is required to access this feature',
    // Errors - Rate Limit
    'errors.rateLimit.exceeded': 'Rate limit exceeded. Please try again later.',
    'errors.rateLimit.tooManyRequests': 'Too many requests. Please wait before trying again.',
    // Errors - Server
    'errors.server.internalError': 'An unexpected error occurred. Please try again.',
    'errors.server.serviceUnavailable': 'Service temporarily unavailable',
    'errors.server.maintenance': 'System is under maintenance. Please try again later.',
    'errors.server.timeout': 'Request timed out. Please try again.',
    // Notifications - Social
    'notifications.social.newFollower': '{{name}} started following you',
    'notifications.social.postLiked': '{{name}} liked your post',
    'notifications.social.postCommented': '{{name}} commented on your post',
    'notifications.social.commentReplied': '{{name}} replied to your comment',
    'notifications.social.mentionInPost': '{{name}} mentioned you in a post',
    'notifications.social.mentionInComment': '{{name}} mentioned you in a comment',
    'notifications.social.connectionRequest': '{{name}} sent you a connection request',
    'notifications.social.connectionAccepted': '{{name}} accepted your connection request',
    // Notifications - Jobs
    'notifications.jobs.applicationReceived': 'New application received for {{jobTitle}}',
    'notifications.jobs.applicationViewed': 'Your application for {{jobTitle}} was viewed',
    'notifications.jobs.applicationShortlisted': 'You\'ve been shortlisted for {{jobTitle}}',
    'notifications.jobs.applicationRejected': 'Update on your application for {{jobTitle}}',
    'notifications.jobs.interviewScheduled': 'Interview scheduled for {{jobTitle}}',
    'notifications.jobs.offerReceived': 'You received an offer for {{jobTitle}}',
    'notifications.jobs.matchFound': 'New job match: {{jobTitle}} at {{company}}',
    // Notifications - Mentorship
    'notifications.mentorship.sessionBooked': 'Session booked with {{mentorName}} on {{date}}',
    'notifications.mentorship.sessionReminder': 'Reminder: Session with {{mentorName}} in {{time}}',
    'notifications.mentorship.sessionStarted': 'Your session with {{name}} is starting now',
    'notifications.mentorship.sessionCompleted': 'Session with {{name}} completed',
    'notifications.mentorship.sessionCancelled': 'Session with {{name}} was cancelled',
    'notifications.mentorship.reviewRequested': 'Please review your session with {{mentorName}}',
    // Notifications - Courses
    'notifications.courses.enrolled': 'You enrolled in {{courseTitle}}',
    'notifications.courses.lessonUnlocked': 'New lesson unlocked: {{lessonTitle}}',
    'notifications.courses.assignmentDue': 'Assignment due soon: {{assignmentTitle}}',
    'notifications.courses.certificateEarned': 'Congratulations! You earned a certificate for {{courseTitle}}',
    'notifications.courses.newContent': 'New content added to {{courseTitle}}',
    // Email subjects
    'emails.subjects.welcome': 'Welcome to Athena!',
    'emails.subjects.verifyEmail': 'Verify your email address',
    'emails.subjects.passwordReset': 'Reset your password',
    'emails.subjects.passwordChanged': 'Your password was changed',
    'emails.subjects.mentorBooking': 'Session booked: {{date}}',
    'emails.subjects.sessionReminder': 'Reminder: Session in {{time}}',
    'emails.subjects.applicationUpdate': 'Update on your application for {{jobTitle}}',
    'emails.subjects.paymentReceipt': 'Payment receipt - {{amount}}',
    'emails.subjects.courseCompleted': 'Congratulations on completing {{courseTitle}}!',
    'emails.subjects.accountSuspended': 'Important: Your account status has changed',
    'emails.subjects.weeklyDigest': 'Your weekly Athena digest',
};
// ==========================================
// TRANSLATION SERVICE
// ==========================================
// In-memory translation cache
const translationCache = new Map();
/**
 * Load translations for a locale
 */
async function loadTranslations(locale) {
    // Check cache first
    if (translationCache.has(locale)) {
        return translationCache.get(locale);
    }
    try {
        // In production, load from database or file system
        // For now, we'll use a simplified approach
        // Try to load locale-specific translations
        // This would typically load from: locales/{locale}/backend.json
        // For the demo, we return default translations
        // A real implementation would fetch from DB or file system
        const translations = { ...DEFAULT_TRANSLATIONS };
        // Cache the translations
        translationCache.set(locale, translations);
        return translations;
    }
    catch (error) {
        logger_1.logger.warn(`Failed to load translations for locale ${locale}, using defaults`);
        return DEFAULT_TRANSLATIONS;
    }
}
/**
 * Get base locale from regional variant
 */
function getBaseLocale(locale) {
    const [base] = locale.split('-');
    return base;
}
/**
 * Translate a key with optional parameters
 */
async function t(key, params, locale = 'en') {
    // Load translations for locale
    let translations = await loadTranslations(locale);
    // Try exact locale first, then fall back to base locale
    let message = translations[key];
    if (!message && locale.includes('-')) {
        const baseLocale = getBaseLocale(locale);
        translations = await loadTranslations(baseLocale);
        message = translations[key];
    }
    // Fall back to default if not found
    if (!message) {
        message = DEFAULT_TRANSLATIONS[key] || key;
    }
    // Replace parameters
    if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            message = message.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
        }
    }
    return message;
}
/**
 * Translate a key synchronously (uses cached translations)
 */
function tSync(key, params, locale = 'en') {
    // Get cached translations or default
    const translations = translationCache.get(locale) || DEFAULT_TRANSLATIONS;
    let message = translations[key] || DEFAULT_TRANSLATIONS[key] || key;
    // Replace parameters
    if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            message = message.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
        }
    }
    return message;
}
/**
 * Preload translations for common locales
 */
async function preloadTranslations(locales) {
    await Promise.all(locales.map(loadTranslations));
    logger_1.logger.info(`Preloaded translations for ${locales.length} locales`);
}
/**
 * Get error response with i18n key
 */
function i18nError(errorKey, params, locale = 'en') {
    return {
        code: errorKey.split('.').pop()?.toUpperCase() || 'ERROR',
        message: tSync(errorKey, params, locale),
        i18nKey: errorKey,
        params,
    };
}
/**
 * Create notification payload with i18n support
 */
function i18nNotification(notificationKey, params, locale = 'en') {
    return {
        title: 'Athena', // Could also be i18n key
        body: tSync(notificationKey, params, locale),
        i18nKey: notificationKey,
        params,
    };
}
/**
 * Clear translation cache
 */
function clearTranslationCache() {
    translationCache.clear();
}
exports.i18nService = {
    t,
    tSync,
    preloadTranslations,
    i18nError,
    i18nNotification,
    clearTranslationCache,
    ERROR_KEYS: exports.ERROR_KEYS,
    NOTIFICATION_KEYS: exports.NOTIFICATION_KEYS,
    EMAIL_SUBJECT_KEYS: exports.EMAIL_SUBJECT_KEYS,
};
//# sourceMappingURL=i18n.service.js.map