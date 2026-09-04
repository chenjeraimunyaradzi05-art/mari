/**
 * Feed Algorithm Service
 * Video-first, engagement-optimized feed ranking
 */

import { prisma } from '../utils/prisma';
import { REPOST_OF_INCLUDE } from './post-decoration.service';
import { authorAudienceWhere, followingIdsOf } from './audience.service';
import { mutedWordMatcher } from '../utils/muted-words';
import { cacheGetOrSet, CacheKeys } from '../utils/cache';
import { logger } from '../utils/logger';

// ==========================================
// TYPES
// ==========================================

export interface FeedPost {
  id: string;
  authorId: string;
  type: string;
  content: string;
  mediaUrls: any;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: Date;
  author: {
    id: string;
    displayName: string;
    avatar: string | null;
    headline: string | null;
    // Whether the viewer already follows this author. The feed's Follow
    // button rendered "Follow" for everyone without it, and pressing it on
    // someone already followed was answered with "Already following".
    isFollowing?: boolean;
  };
  isLiked?: boolean;
  engagementScore: number;
  decayedScore: number;
  // A poll's options and close time, decorated with votes by the route.
  poll?: unknown;
  isPinned?: boolean;
  // Blurred until the reader chooses to see it.
  isSensitive?: boolean;
  // The original a repost or quote points at (null once decorated if it is gone).
  repostOf?: { id: string; [key: string]: unknown } | null;
  repostCount?: number;
  // Why this post is in front of the viewer, in plain words. Every ranked
  // post has at least one; the client shows them behind "Why this?". The
  // chronological video feed carries none: it is not ranked.
  reasons?: string[];
}

export interface FeedOptions {
  userId?: string;
  page?: number;
  limit?: number;
  type?: 'all' | 'video' | 'image' | 'text' | 'poll' | 'win';
  algorithm?: 'chronological' | 'engagement' | 'personalized';
}

type ScorePost = any & { engagementScore: number; decayedScore: number; __source?: FeedSource };

type FeedSource = 'network' | 'discovery' | 'trending' | 'recent';

interface ReasonContext {
  userId?: string;
  followingIds: string[];
  userPersona?: string;
  source?: FeedSource;
  now?: number;
  /** Topics the viewer follows (lowercase, no #). */
  followedHashtags?: string[];
}

/** The first followed topic a post carries, if any. */
function followedTopicIn(post: any, followedHashtags: string[] | undefined): string | null {
  if (!followedHashtags || followedHashtags.length === 0) return null;
  const text = String(post.content ?? '').toLowerCase();
  return followedHashtags.find((tag) => text.includes(`#${tag}`)) ?? null;
}

/**
 * The plain-words account of why a post ranked. Kept honest: each reason
 * corresponds to a factor the scoring actually applied.
 */
