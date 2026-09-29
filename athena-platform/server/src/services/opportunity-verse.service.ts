/**
 * OpportunityVerse Feed Mixer Service
 * Balances paid content, organic social, and job recommendations
 * Phase 2: Backend Logic & Integrations
 *
 * ## Nothing serves this today, and it no longer makes things up for whoever does next
 *
 * GET /api/feed and GET /api/feed/opportunities, the two routes that served
 * getMixedFeed, answer 410 (see retiredMixedFeed in feed.routes.ts). The member
 * feed is GET /api/posts/feed. The module is kept because the mixer itself, the
 * interleaving of pools under ratios and spacing rules, is sound, but three
 * things in it were not, and each would have reached a member again through
 * the next caller:
 *
 *  - Fit that nobody computed. getRelevantOpportunities took the newest active
 *    jobs and courses and stamped every job `matchScore: 70` ("Would be
 *    calculated by CareerCompass") and every course 60; the mixer then called
 *    anything over 80 a "Great match for you" and every course one that would
 *    "Fill your skill gap", when a course carries no skill data to check that
 *    against. The skill boost read `requiredSkills` and `skillsTaught`, which
 *    are not columns, so it never ran. Opportunities are now ranked by the
 *    skills a job actually lists that she actually has, and the reason says
 *    exactly that or says only that the listing is recent.
 *  - Blocks. The posts came from generateFeed and getTrendingPosts without her
 *    block list, so a woman who had blocked someone could be served his posts
 *    here when every feed the clients read leaves them out.
 *  - Reasons for posts. Every organic post was "Popular in your network" and
 *    every discovery post "Suggested for you", read from fields (authorFollowed,
 *    trendingRank, similarInterests) that no post carries. The feed service
 *    already gives every ranked post its reasons, each tied to a factor the
 *    ranking applied, and those are what is passed on.
 */

import { prisma } from '../utils/prisma';
import { viewerContextFor } from './search.service';

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
  /** Ordering within this response only. Not a fit, and never to be shown as one. */
  score: number;
  reason?: string; // Why this content was included, in words that are true of it
}

/**
 * A job or course offered to the mixer. `skillNames` is what the listing
 * itself says it needs (JobSkill rows, lower-cased); a course has none,
 * because Course carries no skill data.
 */
export interface OpportunityInput {
  id: string;
  type: 'JOB' | 'COURSE';
  skillNames?: string[];
  [key: string]: unknown;
}

export interface MixerInput {
  userId?: string;
  organicPosts: any[];
  discoveryPosts: any[];
  sponsoredContent?: any[];
  opportunities?: OpportunityInput[];
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
    const { userId, organicPosts, discoveryPosts, sponsoredContent = [], opportunities = [], limit } = input;

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
   * Why a post or advert is here.
   *
   * A post ranked by the feed service arrives with `reasons`, each one tied to
   * a factor the ranking applied (reasonsFor in feed.service.ts), so the first
   * of them is used. Anything without one is described only by where it came
   * from, which is always true.
   */
  private getContentReason(item: any, type: ContentType): string {
    if (type === 'sponsored') return 'Sponsored';
    const given = Array.isArray(item?.reasons) ? item.reasons.find((r: unknown) => typeof r === 'string' && r) : null;
    if (given) return given;
    return type === 'discovery' ? 'From across ATHENA' : 'In your feed';
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
   * Order jobs and courses for one member, using only what is written down.
   *
   * A job is ranked by how many of the skills its listing names are on her
   * profile, and says so ("Lists 2 of your skills"). Ties, and every course,
   * keep the order they came in, which is newest first, and are described as
   * recent rather than as a match: Course has no skill columns, so there is
   * nothing to match a course against, and a job that shares none of her
   * skills is not a match either.
   */
  private async personalizeOpportunities(
    opportunities: OpportunityInput[],
    userId?: string
  ): Promise<MixedContent[]> {
    if (opportunities.length === 0) return [];

    let userSkills = new Set<string>();
    if (userId) {
      const rows = await prisma.userSkill.findMany({
        where: { userId },
        select: { skill: { select: { name: true } } },
      });
      userSkills = new Set(rows.map((row) => row.skill.name.trim().toLowerCase()));
    }

    const scored = opportunities.map((opp, index) => {
      const shared =
        opp.type === 'JOB' ? (opp.skillNames ?? []).filter((name) => userSkills.has(name)).length : 0;
      const recency = opportunities.length - index;
      return {
        id: opp.id,
        type: 'opportunity' as ContentType,
        contentType: opp.type,
        data: opp,
        // Shared skills first; within the same count, the newer listing.
        score: shared * opportunities.length + recency,
        reason:
          opp.type === 'COURSE'
            ? 'Recently added course'
            : shared > 0
              ? `Lists ${shared} of your skills`
              : 'Recently posted role',
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

  // Blocking, in both directions and from both stores (the Safety Centre's and
  // the DV safety page's), removed before the ranking rather than after it.
  // getTrendingPosts is one cached list shared by everyone, so it cannot take
  // a viewer's block list and is filtered here instead.
  const viewer = await viewerContextFor(userId);
  const blocked = new Set(viewer.blockedIds);

  // Fetch content from different sources in parallel
  const [organicResult, discoveryResult, trending, opportunities] = await Promise.all([
    generateFeed({ userId, page: 1, limit: limit * 2, algorithm: 'personalized', excludeAuthorIds: viewer.blockedIds }),
    generateFeed({ userId, page: 1, limit: limit * 2, algorithm: 'engagement', excludeAuthorIds: viewer.blockedIds }),
    getTrendingPosts(24, limit),
    getRelevantOpportunities(Math.ceil(limit * 0.2)),
  ]);

  // Mix content. No sponsored pool: ATHENA sells no feed placements, so there
  // is no inventory to draw one from, and the mixer is given none rather than
  // an empty stand-in for an ad server.
  const mixer = new OpportunityVerseMixer();
  return mixer.mix({
    userId,
    organicPosts: organicResult.posts,
    discoveryPosts: [...discoveryResult.posts, ...trending.filter((post) => !blocked.has(post.authorId))],
    opportunities,
    page,
    limit,
  });
}

/**
 * The newest active jobs, with the skills each listing names, and the newest
 * published courses. Nothing here is scored; see personalizeOpportunities.
 */
async function getRelevantOpportunities(limit: number): Promise<OpportunityInput[]> {
  const [jobs, courses] = await Promise.all([
    prisma.job.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: Math.ceil(limit * 0.7),
      include: {
        organization: { select: { name: true, logo: true } },
        skills: { select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: Math.ceil(limit * 0.3),
      include: {
        organization: { select: { name: true } },
      },
    }),
  ]);

  return [
    ...jobs.map(({ skills, ...job }) => ({
      ...job,
      type: 'JOB' as const,
      skillNames: skills.map((row) => row.skill.name.trim().toLowerCase()),
    })),
    ...courses.map((course) => ({ ...course, type: 'COURSE' as const })),
  ];
}

export const opportunityVerseMixer = {
  OpportunityVerseMixer,
  getMixedFeed,
};
