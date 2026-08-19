/**
 * Enterprise Organization Service
 * Handles enterprise org flows, team management, employer branding, and ATS integrations
 */
export interface EnterpriseOrg {
    id: string;
    name: string;
    slug: string;
    type: 'enterprise' | 'sme' | 'startup' | 'nonprofit' | 'government';
    industry: string;
    size: string;
    plan: 'basic' | 'professional' | 'enterprise';
    features: EnterpriseFeatures;
    branding: OrgBranding;
    integrations: Integration[];
    teamMembers: TeamMember[];
    analytics: OrgAnalytics;
}
export interface EnterpriseFeatures {
    unlimitedJobPosts: boolean;
    featuredListings: number;
    candidateSearch: boolean;
    atsIntegration: boolean;
    customBranding: boolean;
    analyticsAdvanced: boolean;
    apiAccess: boolean;
    dedicatedSupport: boolean;
    ssoEnabled: boolean;
    customReports: boolean;
}
export interface OrgBranding {
    logo?: string;
    coverImage?: string;
    bannerVideo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    brandColor?: string;
    tagline?: string;
    cultureStatement?: string;
    values?: string[];
    perks?: string[];
    socialLinks?: Record<string, string>;
}
export interface TeamMember {
    id: string;
    userId: string;
    role: 'owner' | 'admin' | 'recruiter' | 'hiring_manager' | 'viewer';
    permissions: string[];
    invitedAt: Date;
    acceptedAt?: Date;
    lastActive?: Date;
}
export interface Integration {
    id: string;
    type: 'ats' | 'hris' | 'calendar' | 'email' | 'slack' | 'teams';
    provider: string;
    status: 'active' | 'pending' | 'error' | 'disconnected';
    config: Record<string, any>;
    lastSync?: Date;
}
export interface OrgAnalytics {
    totalViews: number;
    totalApplications: number;
    avgTimeToHire: number;
    applicationConversion: number;
    topSources: Array<{
        source: string;
        count: number;
    }>;
    diversityMetrics?: DiversityMetrics;
}
export interface DiversityMetrics {
    genderBreakdown: Record<string, number>;
    experienceLevels: Record<string, number>;
    locations: Record<string, number>;
}
export declare const ATS_PROVIDERS: {
    id: string;
    name: string;
    type: string;
}[];
declare class EnterpriseOrgService {
    /**
     * Create enterprise organization
     */
    createEnterpriseOrg(userId: string, data: {
        name: string;
        industry: string;
        size: string;
        type?: EnterpriseOrg['type'];
        website?: string;
    }): Promise<any>;
    /**
     * Generate URL-friendly slug
     */
    private generateSlug;
    /**
     * Upgrade organization plan
     */
    upgradePlan(orgId: string, plan: 'basic' | 'professional' | 'enterprise'): Promise<{
        success: boolean;
        features: EnterpriseFeatures;
    }>;
    /**
     * Get organization with full enterprise data
     */
    getEnterpriseOrg(orgId: string): Promise<any>;
    /**
     * Invite team member
     */
    inviteTeamMember(orgId: string, inviterId: string, data: {
        email: string;
        role: TeamMember['role'];
        permissions?: string[];
    }): Promise<{
        inviteId: string;
        inviteLink: string;
    }>;
    /**
     * Accept team invite
     */
    acceptInvite(inviteId: string, userId: string): Promise<{
        orgId: string;
    }>;
    /**
     * Update team member role
     */
    updateTeamMemberRole(orgId: string, memberId: string, role: TeamMember['role'], permissions?: string[]): Promise<void>;
    /**
     * Remove team member
     */
    removeTeamMember(orgId: string, memberId: string): Promise<void>;
    /**
     * Update organization branding
     */
    updateBranding(orgId: string, branding: Partial<OrgBranding>): Promise<void>;
    /**
     * Connect ATS integration
     */
    connectATS(orgId: string, provider: string, credentials: Record<string, string>): Promise<Integration>;
    /**
     * Validate ATS connection
     */
    private validateATSConnection;
    /**
     * Sync jobs from ATS
     */
    syncJobsFromATS(orgId: string, integrationId: string): Promise<{
        synced: number;
    }>;
    /**
     * Push candidate to ATS
     */
    pushCandidateToATS(orgId: string, integrationId: string, applicationId: string): Promise<{
        externalId: string;
    }>;
    /**
     * Get organization analytics
     */
    getOrgAnalytics(orgId: string): Promise<OrgAnalytics>;
    /**
     * Get diversity analytics
     */
    getDiversityAnalytics(orgId: string): Promise<DiversityMetrics>;
    /**
     * Generate employer branding report
     */
    generateBrandingReport(orgId: string): Promise<any>;
    /**
     * Search candidates (enterprise feature)
     */
    searchCandidates(orgId: string, filters: {
        skills?: string[];
        experience?: {
            min: number;
            max: number;
        };
        location?: string;
        availability?: string;
    }): Promise<any[]>;
    /**
     * Create job posting with enterprise features
     */
    createEnterpriseJob(orgId: string, userId: string, jobData: any): Promise<any>;
    /**
     * Get SSO configuration
     */
    getSSOConfig(orgId: string): Promise<any>;
    /**
     * Configure SSO
     */
    configureSS(orgId: string, config: {
        provider: 'okta' | 'azure' | 'google' | 'custom';
        entityId: string;
        ssoUrl: string;
        certificate: string;
    }): Promise<void>;
}
export declare const enterpriseOrgService: EnterpriseOrgService;
export {};
//# sourceMappingURL=enterprise-org.service.d.ts.map