/**
 * OpportunityVerse Feed Mixer Service
 * Balances paid content, organic social, and job recommendations
 * Phase 2: Backend Logic & Integrations
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { cacheGetOrSet, CacheKeys } from '../utils/cache';

// ==========================================
// MIXER CONFIGURATION
// ==========================================

interface MixerConfig {
  // Content distribution ratios
  organicRatio: number;        // Organic posts from network
  discoveryRatio: number;      // Discovery/trending content
  sponsoredRatio: number;      // Paid/sponsored content
  opportunityRatio: number;    // Jobs & learning opportunities
  
  // Frequency controls
  maxConsecutiveSponsored: number;
  minPostsBetweenSponsored: number;
  maxSponsoredPerSession: number;
  
  // Position rules
  sponsoredStartPosition: number;  // First sponsored can appear after N posts
  opportunityInsertEvery: number;  // Insert opportunity every N posts
}

const DEFAULT_CONFIG: MixerConfig = {
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
// TYPES
// ==========================================

export type ContentType = 'organic' | 'discovery' | 'sponsored' | 'opportunity';

export interface MixedContent {
  id: string;
  type: ContentType;
  contentType: 'POST' | 'JOB' | 'COURSE' | 'EVENT' | 'AD';
  data: any;
  score: number;
  reason?: string; // Why this content was included
}

export interface MixerInput {
  userId?: string;
  organicPosts: any[];
  discoveryPosts: any[];
  sponsoredContent?: any[];
  opportunities?: any[];
  page: number;
  limit: number;
}

export interface MixerOutput {
  items: MixedContent[];
  hasMore: boolean;
  meta: {
    organicCount: number;
    discoveryCount: number;
    sponsoredCount: number;
    opportunityCount: number;
  };
}

// ==========================================
// MIXER IMPLEMENTATION
// ==========================================

export class OpportunityVerseMixer {
  private config: MixerConfig;
  
  constructor(config?: Partial<MixerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Mix content from multiple sources into a unified feed
   */
  async mix(input: MixerInput): Promise<MixerOutput> {
    const { userId, organicPosts, discoveryPosts, sponsoredContent = [], opportunities = [], page, limit } = input;
    
    const result: MixedContent[] = [];
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
      sponsored: Math.min(
        Math.floor(targetTotal * this.config.sponsoredRatio),
        this.config.maxSponsoredPerSession
      ),
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
      if (
        sponsoredPool.length > 0 &&
        sponsoredCount < targets.sponsored &&
        position >= this.config.sponsoredStartPosition &&
        position - lastSponsoredPosition >= this.config.minPostsBetweenSponsored
      ) {
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
      if (
        opportunityPool.length > 0 &&
        meta.opportunityCount < targets.opportunity &&
        position % this.config.opportunityInsertEvery === 0
      ) {
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
        if (fallback.type === 'organic') meta.organicCount++;
        else if (fallback.type === 'discovery') meta.discoveryCount++;
        else meta.opportunityCount++;
        result.push(fallback);
      } else {
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
  private normalizePool(items: any[], type: ContentType): MixedContent[] {
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
  private getContentReason(item: any, type: ContentType): string {
    switch (type) {
      case 'organic':
        if (item.authorFollowed) return 'From someone you follow';
        return 'Popular in your network';
      case 'discovery':
        if (item.trendingRank) return 'Trending now';
        if (item.similarInterests) return 'Based on your interests';
        return 'Suggested for you';
      case 'sponsored':
        return 'Sponsored';
      case 'opportunity':
        if (item.contentType === 'JOB') return 'Job opportunity';
        if (item.contentType === 'COURSE') return 'Recommended learning';
        return 'Opportunity for you';
      default:
        return '';
    }
  }
  
  /**
   * Filter and score sponsored content for relevance
   */
  private async filterRelevantSponsored(
    sponsored: any[],
    userId?: string
  ): Promise<MixedContent[]> {
    if (!userId || sponsored.length === 0) {
      return this.normalizePool(sponsored, 'sponsored');
    }
    
    // Get user context for targeting
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: true } },
      },
    });
    
    // Score sponsored content based on relevance
    const scored = sponsored.map((ad) => {
      let relevanceScore = ad.baseScore || 100;
      
      // Boost if targeting matches user's persona
      if (ad.targetPersonas?.includes(user?.persona)) {
        relevanceScore *= 1.5;
      }
      
      // Boost if targeting matches location (use city or country from User)
      const userLocation = user?.city || user?.country;
      if (userLocation && ad.targetLocations?.includes(userLocation)) {
        relevanceScore *= 1.3;
      }
      
      // Boost if targeting matches interests (using skills as proxy)
      const userInterests = user?.skills?.map((s: any) => s.skill?.name?.toLowerCase()) || [];
      const adInterests = (ad.targetInterests || []).map((i: string) => i.toLowerCase());
      const interestOverlap = userInterests.filter((i: string) => adInterests.includes(i)).length;
      if (interestOverlap > 0) {
        relevanceScore *= 1 + (interestOverlap * 0.1);
      }
      
      return {
        id: ad.id,
        type: 'sponsored' as ContentType,
        contentType: 'AD' as const,
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
  private async personalizeOpportunities(
    opportunities: any[],
    userId?: string
  ): Promise<MixedContent[]> {
    if (!userId || opportunities.length === 0) {
      return opportunities.map((opp) => ({
        id: opp.id,
        type: 'opportunity' as ContentType,
        contentType: opp.type || 'JOB',
        data: opp,
        score: opp.matchScore || 100,
        reason: opp.type === 'COURSE' ? 'Recommended learning' : 'Job opportunity',
      }));
    }
    
    // Get user context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: true } },
        experience: true,
      },
    });
    
    const userSkills = user?.skills?.map((s: any) => s.skill?.name?.toLowerCase()) || [];
    
    // Score opportunities
    const scored = opportunities.map((opp) => {
      let score = opp.matchScore || 50;
      
      // For jobs, boost based on skill match
      if (opp.type === 'JOB' && opp.requiredSkills) {
        const reqSkills = opp.requiredSkills.map((s: string) => s.toLowerCase());
        const matchCount = reqSkills.filter((s: string) => userSkills.includes(s)).length;
        score += matchCount * 20;
      }
      
      // For courses, boost if fills skill gap
      if (opp.type === 'COURSE' && opp.skillsTaught) {
        const teaches = opp.skillsTaught.map((s: string) => s.toLowerCase());
        const newSkills = teaches.filter((s: string) => !userSkills.includes(s)).length;
        score += newSkills * 15;
      }
      
      return {
        id: opp.id,
        type: 'opportunity' as ContentType,
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

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get mixed feed for a user
 */
export async function getMixedFeed(
  userId: string,
  page: number,
  limit: number
): Promise<MixerOutput> {
  // Import feed functions (avoid circular dependency)
  const { generateFeed, getTrendingPosts } = await import('./feed.service');
  
  // Fetch content from different sources in parallel
  const [organicResult, discoveryResult, trending] = await Promise.all([
    generateFeed({ userId, page: 1, limit: limit * 2, algorithm: 'personalized' }),
    generateFeed({ userId, page: 1, limit: limit * 2, algorithm: 'engagement' }),
    getTrendingPosts(24, limit),
  ]);
  
  // Fetch opportunities
  const opportunities = await getRelevantOpportunities(userId, Math.ceil(limit * 0.2));
  
  // Fetch sponsored content (if user is on free tier)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  
  let sponsoredContent: any[] = [];
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
async function getRelevantOpportunities(userId: string, limit: number): Promise<any[]> {
  const opportunities: any[] = [];
  
  // Get matching jobs
  const jobs = await prisma.job.findMany({
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
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: Math.ceil(limit * 0.3),
    include: {
      organization: { select: { name: true } },
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
async function getActiveSponsored(limit: number): Promise<any[]> {
  // In production, this would query an ad server or sponsorship table
  // For now, return empty (no ads)
  return [];
}

export const opportunityVerseMixer = {
  OpportunityVerseMixer,
  getMixedFeed,
};
