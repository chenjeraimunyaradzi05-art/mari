"use strict";
/**
 * Enterprise Organization Service
 * Handles enterprise org flows, team management, employer branding, and ATS integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enterpriseOrgService = exports.ATS_PROVIDERS = void 0;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
// ATS Providers supported
exports.ATS_PROVIDERS = [
    { id: 'workday', name: 'Workday', type: 'enterprise' },
    { id: 'greenhouse', name: 'Greenhouse', type: 'all' },
    { id: 'lever', name: 'Lever', type: 'all' },
    { id: 'bamboohr', name: 'BambooHR', type: 'sme' },
    { id: 'jobadder', name: 'JobAdder', type: 'all' },
    { id: 'smartrecruiters', name: 'SmartRecruiters', type: 'enterprise' },
    { id: 'icims', name: 'iCIMS', type: 'enterprise' },
    { id: 'successfactors', name: 'SAP SuccessFactors', type: 'enterprise' },
];
// Enterprise plan features
const PLAN_FEATURES = {
    basic: {
        unlimitedJobPosts: false,
        featuredListings: 1,
        candidateSearch: false,
        atsIntegration: false,
        customBranding: false,
        analyticsAdvanced: false,
        apiAccess: false,
        dedicatedSupport: false,
        ssoEnabled: false,
        customReports: false,
    },
    professional: {
        unlimitedJobPosts: true,
        featuredListings: 5,
        candidateSearch: true,
        atsIntegration: true,
        customBranding: true,
        analyticsAdvanced: true,
        apiAccess: false,
        dedicatedSupport: false,
        ssoEnabled: false,
        customReports: false,
    },
    enterprise: {
        unlimitedJobPosts: true,
        featuredListings: -1, // Unlimited
        candidateSearch: true,
        atsIntegration: true,
        customBranding: true,
        analyticsAdvanced: true,
        apiAccess: true,
        dedicatedSupport: true,
        ssoEnabled: true,
        customReports: true,
    },
};
class EnterpriseOrgService {
    /**
     * Create enterprise organization
     */
    async createEnterpriseOrg(userId, data) {
        const slug = this.generateSlug(data.name);
        const org = await prisma_1.prisma.organization.create({
            data: {
                name: data.name,
                slug,
                industry: data.industry,
                size: data.size,
                website: data.website,
                type: data.type,
                country: 'Australia',
            },
        });
        // Add owner as team member
        await prisma_1.prisma.organizationMember.create({
            data: {
                organizationId: org.id,
                userId,
                role: 'OWNER',
                canPostJobs: true,
                canManageTeam: true,
                canViewAnalytics: true,
                acceptedAt: new Date(),
            },
        });
        logger_1.logger.info('Enterprise org created', { orgId: org.id, userId });
        return org;
    }
    /**
     * Generate URL-friendly slug
     */
    generateSlug(name) {
        const base = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${base}-${(0, uuid_1.v4)().slice(0, 6)}`;
    }
    /**
     * Upgrade organization plan
     */
    async upgradePlan(orgId, plan) {
        const features = PLAN_FEATURES[plan];
        // In production: Create Stripe subscription, update org record
        logger_1.logger.info('Org plan upgraded', { orgId, plan });
        return { success: true, features };
    }
    /**
     * Get organization with full enterprise data
     */
    async getEnterpriseOrg(orgId) {
        const org = await prisma_1.prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, displayName: true, email: true, avatar: true } },
                    },
                },
                jobs: {
                    where: { status: 'ACTIVE' },
                    take: 10,
                },
                _count: {
                    select: { jobs: true, members: true },
                },
            },
        });
        if (!org)
            return null;
        return {
            ...org,
            analytics: await this.getOrgAnalytics(orgId),
            features: PLAN_FEATURES['basic'], // Would come from subscription
        };
    }
    /**
     * Invite team member
     */
    async inviteTeamMember(orgId, inviterId, data) {
        // Check if user exists
        let user = await prisma_1.prisma.user.findUnique({
            where: { email: data.email },
        });
        // Create placeholder if not exists
        if (!user) {
            // Would send invite email to create account
            logger_1.logger.info('Invite sent to new user', { email: data.email, orgId });
        }
        const inviteId = (0, uuid_1.v4)();
        const inviteLink = `${process.env.CLIENT_URL}/invite/${inviteId}`;
        // Store invite (would use an Invite model)
        logger_1.logger.info('Team member invited', { orgId, inviterId, email: data.email, role: data.role });
        return { inviteId, inviteLink };
    }
    /**
     * Accept team invite
     */
    async acceptInvite(inviteId, userId) {
        // Validate invite, add member to org
        logger_1.logger.info('Invite accepted', { inviteId, userId });
        return { orgId: '' };
    }
    /**
     * Update team member role
     */
    async updateTeamMemberRole(orgId, memberId, role, permissions) {
        await prisma_1.prisma.organizationMember.update({
            where: { id: memberId },
            data: {
                role: role.toUpperCase(),
                canPostJobs: ['owner', 'admin', 'recruiter', 'hiring_manager'].includes(role),
                canManageTeam: ['owner', 'admin'].includes(role),
                canViewAnalytics: ['owner', 'admin', 'hiring_manager'].includes(role),
            },
        });
        logger_1.logger.info('Team member role updated', { orgId, memberId, role });
    }
    /**
     * Remove team member
     */
    async removeTeamMember(orgId, memberId) {
        await prisma_1.prisma.organizationMember.delete({
            where: { id: memberId },
        });
        logger_1.logger.info('Team member removed', { orgId, memberId });
    }
    /**
     * Update organization branding
     */
    async updateBranding(orgId, branding) {
        await prisma_1.prisma.organization.update({
            where: { id: orgId },
            data: {
                logo: branding.logo,
                banner: branding.coverImage, // coverImage maps to banner field
                description: branding.cultureStatement,
                brandColor: branding.brandColor,
                // Additional branding fields would be stored in JSON or separate table
            },
        });
        logger_1.logger.info('Org branding updated', { orgId });
    }
    /**
     * Connect ATS integration
     */
    async connectATS(orgId, provider, credentials) {
        const atsProvider = exports.ATS_PROVIDERS.find((p) => p.id === provider);
        if (!atsProvider) {
            throw new Error(`Unknown ATS provider: ${provider}`);
        }
        const integration = {
            id: (0, uuid_1.v4)(),
            type: 'ats',
            provider,
            status: 'pending',
            config: { ...credentials },
        };
        // Validate credentials with provider (async)
        this.validateATSConnection(integration, orgId);
        logger_1.logger.info('ATS integration initiated', { orgId, provider });
        return integration;
    }
    /**
     * Validate ATS connection
     */
    async validateATSConnection(integration, orgId) {
        // In production: Call provider API to validate credentials
        // Update integration status based on result
    }
    /**
     * Sync jobs from ATS
     */
    async syncJobsFromATS(orgId, integrationId) {
        // In production: Fetch jobs from ATS API and create/update in our database
        logger_1.logger.info('ATS job sync initiated', { orgId, integrationId });
        return { synced: 0 };
    }
    /**
     * Push candidate to ATS
     */
    async pushCandidateToATS(orgId, integrationId, applicationId) {
        // In production: Push candidate data to ATS
        logger_1.logger.info('Candidate pushed to ATS', { orgId, applicationId });
        return { externalId: (0, uuid_1.v4)() };
    }
    /**
     * Get organization analytics
     */
    async getOrgAnalytics(orgId) {
        const [jobStats, applicationStats] = await Promise.all([
            prisma_1.prisma.job.aggregate({
                where: { organizationId: orgId },
                _sum: { viewCount: true, applicationCount: true },
            }),
            prisma_1.prisma.jobApplication.count({
                where: { job: { organizationId: orgId } },
            }),
        ]);
        return {
            totalViews: jobStats._sum.viewCount || 0,
            totalApplications: applicationStats,
            avgTimeToHire: 21, // Would calculate from actual data
            applicationConversion: jobStats._sum.viewCount
                ? (applicationStats / jobStats._sum.viewCount) * 100
                : 0,
            topSources: [
                { source: 'ATHENA Direct', count: Math.floor(applicationStats * 0.6) },
                { source: 'LinkedIn', count: Math.floor(applicationStats * 0.25) },
                { source: 'Referral', count: Math.floor(applicationStats * 0.15) },
            ],
        };
    }
    /**
     * Get diversity analytics
     */
    async getDiversityAnalytics(orgId) {
        // In production: Aggregate anonymized candidate data
        return {
            genderBreakdown: { female: 58, male: 38, other: 4 },
            experienceLevels: { entry: 25, mid: 45, senior: 30 },
            locations: { Sydney: 40, Melbourne: 30, Brisbane: 15, Remote: 15 },
        };
    }
    /**
     * Generate employer branding report
     */
    async generateBrandingReport(orgId) {
        const org = await this.getEnterpriseOrg(orgId);
        const analytics = await this.getOrgAnalytics(orgId);
        return {
            organization: org?.name,
            period: 'Last 30 days',
            metrics: {
                profileViews: analytics.totalViews,
                jobViews: analytics.totalViews,
                applications: analytics.totalApplications,
                conversionRate: analytics.applicationConversion.toFixed(2) + '%',
            },
            recommendations: [
                'Add a company culture video to increase engagement',
                'Highlight employee testimonials',
                'Update job descriptions with more details about perks',
            ],
        };
    }
    /**
     * Search candidates (enterprise feature)
     */
    async searchCandidates(orgId, filters) {
        // Check if org has candidate search enabled
        // Search users who have opted in to be discovered
        const where = {
            isOpenToWork: true,
            hideFromSearch: false,
        };
        if (filters.location) {
            where.city = { contains: filters.location, mode: 'insensitive' };
        }
        const candidates = await prisma_1.prisma.user.findMany({
            where,
            select: {
                id: true,
                displayName: true,
                headline: true,
                avatar: true,
                city: true,
                state: true,
                skills: { include: { skill: true }, take: 10 },
            },
            take: 50,
        });
        return candidates;
    }
    /**
     * Create job posting with enterprise features
     */
    async createEnterpriseJob(orgId, userId, jobData) {
        const job = await prisma_1.prisma.job.create({
            data: {
                ...jobData,
                organizationId: orgId,
                postedById: userId,
                slug: `${jobData.title.toLowerCase().replace(/\s+/g, '-')}-${(0, uuid_1.v4)().slice(0, 6)}`,
                status: 'ACTIVE',
                publishedAt: new Date(),
            },
        });
        logger_1.logger.info('Enterprise job created', { orgId, jobId: job.id });
        return job;
    }
    /**
     * Get SSO configuration
     */
    async getSSOConfig(orgId) {
        // Return SAML/OIDC configuration for enterprise SSO
        return {
            enabled: false,
            provider: null,
            entityId: null,
            ssoUrl: null,
        };
    }
    /**
     * Configure SSO
     */
    async configureSS(orgId, config) {
        // Store SSO configuration
        logger_1.logger.info('SSO configured', { orgId, provider: config.provider });
    }
}
exports.enterpriseOrgService = new EnterpriseOrgService();
//# sourceMappingURL=enterprise-org.service.js.map