export function reasonsFor(post: any, context: ReasonContext): string[] {
  const reasons: string[] = [];
  const authorName = post.author?.displayName?.trim() || 'someone';
  const now = context.now ?? Date.now();
  const ageHours = (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const responses = (post.likeCount ?? 0) + (post.commentCount ?? 0) * 3 + (post.shareCount ?? 0) * 5;

  if (context.userId && post.authorId === context.userId) {
    reasons.push('Your post');
  } else if (context.followingIds.includes(post.authorId)) {
    reasons.push(`You follow ${authorName}`);
  }

  const topic = followedTopicIn(post, context.followedHashtags);
  if (topic) reasons.push(`You follow #${topic}`);

  if (context.source === 'trending') reasons.push('Trending in the community');
  else if (context.source === 'discovery') reasons.push('Popular with members like you');

  if (context.userPersona && post.author?.persona === context.userPersona && !reasons.includes('Popular with members like you')) {
    reasons.push('Same career stage as you');
  }
  if (post.type === 'WIN') reasons.push('A win worth celebrating');
  if (ageHours < 1) reasons.push('Just posted');
  else if (responses >= 20) reasons.push('Getting a lot of responses');

  if (reasons.length === 0) reasons.push('Recent in the community');
  return reasons.slice(0, 2);
}

interface FeedPreferences {
  creators: Set<string>;
  hashtags: string[];
  followedHashtags: string[];
  // The viewer's muted words, as a matcher; null when they have none.
  muted: ((text: string | null | undefined) => boolean) | null;
}

/**
 * Feed preferences: "see fewer from" creators and muted topics keep things
 * out; followed topics are boosted and named in the reasons.
 */
async function loadFeedExclusions(userId?: string): Promise<FeedPreferences> {
  const none: FeedPreferences = { creators: new Set(), hashtags: [], followedHashtags: [], muted: null };
  if (!userId) return none;
  try {
    const prefs = await prisma.userFeedPreferences.findUnique({
      where: { userId },
      select: { blockedCreators: true, blockedHashtags: true, followedHashtags: true },
    });
    const clean = (tags: string[] | undefined) =>
      (tags ?? []).map((tag) => tag.replace(/^#+/, '').toLowerCase()).filter(Boolean);
    // Muted words live with the safety settings; a missing row means none.
    let muted: FeedPreferences['muted'] = null;
    try {
      const safety = await prisma.userSafetySettings.findUnique({ where: { userId }, select: { blockedKeywords: true } });
      muted = mutedWordMatcher(safety?.blockedKeywords ?? []);
    } catch {
      muted = null;
    }
    return {
      creators: new Set(prefs?.blockedCreators ?? []),
      hashtags: clean(prefs?.blockedHashtags),
      followedHashtags: clean(prefs?.followedHashtags),
      muted,
    };
  } catch {
    return none;
  }
}

function isExcluded(post: any, exclusions: FeedPreferences): boolean {
  if (exclusions.creators.has(post.authorId)) return true;
  if (exclusions.muted && exclusions.muted(post.content)) return true;
  if (exclusions.hashtags.length === 0) return false;
  const text = String(post.content ?? '').toLowerCase();
  return exclusions.hashtags.some((tag) => text.includes(`#${tag}`));
}

function enforceCreatorDiversity<T extends { authorId: string }>(
  items: T[],
  maxPerAuthor: number
): T[] {
  if (!Number.isFinite(maxPerAuthor) || maxPerAuthor <= 0) return items;
  const counts = new Map<string, number>();
  const out: T[] = [];

  for (const item of items) {
    const prev = counts.get(item.authorId) || 0;
    if (prev >= maxPerAuthor) continue;
    counts.set(item.authorId, prev + 1);
    out.push(item);
  }

  return out;
}

function getFeedDiversityLimit(): number {
  const raw = Number.parseInt(process.env.FEED_MAX_POSTS_PER_CREATOR || '3', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

// ==========================================
// ALGORITHM WEIGHTS
// ==========================================

const WEIGHTS = {
  // Content type multipliers (video-first)
  VIDEO: 3.0,
  IMAGE: 1.5,
  TEXT: 1.0,
  ARTICLE: 1.2,

  // Engagement weights
  LIKE: 1.0,
  COMMENT: 3.0,
  SHARE: 5.0,
  VIEW: 0.1,

  // Time decay (half-life in hours)
  DECAY_HALF_LIFE: 24,

  // Relationship weights
  FOLLOWING: 2.0,
  SAME_PERSONA: 1.3,
  SAME_INDUSTRY: 1.2,
  FOLLOWED_TOPIC: 1.4,

  // Freshness bonus for new posts (< 1 hour)
  FRESHNESS_BONUS: 1.5,

  // Creator tier bonuses
  CREATOR_EMERGING: 1.0,
  CREATOR_RISING: 1.2,
  CREATOR_ESTABLISHED: 1.4,
  CREATOR_PARTNER: 1.6,
};

// ==========================================
// FEED ALGORITHM
// ==========================================

export async function generateFeed(options: FeedOptions): Promise<{
  posts: FeedPost[];
  hasMore: boolean;
  total: number;
}> {
  const {
    userId,
    page = 1,
    limit = 20,
    type = 'all',
    algorithm = 'engagement',
  } = options;

  // Build base query
  let where: any = { isPublic: true, isHidden: false };

  // Filter by content type
  if (type !== 'all') {
    where.type = type.toUpperCase();
  }

  // Get user context for personalization
  let userContext: any = null;
  let followingIds: string[] = [];

  if (userId) {
    userContext = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        persona: true,
        currentJobTitle: true,
        following: { select: { followingId: true } },
      },
    });

    if (userContext) {
      followingIds = userContext.following.map((f: any) => f.followingId);
      followingIds.push(userId); // Include own posts

      // Include private posts from people we follow
      where = {
        OR: [
          { isPublic: true, isHidden: false },
          { authorId: { in: followingIds }, isHidden: false },
        ],
      };

      // Add type filter back
      if (type !== 'all') {
        where.AND = [{ type: type.toUpperCase() }];
      }
    }
  }

  // Connections-only authors reach their followers; private authors nobody.
  where = { AND: [where, authorAudienceWhere(userId, followingIds)] };

  let rankedPosts: ScorePost[] = [];

  // "See fewer posts from X" and muted topics apply to every ranked feed.
  const exclusions = await loadFeedExclusions(userId);

  // Personalized: OpportunityVerse-style sourcing with diversity enforcement.
  if (algorithm === 'personalized' && userId) {
    const target = page * limit;
    const inNetworkTarget = Math.ceil(target * 0.3);
    const outNetworkTarget = Math.ceil(target * 0.5);
    const trendingTarget = Math.max(0, target - inNetworkTarget - outNetworkTarget);

    // 1) In-network (following + own)
    const inNetworkWhere: any = {
      authorId: { in: [...new Set([...followingIds, userId])] },
      isHidden: false,
      AND: [authorAudienceWhere(userId, followingIds)],
    };
    if (type !== 'all') inNetworkWhere.type = type.toUpperCase();

    const inNetworkPosts = await prisma.post.findMany({
      where: inNetworkWhere,
      include: {
        ...REPOST_OF_INCLUDE,
        author: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            headline: true,
            persona: true,
            role: true,
            creatorProfile: { select: { tier: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(200, inNetworkTarget * 4),
    });

    const scoredInNetwork: ScorePost[] = inNetworkPosts.map((post) => {
      const score = calculatePostScore(post, {
        userId,
        followingIds,
        userPersona: userContext?.persona,
        followedHashtags: exclusions.followedHashtags,
      });
      return { ...post, engagementScore: score.engagement, decayedScore: score.final, __source: 'network' as const };
    }).sort((a, b) => b.decayedScore - a.decayedScore);

    // 2) Out-of-network discovery (existing discovery logic)
    const discovery = await getForYouFeed(userId, 1, Math.min(200, outNetworkTarget * 4));
    const scoredOutNetwork: ScorePost[] = (discovery.posts as any).map((p: any) => ({
      ...p,
      // getForYouFeed already provides engagementScore/decayedScore fields
      engagementScore: p.engagementScore ?? 0,
      decayedScore: p.decayedScore ?? 0,
      __source: 'discovery' as const,
    }));

    // 3) Trending
    const trending = await getTrendingPosts(24, Math.min(100, Math.max(10, trendingTarget * 4)));
    const scoredTrending: ScorePost[] = (trending as any).map((p: any) => ({
      ...p,
      engagementScore: p.engagementScore ?? 0,
      decayedScore: p.decayedScore ?? 0,
      __source: 'trending' as const,
    }));

    const maxPerCreator = getFeedDiversityLimit();
    const seen = new Set<string>();
    const result: ScorePost[] = [];
    const quotas = {
      inNetwork: inNetworkTarget,
      outNetwork: outNetworkTarget,
      trending: trendingTarget,
    };

    const sources = [
      { key: 'inNetwork' as const, list: scoredInNetwork },
      { key: 'outNetwork' as const, list: scoredOutNetwork },
      { key: 'trending' as const, list: scoredTrending },
    ];

    const countsByAuthor = new Map<string, number>();
    const canTake = (item: any) => {
      if (!item?.id || seen.has(item.id)) return false;
      if (isExcluded(item, exclusions)) return false;
      const authorId = item.authorId || item.author?.id;
      if (!authorId) return true;
      const prev = countsByAuthor.get(authorId) || 0;
      return prev < maxPerCreator;
    };

    const takeItem = (item: any) => {
      seen.add(item.id);
      const authorId = item.authorId || item.author?.id;
      if (authorId) countsByAuthor.set(authorId, (countsByAuthor.get(authorId) || 0) + 1);
      result.push(item);
    };

    // Round-robin fill while respecting quotas.
    while (result.length < target) {
      let progressed = false;

      for (const src of sources) {
        const remainingQuota = (quotas as any)[src.key] as number;
        if (remainingQuota <= 0) continue;

        while (src.list.length > 0) {
          const next = src.list.shift();
          if (!next) break;
          if (!canTake(next)) continue;

          takeItem(next);
          (quotas as any)[src.key] = remainingQuota - 1;
          progressed = true;
          break;
        }
      }

      // If quotas exhausted or no sources can provide, backfill from any source.
      if (!progressed) {
        const pool = sources.flatMap((s) => s.list);
        if (pool.length === 0) break;
        // Try take from remaining lists in order
        let took = false;
        for (const src of sources) {
          while (src.list.length > 0) {
            const next = src.list.shift();
            if (!next) break;
            if (!canTake(next)) continue;
            takeItem(next);
            took = true;
            break;
          }
          if (took) break;
        }
        if (!took) break;
      }
    }

    rankedPosts = result;
  } else {
    // Get candidate posts (recent + high engagement)
    const candidatePosts = await prisma.post.findMany({
      where,
      include: {
        ...REPOST_OF_INCLUDE,
        author: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            headline: true,
            persona: true,
            role: true,
            creatorProfile: {
              select: { tier: true },
            },
          },
        },
      },
      orderBy:
        algorithm === 'chronological'
          ? { createdAt: 'desc' }
          : [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      take: 200, // Get more posts for ranking
    });

    // Score and rank posts
    const scoredPosts: ScorePost[] = candidatePosts
      .filter((post) => !isExcluded(post, exclusions))
      .map((post) => {
        const score = calculatePostScore(post, {
          userId,
          followingIds,
          userPersona: userContext?.persona,
          followedHashtags: exclusions.followedHashtags,
        });

        return {
          ...post,
          engagementScore: score.engagement,
          decayedScore: score.final,
          __source: 'recent' as const,
        };
      });

    // Sort by final score
    rankedPosts = scoredPosts.sort((a, b) => b.decayedScore - a.decayedScore);

    // Apply diversity only for ranked feeds (engagement/personalized without user)
    if (algorithm !== 'chronological') {
      rankedPosts = enforceCreatorDiversity(rankedPosts, getFeedDiversityLimit());
    }
  }

  // Paginate
  const startIndex = (page - 1) * limit;
  const paginatedPosts = rankedPosts.slice(startIndex, startIndex + limit);

  // Get like status for authenticated user
  let likedPostIds: string[] = [];
  if (userId) {
    const likes = await prisma.like.findMany({
      where: {
        userId,
        postId: { in: paginatedPosts.map((p) => p.id) },
      },
      select: { postId: true },
    });
    likedPostIds = likes.map((l) => l.postId);
  }

  // Format response
  const posts: FeedPost[] = paginatedPosts.map((post) => ({
    id: post.id,
    authorId: post.authorId,
    type: post.type,
    content: post.content,
    mediaUrls: post.mediaUrls,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      displayName: post.author.displayName || '',
      avatar: post.author.avatar,
      headline: post.author.headline,
      // followingIds carries the viewer's own id so their posts rank as
      // in-network; a member does not "follow" themselves.
      isFollowing:
        !!userId && post.author.id !== userId && followingIds.includes(post.author.id),
    },
    isLiked: likedPostIds.includes(post.id),
    engagementScore: post.engagementScore,
    decayedScore: post.decayedScore,
    poll: post.poll ?? null,
    isPinned: Boolean(post.isPinned),
    isSensitive: Boolean(post.isSensitive),
    repostOf: post.repostOf ?? null,
    repostCount: post.repostCount ?? 0,
    reasons: reasonsFor(post, {
      userId,
      followingIds,
      userPersona: userContext?.persona,
      source: post.__source ?? (algorithm === 'chronological' ? 'recent' : undefined),
      followedHashtags: exclusions.followedHashtags,
    }),
  }));

  return {
    posts,
    hasMore: startIndex + limit < rankedPosts.length,
    total: rankedPosts.length,
  };
}

// ==========================================
// SCORING FUNCTION
// ==========================================

interface ScoreContext {
  userId?: string;
  followingIds: string[];
  userPersona?: string;
  followedHashtags?: string[];
}

function calculatePostScore(
  post: any,
  context: ScoreContext
): { engagement: number; final: number } {
  // Base engagement score
  const likes = post.likeCount * WEIGHTS.LIKE;
  const comments = post.commentCount * WEIGHTS.COMMENT;
  const shares = post.shareCount * WEIGHTS.SHARE;
  const views = post.viewCount * WEIGHTS.VIEW;

  let engagement = likes + comments + shares + views;

  // Content type multiplier (video-first)
  const typeMultiplier = WEIGHTS[post.type as keyof typeof WEIGHTS] || 1.0;
  engagement *= typeMultiplier;

  // Relationship bonus
  if (context.followingIds.includes(post.authorId)) {
    engagement *= WEIGHTS.FOLLOWING;
  }

  // Same persona bonus
  if (context.userPersona && post.author.persona === context.userPersona) {
    engagement *= WEIGHTS.SAME_PERSONA;
  }

  // A topic the viewer follows
  if (followedTopicIn(post, context.followedHashtags)) {
    engagement *= WEIGHTS.FOLLOWED_TOPIC;
  }

  // Creator tier bonus
  if (post.author.creatorProfile?.tier) {
    const tierKey = `CREATOR_${post.author.creatorProfile.tier.toUpperCase()}` as keyof typeof WEIGHTS;
    const tierBonus = WEIGHTS[tierKey] || 1.0;
    engagement *= tierBonus;
  }

  // Time decay
  const ageHours = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
  const decayFactor = Math.pow(0.5, ageHours / WEIGHTS.DECAY_HALF_LIFE);

  // Freshness bonus for very new posts
  let freshness = 1.0;
  if (ageHours < 1) {
    freshness = WEIGHTS.FRESHNESS_BONUS;
  }

  const final = engagement * decayFactor * freshness;

  return { engagement, final };
}

// ==========================================
// TRENDING POSTS
// ==========================================

export async function getTrendingPosts(
  hours = 24,
  limit = 10
): Promise<FeedPost[]> {
  const cacheKey = CacheKeys.feedTrending(hours, limit);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const posts = await prisma.post.findMany({
        where: {
          isPublic: true,
          isHidden: false,
          createdAt: { gte: startTime },
          AND: [authorAudienceWhere()],
        },
        include: {
          ...REPOST_OF_INCLUDE,
          author: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              headline: true,
            },
          },
        },
        orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
        take: limit * 2, // Get more for filtering
      });

      // Score and rank
      const scored = posts.map((post) => ({
        ...post,
        engagementScore: calculatePostScore(post, { followingIds: [] }).engagement,
        decayedScore: calculatePostScore(post, { followingIds: [] }).final,
      }));

      const ranked = scored
        .sort((a, b) => b.decayedScore - a.decayedScore)
        .slice(0, limit);

      return ranked.map((post) => ({
        id: post.id,
        authorId: post.authorId,
        type: post.type,
        content: post.content,
        mediaUrls: post.mediaUrls,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        author: {
          id: post.author.id,
          displayName: post.author.displayName || '',
          avatar: post.author.avatar,
          headline: post.author.headline,
        },
        engagementScore: post.engagementScore,
        decayedScore: post.decayedScore,
        poll: post.poll ?? null,
        isPinned: Boolean(post.isPinned),
        isSensitive: Boolean(post.isSensitive),
        repostOf: post.repostOf ?? null,
        repostCount: post.repostCount ?? 0,
        reasons: ['Trending in the community'],
      }));
    },
    300 // Cache for 5 minutes
  );
}

