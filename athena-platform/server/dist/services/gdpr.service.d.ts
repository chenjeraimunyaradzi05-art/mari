/**
 * GDPR Compliance Service
 * Handles DSAR requests, data export, deletion, and compliance operations
 * Phase 4: UK/EU Market Launch
 */
import { DSARType, DataCategory, ConsentType } from '@prisma/client';
interface DSARRequestInput {
    userId: string;
    type: DSARType;
    requestDetails?: string;
}
interface DSARExportData {
    profile: object;
    posts: object[];
    comments: object[];
    messages: object[];
    likes: object[];
    follows: object;
    groups: object[];
    events: object[];
    jobs: object[];
    courses: object[];
    mentorSessions: object[];
    subscriptions: object;
    auditLogs: object[];
    consents: object[];
    metadata: object;
}
export declare class GDPRService {
    /**
     * Get all DSAR requests for a user
     */
    getDSARRequests(userId: string): Promise<any[]>;
    /**
     * Get a single DSAR request
     */
    getDSARRequest(requestId: string): Promise<any>;
    /**
     * Create a new DSAR request
     */
    createDSARRequest(input: DSARRequestInput): Promise<any>;
    /**
     * Process DSAR Export Request - Gather all user data
     */
    processExportRequest(dsarId: string): Promise<DSARExportData>;
    /**
     * Process DSAR Deletion Request - Right to be Forgotten
     */
    processDeletionRequest(dsarId: string): Promise<void>;
    /**
     * Process Rectification Request
     */
    processRectificationRequest(dsarId: string, corrections: Record<string, any>): Promise<void>;
    /**
     * Record user consent
     */
    recordConsent(userId: string, consentType: ConsentType, granted: boolean, context: {
        ipAddress?: string;
        userAgent?: string;
        region?: string;
    }): Promise<any>;
    /**
     * Get all consents for a user
     */
    getUserConsents(userId: string): Promise<any[]>;
    /**
     * Bulk update consents (for Privacy Center)
     */
    bulkUpdateConsents(userId: string, consents: Array<{
        type: ConsentType;
        granted: boolean;
    }>, context: {
        ipAddress?: string;
        userAgent?: string;
        region?: string;
    }): Promise<void>;
    /**
     * Record cookie consent
     */
    recordCookieConsent(visitorId: string, preferences: {
        analytics: boolean;
        marketing: boolean;
        functional: boolean;
    }, context: {
        userId?: string;
        ipAddress?: string;
        region?: string;
    }): Promise<any>;
    /**
     * Get cookie consent for visitor
     */
    getCookieConsent(visitorId: string): Promise<any>;
    private logPrivacyAction;
    /**
     * Get data classification for export/audit
     */
    getDataClassification(): Record<string, DataCategory[]>;
    private sanitizeForExport;
}
export declare const gdprService: GDPRService;
export {};
//# sourceMappingURL=gdpr.service.d.ts.map