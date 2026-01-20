"use strict";
/**
 * OpportunityVerse Feed Mixer Service
 * Balances paid content, organic social, and job recommendations
 * Phase 2: Backend Logic & Integrations
 */
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
exports.opportunityVerseMixer = exports.OpportunityVerseMixer = void 0;
exports.getMixedFeed = getMixedFeed;
const prisma_1 = require("../utils/prisma");
const DEFAULT_CONFIG = {
    organicRatio: 0.45,
    discoveryRatio: 0.30,
    sponsoredRatio: 0.10,
    opportunityRatio: 0.15,
    maxConsecutiveSponsored: 1,
    minPostsBetweenSponsored: 4,
    maxSponsoredPerSession: 10,
    sponsoredStartPosition: 3,
    opportunityInsertEvery: 6,
};
// ==========================================
// MIXER IMPLEMENTATION
// ==========================================
class OpportunityVerseMixer {
    config;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Mix content from multiple sources into a unified feed
     */
    async mix(input) {
        const { userId, organicPosts, discoveryPosts, sponsoredContent = [], opportunities = [], page, limit } = input;
        const result = [];
        const meta = { organicCount: 0, discoveryCount: 0, sponsoredCount: 0, opportunityCount: 0 };
        // Create content pools with normalized scores
        const organicPool = this.normalizePool(organicPosts, 'organic');
        const discoveryPool = this.normalizePool(discoveryPosts, 'discovery');
        const sponsoredPool = await this.filterRelevantSponsored(sponsoredContent, userId);
        const opportunityPool = await this.personalizeOpportunities(opportunities, userId);
        // Calculate target counts based on ratios
        const targetTotal = limit;
        const targets = {
            organic: Math.floor(targetTotal * this.config.organicRatio),
            discovery: Math.floor(targetTotal * this.config.discoveryRatio),
            sponsored: Math.min(Math.floor(targetTotal * this.config.sponsoredRatio), this.config.maxSponsoredPerSession),
            opportunity: Math.floor(targetTotal * this.config.opportunityRatio),
        };
        // Track positions
        let position = 0;
        let lastSponsoredPosition = -999;
        let sponsoredCount = 0;
        // Interleave content based on rules
        while (result.length < targetTotal) {
            position++;
            // Check if we should insert sponsored content
            if (sponsoredPool.length > 0 &&
                sponsoredCount < targets.sponsored &&
                position >= this.config.sponsoredStartPosition &&
                position - lastSponsoredPosition >= this.config.minPostsBetweenSponsored) {
                const sponsored = sponsoredPool.shift();
                if (sponsored) {
                    result.push(sponsored);
                    meta.sponsoredCount++;
                    sponsoredCount++;
                    lastSponsoredPosition = position;
                    continue;
                }
            }
            // Check if we should insert an opportunity
            if (opportunityPool.length > 0 &&
                meta.opportunityCount < targets.opportunity &&
                position % this.config.opportunityInsertEvery === 0) {
                const opportunity = opportunityPool.shift();
                if (opportunity) {
                    result.push(opportunity);
                    meta.opportunityCount++;
                    continue;
                }
            }
            // Fill with organic or discovery content
            // Prefer organic if we have more quota remaining
            const organicRemaining = targets.organic - meta.organicCount;
            const discoveryRemaining = targets.discovery - meta.discoveryCount;
            if (organicPool.length > 0 && (organicRemaining >= discoveryRemaining || discoveryPool.length === 0)) {
                const organic = organicPool.shift();
                if (organic) {
                    result.push(organic);
                    meta.organicCount++;
                    continue;
                }
            }
            if (discoveryPool.length > 0) {
                const discovery = discoveryPool.shift();
                if (discovery) {
                    result.push(discovery);
                    meta.discoveryCount++;
                    continue;
                }
            }
            // Fallback to any remaining content
            const fallback = organicPool.shift() || discoveryPool.shift() || opportunityPool.shift();
            if (fallback) {
                if (fallback.type === 'organic')
                    meta.organicCount++;
                else if (fallback.type === 'discovery')
                    meta.discoveryCount++;
                else
                    meta.opportunityCount++;
                result.push(fallback);
            }
            else {
                break; // No more content
            }
        }
        return {
            items: result,
            hasMore: organicPool.length > 0 || discoveryPool.length > 0,
            meta,
        };
    }
    /**
     * Normalize a content pool with consistent scoring
     */
    normalizePool(items, type) {
        return items.map((item, index) => ({
            id: item.id,
            type,
            contentType: item.type || 'POST',
            data: item,
            score: item.decayedScore || item.score || (1000 - index), // Preserve original ranking
            reason: this.getContentReason(item, type),
        }));
    }
    /**
     * Get a human-readable reason for why content was included
     */
    getContentReason(item, type) {
        switch (type) {
            case 'organic':
                if (item.authorFollowed)
                    return 'From someone you follow';
                return 'Popular in your network';
            case 'discovery':
                if (item.trendingRank)
                    return 'Trending now';
                if (item.similarInterests)
                    return 'Based on your interests';
                return 'Suggested for you';
            case 'sponsored':
                return 'Sponsored';
            case 'opportunity':
                if (item.contentType === 'JOB')
                    return 'Job opportunity';
                if (item.contentType === 'COURSE')
                    return 'Recommended learning';
                return 'Opportunity for you';
            default:
                return '';
        }
    }
    /**
     * Filter and score sponsored content for relevance
     */
    async filterRelevantSponsored(sponsored, userId) {
        if (!userId || sponsored.length === 0) {
            return this.normalizePool(sponsored, 'sponsored');
        }
        // Get user context for targeting
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                persona: true,
                currentJobTitle: true,
                interests: true,
                profile: { select: { location: true } },
            },
        });
        // Score sponsored content based on relevance
        const scored = sponsored.map((ad) => {
            let relevanceScore = ad.baseScore || 100;
            // Boost if targeting matches user's persona
            if (ad.targetPersonas?.includes(user?.persona)) {
                relevanceScore *= 1.5;
            }
            // Boost if targeting matches location
            if (ad.targetLocations?.includes(user?.profile?.location)) {
                relevanceScore *= 1.3;
            }
            // Boost if targeting matches interests
            const userInterests = user?.interests || [];
            const adInterests = ad.targetInterests || [];
            const interestOverlap = userInterests.filter((i) => adInterests.includes(i)).length;
            if (interestOverlap > 0) {
                relevanceScore *= 1 + (interestOverlap * 0.1);
            }
            return {
                id: ad.id,
                type: 'sponsored',
                contentType: 'AD',
                data: ad,
                score: relevanceScore,
                reason: 'Sponsored',
            };
        });
        // Sort by relevance and return
        return scored.sort((a, b) => b.score - a.score);
    }
    /**
     * Personalize opportunities (jobs, courses) for user
     */
    async personalizeOpportunities(opportunities, userId) {
        if (!userId || opportunities.length === 0) {
            return opportunities.map((opp) => ({
                id: opp.id,
                type: 'opportunity',
                contentType: opp.type || 'JOB',
                data: opp,
                score: opp.matchScore || 100,
                reason: opp.type === 'COURSE' ? 'Recommended learning' : 'Job opportunity',
            }));
        }
        // Get user context
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                skills: { include: { skill: true } },
                experience: true,
            },
        });
        const userSkills = user?.skills?.map((s) => s.skill?.name?.toLowerCase()) || [];
        // Score opportunities
        const scored = opportunities.map((opp) => {
            let score = opp.matchScore || 50;
            // For jobs, boost based on skill match
            if (opp.type === 'JOB' && opp.requiredSkills) {
                const reqSkills = opp.requiredSkills.map((s) => s.toLowerCase());
                const matchCount = reqSkills.filter((s) => userSkills.includes(s)).length;
                score += matchCount * 20;
            }
            // For courses, boost if fills skill gap
            if (opp.type === 'COURSE' && opp.skillsTaught) {
                const teaches = opp.skillsTaught.map((s) => s.toLowerCase());
                const newSkills = teaches.filter((s) => !userSkills.includes(s)).length;
                score += newSkills * 15;
            }
            return {
                id: opp.id,
                type: 'opportunity',
                contentType: opp.type || 'JOB',
                data: opp,
                score,
                reason: opp.type === 'COURSE' ? 'Fill your skill gap' :
                    opp.matchScore > 80 ? 'Great match for you' : 'Job opportunity',
            };
        });
        return scored.sort((a, b) => b.score - a.score);
    }
}
exports.OpportunityVerseMixer = OpportunityVerseMixer;
// ==========================================
// HELPER FUNCTIONS
// ==========================================
/**
 * Get mixed feed for a user
 */