// ==========================================
// VIDEO-ONLY FEED (TikTok-style)
// ==========================================

export async function getVideoFeed(
  userId?: string,
  cursor?: string,
  limit = 10
): Promise<{
  videos: FeedPost[];
  nextCursor: string | null;
}> {
  const where: any = {
    type: 'VIDEO',
    isPublic: true,
    isHidden: false,
    AND: [authorAudienceWhere(userId, await followingIdsOf(userId))],
  };

  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const videos = await prisma.post.findMany({
    where,
    include: {
      ...REPOST_OF_INCLUDE,
      author: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
          headline: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: limit + 1, // Get one extra for cursor
  });

  const hasMore = videos.length > limit;
  const results = videos.slice(0, limit);

  // Get like status
  let likedIds: string[] = [];
  if (userId) {
    const likes = await prisma.like.findMany({
      where: {
        userId,
        postId: { in: results.map((v) => v.id) },
      },
      select: { postId: true },
    });
    likedIds = likes.map((l) => l.postId);
  }

  const formattedVideos: FeedPost[] = results.map((post) => ({
    id: post.id,
    authorId: post.authorId,
    type: post.type,
    content: post.content,
    mediaUrls: post.mediaUrls,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      displayName: post.author.displayName || '',
      avatar: post.author.avatar,
      headline: post.author.headline,
    },
    isLiked: likedIds.includes(post.id),
    engagementScore: 0,
    decayedScore: 0,
  }));

  return {
    videos: formattedVideos,
    nextCursor: hasMore ? results[results.length - 1].createdAt.toISOString() : null,
  };
}

