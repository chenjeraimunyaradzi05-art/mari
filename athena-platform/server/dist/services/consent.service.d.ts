/**
 * Consent Management Service
 * Handles granular consent tracking, verification, and audit
 * Phase 4: UK/EU Market Launch
 */
import { ConsentType } from '@prisma/client';
export declare const CONSENT_GROUPS: {
    marketing: ("MARKETING_EMAIL" | "MARKETING_SMS" | "MARKETING_PUSH")[];
    dataProcessing: ("DATA_PROCESSING" | "PERSONALIZATION" | "THIRD_PARTY_SHARING")[];
    analytics: "ANALYTICS"[];
    cookies: ("COOKIE_ESSENTIAL" | "COOKIE_ANALYTICS" | "COOKIE_MARKETING" | "COOKIE_FUNCTIONAL")[];
};
export declare const CONSENT_DESCRIPTIONS: Record<ConsentType, {
    title: string;
    description: string;
    required: boolean;
}>;
export declare class ConsentService {
    /**
     * Initialize default consents for new user
     */
    initializeUserConsents(userId: string, context: {
        ipAddress?: string;
        userAgent?: string;
        region?: string;
    }): Promise<void>;
    /**
     * Check if user has granted specific consent
     */
    hasConsent(userId: string, consentType: ConsentType): Promise<boolean>;
    /**
     * Check multiple consents at once
     */
    hasConsents(userId: string, consentTypes: ConsentType[]): Promise<Record<ConsentType, boolean>>;
    /**
     * Get consent state for Privacy Center UI
     */
    getConsentState(userId: string): Promise<{
        groups: Record<string, {
            enabled: boolean;
            consents: any[];
        }>;
        lastUpdated: Date | null;
    }>;
    /**
     * Withdraw all non-essential consents
     */
    withdrawAllOptionalConsents(userId: string, context: {
        ipAddress?: string;
        userAgent?: string;
        region?: string;
    }): Promise<void>;
    /**
     * Get consent history for audit
     */
    getConsentHistory(userId: string): Promise<any[]>;
    /**
     * Verify consent for a specific action (middleware helper)
     */
    verifyConsentForAction(userId: string, action: 'marketing_email' | 'analytics' | 'personalization' | 'third_party'): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
}
export declare const consentService: ConsentService;
//# sourceMappingURL=consent.service.d.ts.map