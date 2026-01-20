"use strict";
/**
 * Feed Algorithm Service
 * Video-first, engagement-optimized feed ranking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFeed = generateFeed;
exports.getTrendingPosts = getTrendingPosts;
exports.getVideoFeed = getVideoFeed;
exports.getForYouFeed = getForYouFeed;
exports.recordPostView = recordPostView;
const prisma_1 = require("../utils/prisma");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
function enforceCreatorDiversity(items, maxPerAuthor) {
    if (!Number.isFinite(maxPerAuthor) || maxPerAuthor <= 0)
        return items;
    const counts = new Map();
    const out = [];
    for (const item of items) {
        const prev = counts.get(item.authorId) || 0;
        if (prev >= maxPerAuthor)
            continue;
        counts.set(item.authorId, prev + 1);
        out.push(item);
    }
    return out;
}
function getFeedDiversityLimit() {
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
async function generateFeed(options) {
    const { userId, page = 1, limit = 20, type = 'all', algorithm = 'engagement', } = options;
    // Build base query
    let where = { isPublic: true, isHidden: false };
    // Filter by content type
    if (type !== 'all') {
        where.type = type.toUpperCase();
    }
    // Get user context for personalization
    let userContext = null;
    let followingIds = [];
    if (userId) {
        userContext = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                persona: true,
                currentJobTitle: true,
                following: { select: { followingId: true } },
            },
        });
        if (userContext) {
            followingIds = userContext.following.map((f) => f.followingId);
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
    let rankedPosts = [];
    // Personalized: OpportunityVerse-style sourcing with diversity enforcement.
    if (algorithm === 'personalized' && userId) {
        const target = page * limit;
        const inNetworkTarget = Math.ceil(target * 0.3);
        const outNetworkTarget = Math.ceil(target * 0.5);
        const trendingTarget = Math.max(0, target - inNetworkTarget - outNetworkTarget);
        // 1) In-network (following + own)
        const inNetworkWhere = {
            authorId: { in: [...new Set([...followingIds, userId])] },
            isHidden: false,
        };
        if (type !== 'all')
            inNetworkWhere.type = type.toUpperCase();
        const inNetworkPosts = await prisma_1.prisma.post.findMany({
            where: inNetworkWhere,
            include: {
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
        const scoredInNetwork = inNetworkPosts.map((post) => {
            const score = calculatePostScore(post, {
                userId,
                followingIds,
                userPersona: userContext?.persona,
            });
            return { ...post, engagementScore: score.engagement, decayedScore: score.final };
        }).sort((a, b) => b.decayedScore - a.decayedScore);
        // 2) Out-of-network discovery (existing discovery logic)
        const discovery = await getForYouFeed(userId, 1, Math.min(200, outNetworkTarget * 4));
        const scoredOutNetwork = discovery.posts.map((p) => ({
            ...p,
            // getForYouFeed already provides engagementScore/decayedScore fields
            engagementScore: p.engagementScore ?? 0,
            decayedScore: p.decayedScore ?? 0,
        }));
        // 3) Trending
        const trending = await getTrendingPosts(24, Math.min(100, Math.max(10, trendingTarget * 4)));
        const scoredTrending = trending.map((p) => ({
            ...p,
            engagementScore: p.engagementScore ?? 0,
            decayedScore: p.decayedScore ?? 0,
        }));
        const maxPerCreator = getFeedDiversityLimit();
        const seen = new Set();
        const result = [];
        const quotas = {
            inNetwork: inNetworkTarget,
            outNetwork: outNetworkTarget,
            trending: trendingTarget,
        };
        const sources = [
            { key: 'inNetwork', list: scoredInNetwork },
            { key: 'outNetwork', list: scoredOutNetwork },
            { key: 'trending', list: scoredTrending },
        ];
        const countsByAuthor = new Map();
        const canTake = (item) => {
            if (!item?.id || seen.has(item.id))
                return false;
            const authorId = item.authorId || item.author?.id;
            if (!authorId)
                return true;
            const prev = countsByAuthor.get(authorId) || 0;
            return prev < maxPerCreator;
        };
        const takeItem = (item) => {
            seen.add(item.id);
            const authorId = item.authorId || item.author?.id;
            if (authorId)
                countsByAuthor.set(authorId, (countsByAuthor.get(authorId) || 0) + 1);
            result.push(item);
        };
        // Round-robin fill while respecting quotas.
        while (result.length < target) {
            let progressed = false;
            for (const src of sources) {
                const remainingQuota = quotas[src.key];
                if (remainingQuota <= 0)
                    continue;
                while (src.list.length > 0) {
                    const next = src.list.shift();
                    if (!next)
                        break;
                    if (!canTake(next))
                        continue;
                    takeItem(next);
                    quotas[src.key] = remainingQuota - 1;
                    progressed = true;
                    break;
                }
            }
            // If quotas exhausted or no sources can provide, backfill from any source.
            if (!progressed) {
                const pool = sources.flatMap((s) => s.list);
                if (pool.length === 0)
                    break;
                // Try take from remaining lists in order
                let took = false;
                for (const src of sources) {
                    while (src.list.length > 0) {
                        const next = src.list.shift();
                        if (!next)
                            break;
                        if (!canTake(next))
                            continue;
                        takeItem(next);
                        took = true;
                        break;
                    }
                    if (took)
                        break;
                }
                if (!took)
                    break;
            }
        }
        rankedPosts = result;
    }
    else {
        // Get candidate posts (recent + high engagement)
        const candidatePosts = await prisma_1.prisma.post.findMany({
            where,
            include: {
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
            orderBy: algorithm === 'chronological'
                ? { createdAt: 'desc' }
                : [{ likeCount: 'desc' }, { createdAt: 'desc' }],
            take: 200, // Get more posts for ranking
        });
        // Score and rank posts
        const scoredPosts = candidatePosts.map((post) => {
            const score = calculatePostScore(post, {
                userId,
                followingIds,
                userPersona: userContext?.persona,
            });
            return {
                ...post,
                engagementScore: score.engagement,
                decayedScore: score.final,
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
    let likedPostIds = [];
    if (userId) {
        const likes = await prisma_1.prisma.like.findMany({
            where: {
                userId,
                postId: { in: paginatedPosts.map((p) => p.id) },
            },
            select: { postId: true },
        });
        likedPostIds = likes.map((l) => l.postId);
    }
    // Format response
    const posts = paginatedPosts.map((post) => ({
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
        isLiked: likedPostIds.includes(post.id),
        engagementScore: post.engagementScore,
        decayedScore: post.decayedScore,
    }));
    return {
        posts,
        hasMore: startIndex + limit < rankedPosts.length,
        total: rankedPosts.length,
    };
}
function calculatePostScore(post, context) {
    // Base engagement score
    const likes = post.likeCount * WEIGHTS.LIKE;
    const comments = post.commentCount * WEIGHTS.COMMENT;
    const shares = post.shareCount * WEIGHTS.SHARE;
    const views = post.viewCount * WEIGHTS.VIEW;
    let engagement = likes + comments + shares + views;
    // Content type multiplier (video-first)
    const typeMultiplier = WEIGHTS[post.type] || 1.0;
    engagement *= typeMultiplier;
    // Relationship bonus
    if (context.followingIds.includes(post.authorId)) {
        engagement *= WEIGHTS.FOLLOWING;
    }
    // Same persona bonus
    if (context.userPersona && post.author.persona === context.userPersona) {
        engagement *= WEIGHTS.SAME_PERSONA;
    }
    // Creator tier bonus
    if (post.author.creatorProfile?.tier) {
        const tierKey = `CREATOR_${post.author.creatorProfile.tier.toUpperCase()}`;
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
async function getTrendingPosts(hours = 24, limit = 10) {
    const cacheKey = cache_1.CacheKeys.feedTrending(hours, limit);
    return (0, cache_1.cacheGetOrSet)(cacheKey, async () => {
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const posts = await prisma_1.prisma.post.findMany({
            where: {
                isPublic: true,
                isHidden: false,
                createdAt: { gte: startTime },
            },
            include: {
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
        }));
    }, 300 // Cache for 5 minutes
    );
}
// ==========================================
// VIDEO-ONLY FEED (TikTok-style)
// ==========================================
async function getVideoFeed(userId, cursor, limit = 10) {
    const where = {
        type: 'VIDEO',
        isPublic: true,
        isHidden: false,
    };
    if (cursor) {
        where.createdAt = { lt: new Date(cursor) };
    }
    const videos = await prisma_1.prisma.post.findMany({
        where,
        include: {
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
    let likedIds = [];
    if (userId) {
        const likes = await prisma_1.prisma.like.findMany({
            where: {
                userId,
                postId: { in: results.map((v) => v.id) },
            },
            select: { postId: true },
        });
        likedIds = likes.map((l) => l.postId);
    }
    const formattedVideos = results.map((post) => ({
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
async function getForYouFeed(userId, page = 1, limit = 20) {
    const user = await prisma_1.prisma.user.findUnique({
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
    const similarUsers = await prisma_1.prisma.user.findMany({
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
    const discoveryPosts = await prisma_1.prisma.post.findMany({
        where: {
            authorId: {
                in: discoveryUserIds.filter((id) => !followingIds.includes(id)),
            },
            isPublic: true,
            isHidden: false,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: {
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
    const likes = await prisma_1.prisma.like.findMany({
        where: {
            userId,
            postId: { in: paginatedPosts.map((p) => p.id) },
        },
        select: { postId: true },
    });
    const likedIds = likes.map((l) => l.postId);
    const posts = paginatedPosts.map((post) => ({
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
        engagementScore: post.engagementScore,
        decayedScore: post.decayedScore,
    }));
    return {
        posts,
        hasMore: startIndex + limit < ranked.length,
    };
}
// ==========================================
// RECORD VIEW (for analytics)
// ==========================================
async function recordPostView(postId, userId, options) {
    const silent = options?.silent ?? true;
    try {
        await prisma_1.prisma.post.update({
            where: { id: postId },
            data: { viewCount: { increment: 1 } },
        });
        logger_1.logger.debug('Post view recorded', { postId, userId });
    }
    catch (error) {
        logger_1.logger.error('Failed to record post view', { postId, error });
        if (!silent)
            throw error;
    }
}
//# sourceMappingURL=feed.service.js.map