// ==========================================
// FOR YOU PAGE (Personalized Discovery)
// ==========================================

export async function getForYouFeed(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ posts: FeedPost[]; hasMore: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      persona: true,
      skills: { select: { skill: { select: { name: true } } } },
      following: { select: { followingId: true } },
      likes: { select: { post: { select: { authorId: true } } }, take: 50 },
    },
  });

  if (!user) {
    return generateFeed({ page, limit, algorithm: 'engagement' });
  }

  // Build interest profile
  const followingIds = user.following.map((f) => f.followingId);
  const likedAuthorIds = user.likes.map((l) => l.post.authorId);
  const skillNames = user.skills.map((s) => s.skill.name);

  // Find similar users (same persona, liked same authors)
  const similarUsers = await prisma.user.findMany({
    where: {
      OR: [
        { persona: user.persona },
        { id: { in: likedAuthorIds } },
      ],
      NOT: { id: userId },
    },
    select: { id: true },
    take: 50,
  });

  const discoveryUserIds = similarUsers.map((u) => u.id);

  // Get posts from discovery users (not following yet)
  const discoveryPosts = await prisma.post.findMany({
    where: {
      authorId: {
        in: discoveryUserIds.filter((id) => !followingIds.includes(id)),
      },
      isPublic: true,
      isHidden: false,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      AND: [authorAudienceWhere(userId, followingIds)],
    },
    include: {
      ...REPOST_OF_INCLUDE,
      author: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
          headline: true,
          persona: true,
          creatorProfile: { select: { tier: true } },
        },
      },
    },
    take: 100,
  });

  // Score and rank
  const scored = discoveryPosts.map((post) => {
    const score = calculatePostScore(post, {
      userId,
      followingIds: [],
      userPersona: user.persona,
    });
    return { ...post, engagementScore: score.engagement, decayedScore: score.final };
  });

  const ranked = scored.sort((a, b) => b.decayedScore - a.decayedScore);
  const startIndex = (page - 1) * limit;
  const paginatedPosts = ranked.slice(startIndex, startIndex + limit);

  // Get like status
  const likes = await prisma.like.findMany({
    where: {
      userId,
      postId: { in: paginatedPosts.map((p) => p.id) },
    },
    select: { postId: true },
  });
  const likedIds = likes.map((l) => l.postId);

  const posts: FeedPost[] = paginatedPosts.map((post) => ({
    id: post.id,
    authorId: post.authorId,
    type: post.type,
    content: post.content,
    mediaUrls: post.mediaUrls,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      displayName: post.author.displayName || '',
      avatar: post.author.avatar,
      headline: post.author.headline,
      isFollowing: followingIds.includes(post.author.id),
    },
    isLiked: likedIds.includes(post.id),
    engagementScore: post.engagementScore,
    decayedScore: post.decayedScore,
    poll: post.poll ?? null,
    isPinned: Boolean(post.isPinned),
    isSensitive: Boolean(post.isSensitive),
    repostOf: post.repostOf ?? null,
    repostCount: post.repostCount ?? 0,
    reasons: reasonsFor(post, { userId, followingIds, userPersona: user.persona ?? undefined, source: 'discovery' }),
  }));

  return {
    posts,
    hasMore: startIndex + limit < ranked.length,
  };
}

// ==========================================
// RECORD VIEW (for analytics)
// ==========================================

export async function recordPostView(
  postId: string,
  userId?: string,
  options?: { silent?: boolean }
): Promise<void> {
  const silent = options?.silent ?? true;

  try {
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    logger.debug('Post view recorded', { postId, userId });
  } catch (error) {
    logger.error('Failed to record post view', { postId, error });
    if (!silent) throw error;
  }
}
