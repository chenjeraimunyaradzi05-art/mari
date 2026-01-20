/**
 * Backend i18n Service
 * Manages i18n keys for server-side messages, errors, and notifications
 * Phase 2: Backend Logic & Integrations
 */
export type SupportedLocale = 'en' | 'en-US' | 'en-GB' | 'en-AU' | 'en-AE' | 'en-EG' | 'en-PH' | 'en-SA' | 'en-SG' | 'en-ZA' | 'ar' | 'ar-AE' | 'ar-EG' | 'ar-SA' | 'es' | 'es-MX' | 'de' | 'fr' | 'pt' | 'zh' | 'ja' | 'ko' | 'hi';
type I18nParams = Record<string, string | number>;
export declare const ERROR_KEYS: {
    readonly AUTH_INVALID_CREDENTIALS: "errors.auth.invalidCredentials";
    readonly AUTH_SESSION_EXPIRED: "errors.auth.sessionExpired";
    readonly AUTH_UNAUTHORIZED: "errors.auth.unauthorized";
    readonly AUTH_FORBIDDEN: "errors.auth.forbidden";
    readonly AUTH_EMAIL_NOT_VERIFIED: "errors.auth.emailNotVerified";
    readonly AUTH_ACCOUNT_LOCKED: "errors.auth.accountLocked";
    readonly AUTH_ACCOUNT_SUSPENDED: "errors.auth.accountSuspended";
    readonly AUTH_MFA_REQUIRED: "errors.auth.mfaRequired";
    readonly AUTH_MFA_INVALID: "errors.auth.mfaInvalid";
    readonly AUTH_PASSWORD_TOO_WEAK: "errors.auth.passwordTooWeak";
    readonly VALIDATION_REQUIRED: "errors.validation.required";
    readonly VALIDATION_EMAIL_INVALID: "errors.validation.emailInvalid";
    readonly VALIDATION_MIN_LENGTH: "errors.validation.minLength";
    readonly VALIDATION_MAX_LENGTH: "errors.validation.maxLength";
    readonly VALIDATION_INVALID_FORMAT: "errors.validation.invalidFormat";
    readonly VALIDATION_FILE_TOO_LARGE: "errors.validation.fileTooLarge";
    readonly VALIDATION_FILE_TYPE_INVALID: "errors.validation.fileTypeInvalid";
    readonly RESOURCE_NOT_FOUND: "errors.resource.notFound";
    readonly RESOURCE_ALREADY_EXISTS: "errors.resource.alreadyExists";
    readonly RESOURCE_CONFLICT: "errors.resource.conflict";
    readonly RESOURCE_DELETED: "errors.resource.deleted";
    readonly PAYMENT_FAILED: "errors.payment.failed";
    readonly PAYMENT_CARD_DECLINED: "errors.payment.cardDeclined";
    readonly PAYMENT_INSUFFICIENT_FUNDS: "errors.payment.insufficientFunds";
    readonly PAYMENT_EXPIRED_CARD: "errors.payment.expiredCard";
    readonly PAYMENT_INVALID_CARD: "errors.payment.invalidCard";
    readonly PAYMENT_SUBSCRIPTION_REQUIRED: "errors.payment.subscriptionRequired";
    readonly RATE_LIMIT_EXCEEDED: "errors.rateLimit.exceeded";
    readonly RATE_LIMIT_TOO_MANY_REQUESTS: "errors.rateLimit.tooManyRequests";
    readonly SERVER_INTERNAL_ERROR: "errors.server.internalError";
    readonly SERVER_SERVICE_UNAVAILABLE: "errors.server.serviceUnavailable";
    readonly SERVER_MAINTENANCE: "errors.server.maintenance";
    readonly SERVER_TIMEOUT: "errors.server.timeout";
};
export declare const NOTIFICATION_KEYS: {
    readonly NEW_FOLLOWER: "notifications.social.newFollower";
    readonly POST_LIKED: "notifications.social.postLiked";
    readonly POST_COMMENTED: "notifications.social.postCommented";
    readonly COMMENT_REPLIED: "notifications.social.commentReplied";
    readonly MENTION_IN_POST: "notifications.social.mentionInPost";
    readonly MENTION_IN_COMMENT: "notifications.social.mentionInComment";
    readonly CONNECTION_REQUEST: "notifications.social.connectionRequest";
    readonly CONNECTION_ACCEPTED: "notifications.social.connectionAccepted";
    readonly JOB_APPLICATION_RECEIVED: "notifications.jobs.applicationReceived";
    readonly JOB_APPLICATION_VIEWED: "notifications.jobs.applicationViewed";
    readonly JOB_APPLICATION_SHORTLISTED: "notifications.jobs.applicationShortlisted";
    readonly JOB_APPLICATION_REJECTED: "notifications.jobs.applicationRejected";
    readonly JOB_INTERVIEW_SCHEDULED: "notifications.jobs.interviewScheduled";
    readonly JOB_OFFER_RECEIVED: "notifications.jobs.offerReceived";
    readonly JOB_MATCH_FOUND: "notifications.jobs.matchFound";
    readonly MENTOR_SESSION_BOOKED: "notifications.mentorship.sessionBooked";
    readonly MENTOR_SESSION_REMINDER: "notifications.mentorship.sessionReminder";
    readonly MENTOR_SESSION_STARTED: "notifications.mentorship.sessionStarted";
    readonly MENTOR_SESSION_COMPLETED: "notifications.mentorship.sessionCompleted";
    readonly MENTOR_SESSION_CANCELLED: "notifications.mentorship.sessionCancelled";
    readonly MENTOR_REVIEW_REQUESTED: "notifications.mentorship.reviewRequested";
    readonly COURSE_ENROLLED: "notifications.courses.enrolled";
    readonly COURSE_LESSON_UNLOCKED: "notifications.courses.lessonUnlocked";
    readonly COURSE_ASSIGNMENT_DUE: "notifications.courses.assignmentDue";
    readonly COURSE_CERTIFICATE_EARNED: "notifications.courses.certificateEarned";
    readonly COURSE_NEW_CONTENT: "notifications.courses.newContent";
    readonly GROUP_INVITATION: "notifications.groups.invitation";
    readonly GROUP_REQUEST_APPROVED: "notifications.groups.requestApproved";
    readonly GROUP_NEW_POST: "notifications.groups.newPost";
    readonly GROUP_ROLE_CHANGED: "notifications.groups.roleChanged";
    readonly GROUP_EVENT_REMINDER: "notifications.groups.eventReminder";
    readonly PAYMENT_SUCCESSFUL: "notifications.payments.successful";
    readonly PAYMENT_FAILED_NOTIFICATION: "notifications.payments.failed";
    readonly SUBSCRIPTION_RENEWED: "notifications.payments.subscriptionRenewed";
    readonly SUBSCRIPTION_EXPIRING: "notifications.payments.subscriptionExpiring";
    readonly PAYOUT_SENT: "notifications.payments.payoutSent";
    readonly REPORT_RECEIVED: "notifications.safety.reportReceived";
    readonly REPORT_RESOLVED: "notifications.safety.reportResolved";
    readonly CONTENT_REMOVED: "notifications.safety.contentRemoved";
    readonly ACCOUNT_WARNING: "notifications.safety.accountWarning";
    readonly DATA_EXPORT_READY: "notifications.gdpr.dataExportReady";
    readonly DATA_DELETION_SCHEDULED: "notifications.gdpr.dataDeletionScheduled";
    readonly DATA_DELETION_COMPLETE: "notifications.gdpr.dataDeletionComplete";
};
export declare const EMAIL_SUBJECT_KEYS: {
    readonly WELCOME: "emails.subjects.welcome";
    readonly VERIFY_EMAIL: "emails.subjects.verifyEmail";
    readonly PASSWORD_RESET: "emails.subjects.passwordReset";
    readonly PASSWORD_CHANGED: "emails.subjects.passwordChanged";
    readonly MENTOR_BOOKING: "emails.subjects.mentorBooking";
    readonly SESSION_REMINDER: "emails.subjects.sessionReminder";
    readonly APPLICATION_UPDATE: "emails.subjects.applicationUpdate";
    readonly PAYMENT_RECEIPT: "emails.subjects.paymentReceipt";
    readonly COURSE_COMPLETED: "emails.subjects.courseCompleted";
    readonly ACCOUNT_SUSPENDED: "emails.subjects.accountSuspended";
    readonly WEEKLY_DIGEST: "emails.subjects.weeklyDigest";
};
/**
 * Translate a key with optional parameters
 */
