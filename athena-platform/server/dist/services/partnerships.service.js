"use strict";
/**
 * Partnerships Service
 * Manage partnerships, integrations, and white-label configurations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.partnershipsService = exports.PARTNER_TIERS = void 0;
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
// ==========================================
// PARTNER TIERS
// ==========================================
exports.PARTNER_TIERS = {
    bronze: {
        features: {
            jobPosting: true,
            candidateSearch: false,
            analyticsAccess: false,
            apiAccess: false,
            whiteLabel: false,
            customBranding: false,
            ssoIntegration: false,
            bulkOperations: false,
        },
        limits: {
            maxUsers: 10,
            maxJobPostings: 5,
            maxApiCalls: 0,
            storageGb: 1,
        },
        revenueShare: 10,
    },
    silver: {
        features: {
            jobPosting: true,
            candidateSearch: true,
            analyticsAccess: true,
            apiAccess: false,
            whiteLabel: false,
            customBranding: false,
            ssoIntegration: false,
            bulkOperations: false,
        },
        limits: {
            maxUsers: 50,
            maxJobPostings: 25,
            maxApiCalls: 1000,
            storageGb: 10,
        },
        revenueShare: 15,
    },
    gold: {
        features: {
            jobPosting: true,
            candidateSearch: true,
            analyticsAccess: true,
            apiAccess: true,
            whiteLabel: false,
            customBranding: true,
            ssoIntegration: true,
            bulkOperations: true,
        },
        limits: {
            maxUsers: 200,
            maxJobPostings: 100,
            maxApiCalls: 10000,
            storageGb: 50,
        },
        revenueShare: 20,
    },
    platinum: {
        features: {
            jobPosting: true,
            candidateSearch: true,
            analyticsAccess: true,
            apiAccess: true,
            whiteLabel: true,
            customBranding: true,
            ssoIntegration: true,
            bulkOperations: true,
        },
        limits: {
            maxUsers: 1000,
            maxJobPostings: 500,
            maxApiCalls: 100000,
            storageGb: 200,
        },
        revenueShare: 25,
    },
    enterprise: {
        features: {
            jobPosting: true,
            candidateSearch: true,
            analyticsAccess: true,
            apiAccess: true,
            whiteLabel: true,
            customBranding: true,
            ssoIntegration: true,
            bulkOperations: true,
        },
        limits: {
            maxUsers: -1, // Unlimited
            maxJobPostings: -1,
            maxApiCalls: -1,
            storageGb: -1,
        },
        revenueShare: 30,
    },
};
// In-memory storage
const partners = new Map();
const integrations = new Map();
const whiteLabelConfigs = new Map();
// ==========================================
// SERVICE
// ==========================================
exports.partnershipsService = {
    /**
     * Create a new partner
     */
    async createPartner(data) {
        const tierConfig = exports.PARTNER_TIERS[data.tier];
        const partner = {
            id: `partner_${(0, uuid_1.v4)()}`,
            name: data.name,
            type: data.type,
            tier: data.tier,
            status: 'pending',
            contactInfo: data.contactInfo,
            configuration: {
                features: tierConfig.features,
                limits: tierConfig.limits,
                customizations: {
                    hiddenFeatures: [],
                    additionalFields: [],
                    customWorkflows: [],
                },
            },
            revenueShare: {
                percentage: tierConfig.revenueShare,
                paymentMethod: 'bank_transfer',
                minimumPayout: 100,
            },
            metrics: {
                totalUsers: 0,
                activeUsers: 0,
                jobsPosted: 0,
                applicationsProcessed: 0,
                revenue: 0,
            },
            createdAt: new Date(),
        };
        partners.set(partner.id, partner);
        logger_1.logger.info('Partner created', { partnerId: partner.id, name: data.name });
        return partner;
    },
    /**
     * Activate a partner
     */
    async activatePartner(partnerId) {
        const partner = partners.get(partnerId);
        if (!partner)
            throw new Error('Partner not found');
        partner.status = 'active';
        partner.activatedAt = new Date();
        logger_1.logger.info('Partner activated', { partnerId });
        return partner;
    },
    /**
     * Upgrade partner tier
     */
    async upgradeTier(partnerId, newTier) {
        const partner = partners.get(partnerId);
        if (!partner)
            throw new Error('Partner not found');
        const tierConfig = exports.PARTNER_TIERS[newTier];
        partner.tier = newTier;
        partner.configuration.features = tierConfig.features;
        partner.configuration.limits = tierConfig.limits;
        partner.revenueShare.percentage = tierConfig.revenueShare;
        logger_1.logger.info('Partner tier upgraded', { partnerId, newTier });
        return partner;
    },
    /**
     * Setup white-label configuration
     */
    async setupWhiteLabel(partnerId, config) {
        const partner = partners.get(partnerId);
        if (!partner)
            throw new Error('Partner not found');
        if (!partner.configuration.features.whiteLabel) {
            throw new Error('White-label not available for this tier');
        }
        const whiteLabel = {
            partnerId,
            ...config,
        };
        whiteLabelConfigs.set(partnerId, whiteLabel);
        logger_1.logger.info('White-label configured', { partnerId, domain: config.domain });
        return whiteLabel;
    },
    /**
     * Get white-label config by domain
     */
    getWhiteLabelByDomain(domain) {
        for (const config of whiteLabelConfigs.values()) {
            if (config.domain === domain)
                return config;
        }
        return undefined;
    },
    /**
     * Add integration
     */
    async addIntegration(partnerId, data) {
        const partner = partners.get(partnerId);
        if (!partner)
            throw new Error('Partner not found');
        const integration = {
            id: `int_${(0, uuid_1.v4)()}`,
            partnerId,
            type: data.type,
            name: data.name,
            endpoint: data.endpoint,
            events: data.events,
            credentials: data.credentials,
            status: 'active',
            errorCount: 0,
        };
        const partnerIntegrations = integrations.get(partnerId) || [];
        partnerIntegrations.push(integration);
        integrations.set(partnerId, partnerIntegrations);
        logger_1.logger.info('Integration added', { partnerId, integrationId: integration.id });
        return integration;
    },
    /**
     * Get partner analytics
     */
    async getPartnerAnalytics(partnerId, dateRange) {
        const partner = partners.get(partnerId);
        if (!partner)
            throw new Error('Partner not found');
        return {
            summary: partner.metrics,
            trends: Array.from({ length: 7 }, (_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                users: Math.floor(Math.random() * 50),
                jobs: Math.floor(Math.random() * 10),
                applications: Math.floor(Math.random() * 100),
            })).reverse(),
            topPerformers: [
                { metric: 'Job Views', value: 1500 },
                { metric: 'Application Rate', value: 25 },
                { metric: 'Time to Hire', value: 14 },
            ],
        };
    },
    /**
     * Calculate revenue share
     */
    calculateRevenueShare(partnerId, grossRevenue) {
        const partner = partners.get(partnerId);
        if (!partner)
            throw new Error('Partner not found');
        const partnerShare = (grossRevenue * partner.revenueShare.percentage) / 100;
        const platformShare = grossRevenue - partnerShare;
        return {
            partnerShare,
            platformShare,
            details: {
                grossRevenue,
                sharePercentage: partner.revenueShare.percentage,
                minimumPayout: partner.revenueShare.minimumPayout,
            },
        };
    },
    /**
     * Get all partners
     */
    async getAllPartners(filters) {
        let result = Array.from(partners.values());
        if (filters?.type) {
            result = result.filter(p => p.type === filters.type);
        }
        if (filters?.tier) {
            result = result.filter(p => p.tier === filters.tier);
        }
        if (filters?.status) {
            result = result.filter(p => p.status === filters.status);
        }
        return result;
    },
    /**
     * Get partner by ID
     */
    getPartner(partnerId) {
        return partners.get(partnerId);
    },
    /**
     * Trigger webhook for event
     */
    async triggerWebhook(partnerId, event, payload) {
        const partnerIntegrations = integrations.get(partnerId) || [];
        const webhooks = partnerIntegrations.filter(i => i.type === 'webhook' && i.status === 'active' && i.events.includes(event));
        for (const webhook of webhooks) {
            logger_1.logger.info('Webhook triggered', { partnerId, event, endpoint: webhook.endpoint });
            // In production: Actually send HTTP request to webhook.endpoint
        }
        return { sent: webhooks.length > 0, integration: webhooks[0]?.id };
    },
};
//# sourceMappingURL=partnerships.service.js.map