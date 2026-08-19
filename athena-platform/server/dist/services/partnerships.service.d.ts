/**
 * Partnerships Service
 * Manage partnerships, integrations, and white-label configurations
 */
export interface Partner {
    id: string;
    name: string;
    type: PartnerType;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'enterprise';
    status: 'pending' | 'active' | 'suspended' | 'terminated';
    contactInfo: {
        primaryContact: string;
        email: string;
        phone?: string;
    };
    branding?: {
        logo: string;
        primaryColor: string;
        secondaryColor: string;
        customDomain?: string;
    };
    configuration: PartnerConfiguration;
    revenueShare: {
        percentage: number;
        paymentMethod: string;
        minimumPayout: number;
    };
    metrics: PartnerMetrics;
    createdAt: Date;
    activatedAt?: Date;
}
export type PartnerType = 'university' | 'employer' | 'government' | 'ngo' | 'training_provider' | 'recruitment_agency' | 'technology' | 'reseller';
export interface PartnerConfiguration {
    features: {
        jobPosting: boolean;
        candidateSearch: boolean;
        analyticsAccess: boolean;
        apiAccess: boolean;
        whiteLabel: boolean;
        customBranding: boolean;
        ssoIntegration: boolean;
        bulkOperations: boolean;
    };
    limits: {
        maxUsers: number;
        maxJobPostings: number;
        maxApiCalls: number;
        storageGb: number;
    };
    customizations: {
        hiddenFeatures: string[];
        additionalFields: Record<string, unknown>[];
        customWorkflows: Record<string, unknown>[];
    };
}
export interface PartnerMetrics {
    totalUsers: number;
    activeUsers: number;
    jobsPosted: number;
    applicationsProcessed: number;
    revenue: number;
    lastActivityAt?: Date;
}
export interface PartnerIntegration {
    id: string;
    partnerId: string;
    type: 'webhook' | 'api' | 'sso' | 'data_sync';
    name: string;
    endpoint: string;
    credentials?: Record<string, string>;
    events: string[];
    status: 'active' | 'inactive' | 'error';
    lastSyncAt?: Date;
    errorCount: number;
}
export interface WhiteLabelConfig {
    partnerId: string;
    domain: string;
    branding: {
        appName: string;
        logo: string;
        favicon: string;
        primaryColor: string;
        secondaryColor: string;
        footerText: string;
    };
    features: {
        showAthenaLogo: boolean;
        customOnboarding: boolean;
        customEmailTemplates: boolean;
        customTerms: boolean;
    };
    seo: {
        title: string;
        description: string;
        keywords: string[];
    };
}
export declare const PARTNER_TIERS: {
    bronze: {
        features: {
            jobPosting: boolean;
            candidateSearch: boolean;
            analyticsAccess: boolean;
            apiAccess: boolean;
            whiteLabel: boolean;
            customBranding: boolean;
            ssoIntegration: boolean;
            bulkOperations: boolean;
        };
        limits: {
            maxUsers: number;
            maxJobPostings: number;
            maxApiCalls: number;
            storageGb: number;
        };
        revenueShare: number;
    };
    silver: {
        features: {
            jobPosting: boolean;
            candidateSearch: boolean;
            analyticsAccess: boolean;
            apiAccess: boolean;
            whiteLabel: boolean;
            customBranding: boolean;
            ssoIntegration: boolean;
            bulkOperations: boolean;
        };
        limits: {
            maxUsers: number;
            maxJobPostings: number;
            maxApiCalls: number;
            storageGb: number;
        };
        revenueShare: number;
    };
    gold: {
        features: {
            jobPosting: boolean;
            candidateSearch: boolean;
            analyticsAccess: boolean;
            apiAccess: boolean;
            whiteLabel: boolean;
            customBranding: boolean;
            ssoIntegration: boolean;
            bulkOperations: boolean;
        };
        limits: {
            maxUsers: number;
            maxJobPostings: number;
            maxApiCalls: number;
            storageGb: number;
        };
        revenueShare: number;
    };
    platinum: {
        features: {
            jobPosting: boolean;
            candidateSearch: boolean;
            analyticsAccess: boolean;
            apiAccess: boolean;
            whiteLabel: boolean;
            customBranding: boolean;
            ssoIntegration: boolean;
            bulkOperations: boolean;
        };
        limits: {
            maxUsers: number;
            maxJobPostings: number;
            maxApiCalls: number;
            storageGb: number;
        };
        revenueShare: number;
    };
    enterprise: {
        features: {
            jobPosting: boolean;
            candidateSearch: boolean;
            analyticsAccess: boolean;
            apiAccess: boolean;
            whiteLabel: boolean;
            customBranding: boolean;
            ssoIntegration: boolean;
            bulkOperations: boolean;
        };
        limits: {
            maxUsers: number;
            maxJobPostings: number;
            maxApiCalls: number;
            storageGb: number;
        };
        revenueShare: number;
    };
};
export declare const partnershipsService: {
    /**
     * Create a new partner
     */
    createPartner(data: {
        name: string;
        type: PartnerType;
        tier: Partner["tier"];
        contactInfo: Partner["contactInfo"];
    }): Promise<Partner>;
    /**
     * Activate a partner
     */
    activatePartner(partnerId: string): Promise<Partner>;
    /**
     * Upgrade partner tier
     */
    upgradeTier(partnerId: string, newTier: Partner["tier"]): Promise<Partner>;
    /**
     * Setup white-label configuration
     */
    setupWhiteLabel(partnerId: string, config: Omit<WhiteLabelConfig, "partnerId">): Promise<WhiteLabelConfig>;
    /**
     * Get white-label config by domain
     */
    getWhiteLabelByDomain(domain: string): WhiteLabelConfig | undefined;
    /**
     * Add integration
     */
    addIntegration(partnerId: string, data: {
        type: PartnerIntegration["type"];
        name: string;
        endpoint: string;
        events: string[];
        credentials?: Record<string, string>;
    }): Promise<PartnerIntegration>;
    /**
     * Get partner analytics
     */
    getPartnerAnalytics(partnerId: string, dateRange: {
        start: Date;
        end: Date;
    }): Promise<{
        summary: PartnerMetrics;
        trends: {
            date: string;
            users: number;
            jobs: number;
            applications: number;
        }[];
        topPerformers: {
            metric: string;
            value: number;
        }[];
    }>;
    /**
     * Calculate revenue share
     */
    calculateRevenueShare(partnerId: string, grossRevenue: number): {
        partnerShare: number;
        platformShare: number;
        details: Record<string, number>;
    };
    /**
     * Get all partners
     */
    getAllPartners(filters?: {
        type?: PartnerType;
        tier?: Partner["tier"];
        status?: Partner["status"];
    }): Promise<Partner[]>;
    /**
     * Get partner by ID
     */
    getPartner(partnerId: string): Partner | undefined;
    /**
     * Trigger webhook for event
     */
    triggerWebhook(partnerId: string, event: string, payload: unknown): Promise<{
        sent: boolean;
        integration?: string;
    }>;
};
//# sourceMappingURL=partnerships.service.d.ts.map