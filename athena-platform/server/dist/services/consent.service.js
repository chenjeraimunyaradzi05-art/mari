"use strict";
/**
 * Consent Management Service
 * Handles granular consent tracking, verification, and audit
 * Phase 4: UK/EU Market Launch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.consentService = exports.ConsentService = exports.CONSENT_DESCRIPTIONS = exports.CONSENT_GROUPS = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Consent type groupings for UI
exports.CONSENT_GROUPS = {
    marketing: [
        client_1.ConsentType.MARKETING_EMAIL,
        client_1.ConsentType.MARKETING_SMS,
        client_1.ConsentType.MARKETING_PUSH,
    ],
    dataProcessing: [
        client_1.ConsentType.DATA_PROCESSING,
        client_1.ConsentType.PERSONALIZATION,
        client_1.ConsentType.THIRD_PARTY_SHARING,
    ],
    analytics: [client_1.ConsentType.ANALYTICS],
    cookies: [
        client_1.ConsentType.COOKIE_ESSENTIAL,
        client_1.ConsentType.COOKIE_ANALYTICS,
        client_1.ConsentType.COOKIE_MARKETING,
        client_1.ConsentType.COOKIE_FUNCTIONAL,
    ],
};
// Consent descriptions for UI
exports.CONSENT_DESCRIPTIONS = {
    [client_1.ConsentType.MARKETING_EMAIL]: {
        title: 'Marketing Emails',
        description: 'Receive promotional emails, newsletters, and special offers',
        required: false,
    },
    [client_1.ConsentType.MARKETING_SMS]: {
        title: 'Marketing SMS',
        description: 'Receive promotional text messages',
        required: false,
    },
    [client_1.ConsentType.MARKETING_PUSH]: {
        title: 'Push Notifications',
        description: 'Receive push notifications for promotions and updates',
        required: false,
    },
    [client_1.ConsentType.DATA_PROCESSING]: {
        title: 'Data Processing',
        description: 'Allow processing of your data to provide our services',
        required: true,
    },
    [client_1.ConsentType.ANALYTICS]: {
        title: 'Analytics',
        description: 'Help us improve by allowing anonymous usage analytics',
        required: false,
    },
    [client_1.ConsentType.PERSONALIZATION]: {
        title: 'Personalization',
        description: 'Allow personalized recommendations based on your activity',
        required: false,
    },
    [client_1.ConsentType.THIRD_PARTY_SHARING]: {
        title: 'Third-Party Sharing',
        description: 'Allow sharing data with trusted partners for enhanced services',
        required: false,
    },
    [client_1.ConsentType.COOKIE_ESSENTIAL]: {
        title: 'Essential Cookies',
        description: 'Required for the website to function properly',
        required: true,
    },
    [client_1.ConsentType.COOKIE_ANALYTICS]: {
        title: 'Analytics Cookies',
        description: 'Help us understand how visitors interact with our website',
        required: false,
    },
    [client_1.ConsentType.COOKIE_MARKETING]: {
        title: 'Marketing Cookies',
        description: 'Used to track visitors across websites for advertising',
        required: false,
    },
    [client_1.ConsentType.COOKIE_FUNCTIONAL]: {
        title: 'Functional Cookies',
        description: 'Enable enhanced functionality and personalization',
        required: false,
    },
};
class ConsentService {
    /**
     * Initialize default consents for new user
     */
    async initializeUserConsents(userId, context) {
        const requiredConsents = Object.entries(exports.CONSENT_DESCRIPTIONS)
            .filter(([_, config]) => config.required)
            .map(([type]) => type);
        for (const consentType of requiredConsents) {
            await prisma.consentRecord.upsert({
                where: { userId_consentType: { userId, consentType } },
                update: {},
                create: {
                    userId,
                    consentType,
                    status: client_1.ConsentStatus.GRANTED,
                    version: '1.0',
                    grantedAt: new Date(),
                    ipAddress: context.ipAddress,
                    userAgent: context.userAgent,
                    region: context.region,
                },
            });
        }
    }
    /**
     * Check if user has granted specific consent
     */
    async hasConsent(userId, consentType) {
        const consent = await prisma.consentRecord.findUnique({
            where: { userId_consentType: { userId, consentType } },
        });
        return consent?.status === client_1.ConsentStatus.GRANTED;
    }
    /**
     * Check multiple consents at once
     */
    async hasConsents(userId, consentTypes) {
        const consents = await prisma.consentRecord.findMany({
            where: {
                userId,
                consentType: { in: consentTypes },
            },
        });
        const result = {};
        for (const type of consentTypes) {
            const consent = consents.find(c => c.consentType === type);
            result[type] = consent?.status === client_1.ConsentStatus.GRANTED;
        }
        return result;
    }
    /**
     * Get consent state for Privacy Center UI
     */
    async getConsentState(userId) {
        const consents = await prisma.consentRecord.findMany({
            where: { userId },
        });
        const groups = {};
        for (const [groupName, types] of Object.entries(exports.CONSENT_GROUPS)) {
            const groupConsents = types.map(type => {
                const consent = consents.find(c => c.consentType === type);
                const config = exports.CONSENT_DESCRIPTIONS[type];
                return {
                    type,
                    ...config,
                    granted: consent?.status === client_1.ConsentStatus.GRANTED,
                    updatedAt: consent?.updatedAt || null,
                };
            });
            groups[groupName] = {
                enabled: groupConsents.some(c => c.granted && !c.required),
                consents: groupConsents,
            };
        }
        const lastUpdated = consents.length > 0
            ? new Date(Math.max(...consents.map(c => c.updatedAt.getTime())))
            : null;
        return { groups, lastUpdated };
    }
    /**
     * Withdraw all non-essential consents
     */
    async withdrawAllOptionalConsents(userId, context) {
        const optionalTypes = Object.entries(exports.CONSENT_DESCRIPTIONS)
            .filter(([_, config]) => !config.required)
            .map(([type]) => type);
        await prisma.consentRecord.updateMany({
            where: {
                userId,
                consentType: { in: optionalTypes },
            },
            data: {
                status: client_1.ConsentStatus.WITHDRAWN,
                withdrawnAt: new Date(),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                region: context.region,
            },
        });
        // Log the bulk withdrawal
        await prisma.privacyAuditLog.create({
            data: {
                userId,
                action: 'BULK_CONSENT_WITHDRAWAL',
                resourceType: 'ConsentRecord',
                details: { withdrawnTypes: optionalTypes },
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                region: context.region,
            },
        });
    }
    /**
     * Get consent history for audit
     */
    async getConsentHistory(userId) {
        return prisma.privacyAuditLog.findMany({
            where: {
                userId,
                action: {
                    in: ['CONSENT_GRANTED', 'CONSENT_WITHDRAWN', 'BULK_CONSENT_WITHDRAWAL'],
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    /**
     * Verify consent for a specific action (middleware helper)
     */
    async verifyConsentForAction(userId, action) {
        const consentMap = {
            marketing_email: client_1.ConsentType.MARKETING_EMAIL,
            analytics: client_1.ConsentType.ANALYTICS,
            personalization: client_1.ConsentType.PERSONALIZATION,
            third_party: client_1.ConsentType.THIRD_PARTY_SHARING,
        };
        const requiredConsent = consentMap[action];
        if (!requiredConsent) {
            return { allowed: false, reason: 'Unknown action type' };
        }
        const hasConsent = await this.hasConsent(userId, requiredConsent);
        if (!hasConsent) {
            return {
                allowed: false,
                reason: `User has not granted ${exports.CONSENT_DESCRIPTIONS[requiredConsent].title} consent`,
            };
        }
        return { allowed: true };
    }
}
exports.ConsentService = ConsentService;
exports.consentService = new ConsentService();
//# sourceMappingURL=consent.service.js.map