export declare function t(key: string, params?: I18nParams, locale?: SupportedLocale): Promise<string>;
/**
 * Translate a key synchronously (uses cached translations)
 */
export declare function tSync(key: string, params?: I18nParams, locale?: SupportedLocale): string;
/**
 * Preload translations for common locales
 */
export declare function preloadTranslations(locales: SupportedLocale[]): Promise<void>;
/**
 * Get error response with i18n key
 */
export declare function i18nError(errorKey: string, params?: I18nParams, locale?: SupportedLocale): {
    code: string;
    message: string;
    i18nKey: string;
    params?: I18nParams;
};
/**
 * Create notification payload with i18n support
 */
export declare function i18nNotification(notificationKey: string, params?: I18nParams, locale?: SupportedLocale): {
    title: string;
    body: string;
    i18nKey: string;
    params?: I18nParams;
};
/**
 * Clear translation cache
 */
export declare function clearTranslationCache(): void;
export declare const i18nService: {
    t: typeof t;
    tSync: typeof tSync;
    preloadTranslations: typeof preloadTranslations;
    i18nError: typeof i18nError;
    i18nNotification: typeof i18nNotification;
    clearTranslationCache: typeof clearTranslationCache;
    ERROR_KEYS: {
        readonly AUTH_INVALID_CREDENTIALS: "errors.auth.invalidCredentials";
        readonly AUTH_SESSION_EXPIRED: "errors.auth.sessionExpired";
        readonly AUTH_UNAUTHORIZED: "errors.auth.unauthorized";
        readonly AUTH_FORBIDDEN: "errors.auth.forbidden";
        readonly AUTH_EMAIL_NOT_VERIFIED: "errors.auth.emailNotVerified";
        readonly AUTH_ACCOUNT_LOCKED: "errors.auth.accountLocked";
        readonly AUTH_ACCOUNT_SUSPENDED: "errors.auth.accountSuspended";
        readonly AUTH_MFA_REQUIRED: "errors.auth.mfaRequired";
        readonly AUTH_MFA_INVALID: "errors.auth.mfaInvalid";
        readonly AUTH_PASSWORD_TOO_WEAK: "errors.auth.passwordTooWeak";
        readonly VALIDATION_REQUIRED: "errors.validation.required";
        readonly VALIDATION_EMAIL_INVALID: "errors.validation.emailInvalid";
        readonly VALIDATION_MIN_LENGTH: "errors.validation.minLength";
        readonly VALIDATION_MAX_LENGTH: "errors.validation.maxLength";
        readonly VALIDATION_INVALID_FORMAT: "errors.validation.invalidFormat";
        readonly VALIDATION_FILE_TOO_LARGE: "errors.validation.fileTooLarge";
        readonly VALIDATION_FILE_TYPE_INVALID: "errors.validation.fileTypeInvalid";
        readonly RESOURCE_NOT_FOUND: "errors.resource.notFound";
        readonly RESOURCE_ALREADY_EXISTS: "errors.resource.alreadyExists";
        readonly RESOURCE_CONFLICT: "errors.resource.conflict";
        readonly RESOURCE_DELETED: "errors.resource.deleted";
        readonly PAYMENT_FAILED: "errors.payment.failed";
        readonly PAYMENT_CARD_DECLINED: "errors.payment.cardDeclined";
        readonly PAYMENT_INSUFFICIENT_FUNDS: "errors.payment.insufficientFunds";
        readonly PAYMENT_EXPIRED_CARD: "errors.payment.expiredCard";
        readonly PAYMENT_INVALID_CARD: "errors.payment.invalidCard";
        readonly PAYMENT_SUBSCRIPTION_REQUIRED: "errors.payment.subscriptionRequired";
        readonly RATE_LIMIT_EXCEEDED: "errors.rateLimit.exceeded";
        readonly RATE_LIMIT_TOO_MANY_REQUESTS: "errors.rateLimit.tooManyRequests";
        readonly SERVER_INTERNAL_ERROR: "errors.server.internalError";
        readonly SERVER_SERVICE_UNAVAILABLE: "errors.server.serviceUnavailable";
        readonly SERVER_MAINTENANCE: "errors.server.maintenance";
        readonly SERVER_TIMEOUT: "errors.server.timeout";
    };
    NOTIFICATION_KEYS: {
        readonly NEW_FOLLOWER: "notifications.social.newFollower";
        readonly POST_LIKED: "notifications.social.postLiked";
        readonly POST_COMMENTED: "notifications.social.postCommented";
        readonly COMMENT_REPLIED: "notifications.social.commentReplied";
        readonly MENTION_IN_POST: "notifications.social.mentionInPost";
        readonly MENTION_IN_COMMENT: "notifications.social.mentionInComment";
        readonly CONNECTION_REQUEST: "notifications.social.connectionRequest";
        readonly CONNECTION_ACCEPTED: "notifications.social.connectionAccepted";
        readonly JOB_APPLICATION_RECEIVED: "notifications.jobs.applicationReceived";
        readonly JOB_APPLICATION_VIEWED: "notifications.jobs.applicationViewed";
        readonly JOB_APPLICATION_SHORTLISTED: "notifications.jobs.applicationShortlisted";
        readonly JOB_APPLICATION_REJECTED: "notifications.jobs.applicationRejected";
        readonly JOB_INTERVIEW_SCHEDULED: "notifications.jobs.interviewScheduled";
        readonly JOB_OFFER_RECEIVED: "notifications.jobs.offerReceived";
        readonly JOB_MATCH_FOUND: "notifications.jobs.matchFound";
        readonly MENTOR_SESSION_BOOKED: "notifications.mentorship.sessionBooked";
        readonly MENTOR_SESSION_REMINDER: "notifications.mentorship.sessionReminder";
        readonly MENTOR_SESSION_STARTED: "notifications.mentorship.sessionStarted";
        readonly MENTOR_SESSION_COMPLETED: "notifications.mentorship.sessionCompleted";
        readonly MENTOR_SESSION_CANCELLED: "notifications.mentorship.sessionCancelled";
        readonly MENTOR_REVIEW_REQUESTED: "notifications.mentorship.reviewRequested";
        readonly COURSE_ENROLLED: "notifications.courses.enrolled";
        readonly COURSE_LESSON_UNLOCKED: "notifications.courses.lessonUnlocked";
        readonly COURSE_ASSIGNMENT_DUE: "notifications.courses.assignmentDue";
        readonly COURSE_CERTIFICATE_EARNED: "notifications.courses.certificateEarned";
        readonly COURSE_NEW_CONTENT: "notifications.courses.newContent";
        readonly GROUP_INVITATION: "notifications.groups.invitation";
        readonly GROUP_REQUEST_APPROVED: "notifications.groups.requestApproved";
        readonly GROUP_NEW_POST: "notifications.groups.newPost";
        readonly GROUP_ROLE_CHANGED: "notifications.groups.roleChanged";
        readonly GROUP_EVENT_REMINDER: "notifications.groups.eventReminder";
        readonly PAYMENT_SUCCESSFUL: "notifications.payments.successful";
        readonly PAYMENT_FAILED_NOTIFICATION: "notifications.payments.failed";
        readonly SUBSCRIPTION_RENEWED: "notifications.payments.subscriptionRenewed";
        readonly SUBSCRIPTION_EXPIRING: "notifications.payments.subscriptionExpiring";
        readonly PAYOUT_SENT: "notifications.payments.payoutSent";
        readonly REPORT_RECEIVED: "notifications.safety.reportReceived";
        readonly REPORT_RESOLVED: "notifications.safety.reportResolved";
        readonly CONTENT_REMOVED: "notifications.safety.contentRemoved";
        readonly ACCOUNT_WARNING: "notifications.safety.accountWarning";
        readonly DATA_EXPORT_READY: "notifications.gdpr.dataExportReady";
        readonly DATA_DELETION_SCHEDULED: "notifications.gdpr.dataDeletionScheduled";
        readonly DATA_DELETION_COMPLETE: "notifications.gdpr.dataDeletionComplete";
    };
    EMAIL_SUBJECT_KEYS: {
        readonly WELCOME: "emails.subjects.welcome";
        readonly VERIFY_EMAIL: "emails.subjects.verifyEmail";
        readonly PASSWORD_RESET: "emails.subjects.passwordReset";
        readonly PASSWORD_CHANGED: "emails.subjects.passwordChanged";
        readonly MENTOR_BOOKING: "emails.subjects.mentorBooking";
        readonly SESSION_REMINDER: "emails.subjects.sessionReminder";
        readonly APPLICATION_UPDATE: "emails.subjects.applicationUpdate";
        readonly PAYMENT_RECEIPT: "emails.subjects.paymentReceipt";
        readonly COURSE_COMPLETED: "emails.subjects.courseCompleted";
        readonly ACCOUNT_SUSPENDED: "emails.subjects.accountSuspended";
        readonly WEEKLY_DIGEST: "emails.subjects.weeklyDigest";
    };
};
export {};
//# sourceMappingURL=i18n.service.d.ts.map