async function getMixedFeed(userId, page, limit) {
    // Import feed functions (avoid circular dependency)
    const { generateFeed, getTrendingPosts } = await Promise.resolve().then(() => __importStar(require('./feed.service')));
    // Fetch content from different sources in parallel
    const [organicResult, discoveryResult, trending] = await Promise.all([
        generateFeed({ userId, page: 1, limit: limit * 2, algorithm: 'personalized' }),
        generateFeed({ userId, page: 1, limit: limit * 2, algorithm: 'engagement' }),
        getTrendingPosts(24, limit),
    ]);
    // Fetch opportunities
    const opportunities = await getRelevantOpportunities(userId, Math.ceil(limit * 0.2));
    // Fetch sponsored content (if user is on free tier)
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
    });
    let sponsoredContent = [];
    if (!user?.subscription || user.subscription.tier === 'FREE') {
        sponsoredContent = await getActiveSponsored(limit * 0.1);
    }
    // Mix content
    const mixer = new OpportunityVerseMixer();
    return mixer.mix({
        userId,
        organicPosts: organicResult.posts,
        discoveryPosts: [...discoveryResult.posts, ...trending],
        sponsoredContent,
        opportunities,
        page,
        limit,
    });
}
/**
 * Get relevant opportunities for a user
 */
async function getRelevantOpportunities(userId, limit) {
    const opportunities = [];
    // Get matching jobs
    const jobs = await prisma_1.prisma.job.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit * 0.7),
        include: {
            organization: { select: { name: true, logo: true } },
        },
    });
    opportunities.push(...jobs.map((j) => ({
        ...j,
        type: 'JOB',
        matchScore: 70, // Would be calculated by CareerCompass
    })));
    // Get recommended courses
    const courses = await prisma_1.prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { enrollmentCount: 'desc' },
        take: Math.ceil(limit * 0.3),
        include: {
            instructor: { select: { displayName: true, avatar: true } },
        },
    });
    opportunities.push(...courses.map((c) => ({
        ...c,
        type: 'COURSE',
        matchScore: 60,
    })));
    return opportunities;
}
/**
 * Get active sponsored content
 */
async function getActiveSponsored(limit) {
    // In production, this would query an ad server or sponsorship table
    // For now, return empty (no ads)
    return [];
}
exports.opportunityVerseMixer = {
    OpportunityVerseMixer,
    getMixedFeed,
};
//# sourceMappingURL=opportunity-verse.service.js.map