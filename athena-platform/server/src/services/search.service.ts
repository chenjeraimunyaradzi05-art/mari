/**
 * Search Service
 * Advanced search with relevance ranking and filtering
 */

import { prisma } from '../utils/prisma';
import { PostType, type Prisma } from '@prisma/client';
import { cacheGetOrSet, CacheKeys } from '../utils/cache';
import { getOpenSearchClient, IndexNames } from '../utils/opensearch';
import { logger } from '../utils/logger';
import { authorAudienceWhere, followingIdsOf } from './audience.service';
import { getBlockedRelationshipIds } from '../utils/safety-store';

// ==========================================
// TYPES
// ==========================================

export interface SearchOptions {
  query: string;
  type?: 'all' | 'users' | 'posts' | 'jobs' | 'courses' | 'videos' | 'mentors';
  /**
   * Who is searching, or undefined for a signed-out visitor. Every route that
   * reaches this service passes it, because search results are not the same
   * for everybody: a member who asked to be hidden is absent from all of them,
   * a member's private posts are hers alone, and neither side of a block ever
   * appears in the other's results.
   */
  viewerId?: string;
  persona?: string;
  sort?: 'relevance' | 'recent' | 'popular';
  page?: number;
  limit?: number;
  filters?: {
    // Job filters
    jobType?: string;
    experienceLevel?: string;
    salary?: { min?: number; max?: number };
    remote?: boolean;
    // Post filters
    postType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK' | 'POLL';
    hasMedia?: boolean;
    // Course filters
    level?: string;
    free?: boolean;
    // User filters
    role?: string;
    verified?: boolean;
  };
}

export interface SearchResult {
  type: 'user' | 'post' | 'job' | 'course' | 'video' | 'mentor';
  id: string;
  score: number;
  title?: string;
  content?: string;
  highlight?: string;
  metadata: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  suggestions?: string[];
}

// ==========================================
// TEXT PROCESSING
// ==========================================

/**
 * Escape special regex characters to prevent ReDoS attacks
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s#@-]/g, '')
    .replace(/\s+/g, ' ');
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  ]);

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function calculateRelevanceScore(
  text: string,
  keywords: string[],
  boostFactors: { isTitle?: boolean; isRecent?: boolean; popularity?: number }
): number {
  let score = 0;
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    // Escape regex special characters to prevent ReDoS
    const escapedKeyword = escapeRegex(keyword);
    
    // Exact match bonus
    if (lowerText.includes(keyword)) {
      score += 10;
      
      // Word boundary match (more specific)
      const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (wordBoundaryRegex.test(text)) {
        score += 5;
      }
      
      // Count occurrences (diminishing returns)
      const occurrences = (lowerText.match(new RegExp(escapedKeyword, 'g')) || []).length;
      score += Math.min(occurrences * 2, 10);
    }
  }

  // Boost factors
  if (boostFactors.isTitle) score *= 1.5;
  if (boostFactors.isRecent) score *= 1.2;
  if (boostFactors.popularity) score += Math.log(boostFactors.popularity + 1) * 2;

  return score;
}

function highlightMatch(text: string, keywords: string[], maxLength = 150): string {
  const lowerText = text.toLowerCase();
  
  // Find the first keyword match
  let matchStart = -1;
  for (const keyword of keywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1 && (matchStart === -1 || index < matchStart)) {
      matchStart = index;
    }
  }

  if (matchStart === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // Extract context around the match
  const start = Math.max(0, matchStart - 30);
  const end = Math.min(text.length, matchStart + maxLength - 30);
  
  let excerpt = text.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';

  return excerpt;
}

// ==========================================
// WHO THE VIEWER IS ALLOWED TO SEE
// ==========================================

/**
 * Everything about the person searching that narrows what may come back,
 * gathered once per search so the six searchers below do not each go and ask
 * the same three questions.
 */
export interface ViewerContext {
  viewerId?: string;
  /**
   * Members whose rows must not be returned at all: the ones the viewer
   * blocked and the ones who blocked the viewer. Blocking is symmetric, so one
   * list covers both directions.
   */
  blockedIds: string[];
  /** Who the viewer follows, for the connections-only authors in a feed. */
  followingIds: string[];
}

/**
 * Nothing here is best-effort. A lookup that fails takes the search down with
 * it and the member sees an error, which is the whole point: the alternative —
 * an empty block list standing in for one that could not be read — would put a
 * blocked account back in front of the woman who blocked him and tell nobody.
 * A failed search is a retry; a search that quietly stops filtering is the
 * defect this function exists to close.
 */
export async function viewerContextFor(viewerId?: string): Promise<ViewerContext> {
  if (!viewerId) return { blockedIds: [], followingIds: [] };

  const [platformBlocks, dvProfile, followingIds] = await Promise.all([
    getBlockedRelationshipIds(viewerId),
    prisma.dvSafetyProfile.findUnique({ where: { userId: viewerId }, select: { blockedUserIds: true } }),
    followingIdsOf(viewerId),
  ]);

  // Two block lists, because a safety block writes to both stores and the
  // platform-wide half of that write is best-effort (dv-safe.service.blockUser
  // logs and carries on if it fails). Reading the union means one failed
  // mirror cannot bring an abuser back into her search results.
  return {
    viewerId,
    blockedIds: Array.from(new Set([...platformBlocks, ...(dvProfile?.blockedUserIds ?? [])])),
    followingIds,
  };
}

/**
 * The filter that keeps a member out of another member's search results.
 *
 * "Hide me from search" is stored in two places — Profile.hideFromSearch,
 * written by the Safety Centre and the privacy page, and
 * DvSafetyProfile.hideFromSearch, written by the DV safety page and by Safe
 * Mode's one-tap switch. Both are honoured here rather than one, because a
 * woman who set the switch on either page has been told she is hidden, and
 * until the two stores are reconciled everywhere, reading only one of them is
 * how that promise gets broken for half the people who made it.
 *
 * The block clause covers the direction the id list cannot: a member who
 * blocked the viewer from her DV safety page before that block reached the
 * platform-wide store.
 */
export function hiddenMemberWhere(viewer: ViewerContext): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [
    { NOT: { dvSafetyProfile: { is: { hideFromSearch: true } } } },
    { NOT: { profile: { is: { hideFromSearch: true } } } },
  ];
  if (viewer.viewerId) {
    conditions.push({ NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: viewer.viewerId } } } } });
  }
  if (viewer.blockedIds.length > 0) {
    conditions.push({ id: { notIn: viewer.blockedIds } });
  }
  return { AND: conditions };
}

// ==========================================
// SEARCH FUNCTIONS
// ==========================================

export async function search(options: SearchOptions): Promise<SearchResponse> {
  const viewer = await viewerContextFor(options.viewerId);

  const openSearch = getOpenSearchClient();
  if (openSearch) {
    try {
      return await searchWithOpenSearch(openSearch, options, viewer);
    } catch (error) {
      logger.error('OpenSearch failed, falling back to Prisma', { error });
      // Fallback proceeds below
    }
  }

  const {
    query,
    type = 'all',
    persona,
    sort = 'relevance',
    page = 1,
    limit = 20,
    filters = {},
  } = options;

  const normalizedQuery = normalizeQuery(query);
  const keywords = extractKeywords(normalizedQuery);

  if (keywords.length === 0) {
    return {
      results: [],
      total: 0,
      page,
      totalPages: 0,
      query,
      suggestions: await getSearchSuggestions(query),
    };
  }

  const results: SearchResult[] = [];

  // Search in parallel
  const searchPromises: Promise<void>[] = [];

  if (type === 'all' || type === 'users') {
    searchPromises.push(
      searchUsers(keywords, filters, viewer, persona).then((r) => { results.push(...r); })
    );
  }

  if (type === 'all' || type === 'posts') {
    searchPromises.push(
      searchPosts(keywords, filters, viewer).then((r) => { results.push(...r); })
    );
  }

  if (type === 'all' || type === 'jobs') {
    searchPromises.push(
      searchJobs(keywords, filters, persona).then((r) => { results.push(...r); })
    );
  }

  if (type === 'all' || type === 'courses') {
    searchPromises.push(
      searchCourses(keywords, filters).then((r) => { results.push(...r); })
    );
  }

  if (type === 'all' || type === 'videos') {
    searchPromises.push(
      searchVideos(keywords, filters).then((r) => { results.push(...r); })
    );
  }

  if (type === 'all' || type === 'mentors') {
    searchPromises.push(
      searchMentors(keywords, filters, viewer, persona).then((r) => { results.push(...r); })
    );
  }

  await Promise.all(searchPromises);

  // Sort results
  switch (sort) {
    case 'recent':
      results.sort((a, b) => {
        const timeA = a.metadata.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
        const timeB = b.metadata.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      break;
    case 'popular':
      results.sort((a, b) => (b.metadata.popularity || 0) - (a.metadata.popularity || 0));
      break;
    default: // relevance
      results.sort((a, b) => b.score - a.score);
  }

  // Paginate
  const total = results.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedResults = results.slice((page - 1) * limit, page * limit);

  return {
    results: paginatedResults,
    total,
    page,
    totalPages,
    query,
    suggestions: total < 5 ? await getSearchSuggestions(query) : undefined,
  };
}

async function searchUsers(
  keywords: string[],
  filters: SearchOptions['filters'],
  viewer: ViewerContext,
  persona?: string
): Promise<SearchResult[]> {
  const users = await prisma.user.findMany({
    // The safety filter is ANDed into the query rather than applied to the
    // rows afterwards. Filtering after `take: 50` would silently shorten the
    // page every time somebody hidden matched the keywords, and would hand the
    // count of hidden matches to anyone willing to compare page lengths.
    where: {
      AND: [
        {
          isActive: true,
          OR: [
            ...keywords.flatMap((kw) => [
              { displayName: { contains: kw, mode: 'insensitive' as const } },
              { bio: { contains: kw, mode: 'insensitive' as const } },
              { headline: { contains: kw, mode: 'insensitive' as const } },
            ]),
            { skills: { some: { skill: { name: { in: keywords, mode: 'insensitive' } } } } },
          ],
          ...(filters?.role && { role: filters.role as any }),
          ...(filters?.verified && { isVerified: true }),
        },
        hiddenMemberWhere(viewer),
      ],
    },
    // Selected explicitly rather than `include`. A bare `include` asks Postgres
    // for every scalar on User — which pulls passwordHash and twoFactorSecret
    // into memory just to rank a search, and makes the whole query fail with
    // P2022 whenever the schema has a column the database has not been
    // migrated to yet. These are the only fields the result card reads.
    select: {
      id: true,
      displayName: true,
      bio: true,
      headline: true,
      avatar: true,
      role: true,
      persona: true,
      isVerified: true,
      createdAt: true,
      _count: { select: { followers: true, posts: true } },
    },
    take: 50,
  });

  return users.map((user) => {
    const searchableText = [user.displayName, user.bio, user.headline].filter(Boolean).join(' ');
    const popularity = (user as any)._count?.followers || 0 + ((user as any)._count?.posts || 0) * 2;

    // Persona boost
    let personaBoost = 1;
    if (persona && user.persona === persona) personaBoost = 1.3;

    const score = calculateRelevanceScore(
      searchableText,
      keywords,
      { isTitle: false, popularity }
    ) * personaBoost;

    return {
      type: 'user' as const,
      id: user.id,
      score,
      title: user.displayName || 'User',
      content: user.headline || user.bio || '',
      highlight: highlightMatch(searchableText, keywords),
      metadata: {
        avatar: user.avatar,
        role: user.role,
        followers: (user as any)._count?.followers || 0,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        popularity,
      },
    };
  });
}

/**
 * Posts the viewer is allowed to read, and no others.
 *
 * This used to be a flat object literal with two `OR` keys in it — the keyword
 * match, and a media filter spread in last — so the second silently replaced
 * the first and `?q=a&type=posts&hasMedia=true` returned every image and video
 * post on the platform to whoever asked. Building the clause as an explicit
 * AND list is what stops one condition from overwriting another, so the shape
 * here is load-bearing and not a tidy-up.
 *
 * The audience rules are the feed's own: authorAudienceWhere is what
 * feed.service narrows every timeline with, so a post that search returns is a
 * post the feed would have been willing to show the same person.
 */
async function searchPosts(
  keywords: string[],
  filters: SearchOptions['filters'],
  viewer: ViewerContext
): Promise<SearchResult[]> {
  const conditions: Prisma.PostWhereInput[] = [
    // isPublic was never checked here at all, which is how a post its author
    // had marked private reached a signed-out stranger as a 200-character
    // excerpt with her name and picture attached.
    { isHidden: false, isPublic: true },
    { OR: keywords.map((kw) => ({ content: { contains: kw, mode: 'insensitive' as const } })) },
    // Supplies groupId: null as well, so a group's conversation stays on the
    // group's page.
    authorAudienceWhere(viewer.viewerId, viewer.followingIds),
  ];

  if (filters?.postType && Object.values(PostType).includes(filters.postType as any)) {
    conditions.push({ type: filters.postType as any });
  }
  if (filters?.hasMedia) {
    conditions.push({ OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }] });
  }
  if (viewer.blockedIds.length > 0) {
    conditions.push({ authorId: { notIn: viewer.blockedIds } });
  }
  if (viewer.viewerId) {
    conditions.push({ NOT: { author: { dvSafetyProfile: { is: { blockedUserIds: { has: viewer.viewerId } } } } } });
  }

  const posts = await prisma.post.findMany({
    where: { AND: conditions },
    include: {
      author: { select: { id: true, displayName: true, avatar: true } },
    },
    take: 50,
  });

  const now = Date.now();

  return posts.map((post) => {
    const age = now - new Date(post.createdAt).getTime();
    const isRecent = age < 7 * 24 * 60 * 60 * 1000; // Within a week
    const popularity = post.viewCount + post.likeCount * 5 + post.commentCount * 10;

    const score = calculateRelevanceScore(
      post.content,
      keywords,
      { isRecent, popularity }
    );

    return {
      type: 'post' as const,
      id: post.id,
      score,
      content: post.content.substring(0, 200),
      highlight: highlightMatch(post.content, keywords),
      metadata: {
        postType: post.type,
        author: post.author,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        mediaUrl: Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null,
        createdAt: post.createdAt,
        popularity,
      },
    };
  });
}

async function searchJobs(
  keywords: string[],
  filters: SearchOptions['filters'],
  _persona?: string
): Promise<SearchResult[]> {
  const jobs = await prisma.job.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        ...keywords.flatMap((kw) => [
          { title: { contains: kw, mode: 'insensitive' as const } },
          { description: { contains: kw, mode: 'insensitive' as const } },
        ]),
        { skills: { some: { skill: { name: { in: keywords, mode: 'insensitive' } } } } },
      ],
      ...(filters?.jobType && { type: filters.jobType as any }),
      ...(filters?.remote && { isRemote: true }),
      ...(filters?.salary?.min && { salaryMin: { gte: filters.salary.min } }),
      ...(filters?.salary?.max && { salaryMax: { lte: filters.salary.max } }),
    },
    include: {
      organization: { select: { id: true, name: true, logo: true } },
    },
    take: 50,
  });

  return jobs.map((job) => {
    const searchableText = `${job.title} ${job.description}`;
    const popularity = job.applicationCount;

    // Persona matching
    const personaBoost = 1;

    const score = calculateRelevanceScore(
      searchableText,
      keywords,
      { isTitle: true, popularity }
    ) * personaBoost;

    return {
      type: 'job' as const,
      id: job.id,
      score,
      title: job.title,
      content: job.description.substring(0, 200),
      highlight: highlightMatch(job.description, keywords),
      metadata: {
        company: job.organization,
        location: [job.city, job.state, job.country].filter(Boolean).join(', '),
        type: job.type,
        experienceLevel: `${job.experienceMin || 0}+ years`,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        isRemote: job.isRemote,
        applications: job.applicationCount,
        createdAt: job.createdAt,
        popularity,
      },
    };
  });
}

async function searchCourses(
  keywords: string[],
  filters: SearchOptions['filters']
): Promise<SearchResult[]> {
  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      OR: [
        ...keywords.flatMap((kw) => [
          { title: { contains: kw, mode: 'insensitive' as const } },
          { description: { contains: kw, mode: 'insensitive' as const } },
        ]),
      ],
      ...(filters?.free && { cost: 0 }),
    },
    include: {
      organization: { select: { id: true, name: true, logo: true } },
    },
    take: 50,
  });

  return courses.map((course) => {
    const searchableText = `${course.title} ${course.description}`;
    const popularity = 0;

    const score = calculateRelevanceScore(
      searchableText,
      keywords,
      { isTitle: true, popularity }
    );

    return {
      type: 'course' as const,
      id: course.id,
      score,
      title: course.title,
      content: course.description.substring(0, 200),
      highlight: highlightMatch(course.description, keywords),
      metadata: {
        provider: course.organization?.name || course.providerName,
        organization: course.organization,
        type: course.type,
        durationMonths: course.durationMonths,
        cost: course.cost,
        studyMode: course.studyMode,
        createdAt: course.createdAt,
        popularity,
      },
    };
  });
}

async function searchVideos(
  keywords: string[],
  _filters: SearchOptions['filters']
): Promise<SearchResult[]> {
  const videos = await prisma.video.findMany({
    where: {
      status: 'PUBLISHED',
      isHidden: false,
      OR: [
        ...keywords.flatMap((kw) => {
          // A "#welding" query is a tag lookup. Reel hashtags are stored
          // lower-cased without the hash, so the tag has to be matched against
          // that column; the title/description checks would only find reels
          // that happened to spell the tag out in their caption.
          const tag = kw.startsWith('#') ? kw.slice(1) : null;
          return [
            { title: { contains: kw, mode: 'insensitive' as const } },
            { description: { contains: kw, mode: 'insensitive' as const } },
            ...(tag ? [{ hashtags: { has: tag } }] : []),
          ];
        }),
      ],
    },
    include: {
      author: { select: { id: true, displayName: true, avatar: true } },
    },
    take: 50,
  });

  return videos.map((video) => {
    const searchableText = [video.title, video.description, video.hashtags?.map((h) => `#${h}`).join(' ')].filter(Boolean).join(' ');
    const popularity = video.viewCount + video.likeCount * 5 + video.commentCount * 10 + video.shareCount * 6;
    const score = calculateRelevanceScore(searchableText, keywords, { isTitle: true, popularity });

    return {
      type: 'video' as const,
      id: video.id,
      score,
      title: video.title || 'Video',
      content: video.description?.substring(0, 200) || '',
      highlight: highlightMatch(searchableText, keywords),
      metadata: {
        author: video.author,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        shareCount: video.shareCount,
        createdAt: video.createdAt,
        popularity,
      },
    };
  });
}

/**
 * The mentor directory is the surface the privacy page names: its "show me in
 * mentor search" switch writes Profile.hideFromSearch, so a woman who turned
 * it off and was still being returned here was being contradicted by the one
 * control that mentions this list by name.
 */
async function searchMentors(
  keywords: string[],
  _filters: SearchOptions['filters'],
  viewer: ViewerContext,
  persona?: string
): Promise<SearchResult[]> {
  const mentors = await prisma.mentorProfile.findMany({
    where: {
      isAvailable: true,
      user: {
        AND: [
          {
            isActive: true,
            OR: [
              ...keywords.flatMap((kw) => [
                { displayName: { contains: kw, mode: 'insensitive' as const } },
                { headline: { contains: kw, mode: 'insensitive' as const } },
                { bio: { contains: kw, mode: 'insensitive' as const } },
              ]),
            ],
          },
          hiddenMemberWhere(viewer),
        ],
      },
    },
    include: {
      user: { select: { id: true, displayName: true, avatar: true, headline: true, bio: true, persona: true } },
    },
    take: 50,
  });

  return mentors.map((mentor) => {
    const searchableText = [mentor.user.displayName, mentor.user.headline, mentor.user.bio].filter(Boolean).join(' ');
    const popularity = (mentor.sessionCount || 0) + (Number(mentor.rating || 0) * 10);

    let personaBoost = 1;
    if (persona && mentor.user.persona === persona) personaBoost = 1.2;

    const score = calculateRelevanceScore(searchableText, keywords, { isTitle: true, popularity }) * personaBoost;

    return {
      type: 'mentor' as const,
      id: mentor.id,
      score,
      title: mentor.user.displayName || 'Mentor',
      content: mentor.user.headline || mentor.user.bio || '',
      highlight: highlightMatch(searchableText, keywords),
      metadata: {
        userId: mentor.userId,
        avatar: mentor.user.avatar,
        headline: mentor.user.headline,
        rating: mentor.rating ? Number(mentor.rating) : null,
        sessionCount: mentor.sessionCount,
        hourlyRate: mentor.hourlyRate ? Number(mentor.hourlyRate) : null,
        isAvailable: mentor.isAvailable,
        createdAt: mentor.createdAt,
        popularity,
      },
    };
  });
}

// ==========================================
// RECOMMENDATIONS
// ==========================================

export async function getRecommendedJobs(userId: string, limit = 10): Promise<SearchResult[]> {
  const client = getOpenSearchClient();

  // 1. Get User Profile with Skills
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      skills: { include: { skill: true } },
      profile: true,
    },
  });

  if (!user) return [];

  const skillNames = user.skills.map((us) => us.skill.name);
  const userLocation = [user.city, user.state, user.country].filter(Boolean).join(' ');
  const remotePreference = (user.profile as any)?.remotePreference as string | undefined;

  const applied = await prisma.jobApplication.findMany({
    where: { userId },
    select: { jobId: true },
  });
  const appliedJobIds = applied.map((a) => a.jobId);

  const userKeywordPool = [
    user.currentJobTitle || '',
    user.headline || '',
    user.city || '',
    user.state || '',
    user.country || '',
    ...skillNames,
  ]
    .join(' ')
    .trim();
  const userKeywords = extractKeywords(userKeywordPool).slice(0, 12);

  // 2. Fallback to Prisma if no OpenSearch connection
  if (!client) {
    const where: any = {
      status: 'ACTIVE',
    };

    if (appliedJobIds.length > 0) {
      where.id = { notIn: appliedJobIds };
    }

    // Keep candidate set reasonably broad, then rank in-memory.
    // (Phase 1 approach: low complexity, no extra schema/index requirements.)
    if (skillNames.length > 0 || userKeywords.length > 0) {
      where.OR = [
        ...(skillNames.length > 0
          ? [{ skills: { some: { skill: { name: { in: skillNames, mode: 'insensitive' } } } } }]
          : []),
        ...(user.currentJobTitle
          ? [{ title: { contains: user.currentJobTitle, mode: 'insensitive' } }]
          : []),
        ...(userKeywords.length > 0
          ? userKeywords.slice(0, 5).flatMap((kw) => [
              { title: { contains: kw, mode: 'insensitive' } },
              { description: { contains: kw, mode: 'insensitive' } },
            ])
          : []),
      ];
    }

    const candidates = await prisma.job.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true, logo: true },
        },
        skills: {
          include: { skill: true },
        },
      },
      take: Math.max(limit * 5, 50),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const filteredCandidates =
      appliedJobIds.length > 0 ? candidates.filter((j) => !appliedJobIds.includes(j.id)) : candidates;

    const normalize = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');
    const userCity = normalize(user.city);
    const userState = normalize(user.state);

    const preferredRemote = normalize(remotePreference);

    const scored = filteredCandidates
      .map((job) => {
        const jobSkillNames = job.skills.map((js) => js.skill.name.toLowerCase());
        const overlap = jobSkillNames.filter((n) => skillNames.map((x) => x.toLowerCase()).includes(n));
        const overlapRatio = jobSkillNames.length > 0 ? overlap.length / jobSkillNames.length : 0;

        const titleText = job.title || '';
        const descText = job.description || '';

        let score = 0;

        // Skill overlap is primary.
        score += overlapRatio * 60;

        // Keyword relevance (title > description).
        score += calculateRelevanceScore(titleText, userKeywords, { isTitle: true });
        score += calculateRelevanceScore(descText, userKeywords, { isTitle: false });

        // Remote preference signal.
        if (preferredRemote === 'remote') {
          score += job.isRemote ? 25 : -5;
        } else if (preferredRemote === 'onsite') {
          score += job.isRemote ? -5 : 15;
        } else if (preferredRemote === 'hybrid') {
          score += job.isRemote ? 10 : 10;
        }

        // Location signal (lightweight; don't hard-filter).
        const jobCity = normalize(job.city);
        const jobState = normalize(job.state);
        if (userCity && jobCity && jobCity.includes(userCity)) score += 8;
        if (userState && jobState && jobState === userState) score += 6;

        // Small nudge for newer jobs.
        const publishedAt = (job as any).publishedAt ? new Date((job as any).publishedAt).getTime() : 0;
        if (publishedAt) {
          const ageDays = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
          score += Math.max(0, 10 - ageDays);
        }

        return { job, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ job, score }) => ({
      type: 'job' as const,
      id: job.id,
      score,
      title: job.title,
      content: job.description.substring(0, 200),
      highlight: undefined,
      metadata: {
        company: job.organization,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        city: job.city,
        state: job.state,
        companyName: job.organization?.name,
        createdAt: job.createdAt,
      },
    }));
  }

  // 3. Build OpenSearch Query (OpportunityRadar Logic)
  const shouldClauses: any[] = [];

  // Boost A: Skill Match (Highest)
  if (skillNames.length > 0) {
    shouldClauses.push({
      terms: {
        "skills.keyword": skillNames, // Use .keyword for exact term matching or just text field if standard analyzer
        boost: 3.0,
      },
    });
    // Also try text match just in case mapped differently
    shouldClauses.push({
      match: {
        "skills": {
           query: skillNames.join(' '),
           boost: 2.0
        }
      }
    });
  }

  // Boost B: Title/Role Match
  if (user.currentJobTitle || user.role) {
    shouldClauses.push({
      match: {
        title: {
          query: user.currentJobTitle || user.role,
          boost: 2.0,
        },
      },
    });
  }

  // Boost C: Location Match
  if (userLocation) {
    shouldClauses.push({
      multi_match: {
        query: userLocation,
        fields: ['city', 'state', 'location'],
        boost: 1.5,
      },
    });
  }

  // Boost D: Remote Preference
  const pref = typeof remotePreference === 'string' ? remotePreference.toLowerCase() : '';
  if (pref === 'remote') {
    shouldClauses.push({
      term: {
        isRemote: {
          value: true,
          boost: 2.0,
        },
      },
    });
  } else if (pref === 'onsite') {
    shouldClauses.push({
      term: {
        isRemote: {
          value: false,
          boost: 1.0,
        },
      },
    });
  }

  const body = {
    size: limit,
    query: {
      bool: {
        must: [
          { term: { isDraft: false } }
        ],
        should: shouldClauses,
        minimum_should_match: 1, 
      },
    },
  };

  try {
    const response = await client.search({
      index: IndexNames.JOBS,
      body,
    });

    return response.body.hits.hits.map((hit: any) => ({
      type: 'job' as const,
      id: hit._id,
      score: hit._score,
      title: hit._source.title,
      content: hit._source.description?.substring(0, 200),
      highlight: undefined,
      metadata: hit._source,
    }));
  } catch (error) {
    logger.error('Failed to get recommended jobs via OpenSearch', { error });
    return [];
  }
}

// ==========================================
// SEARCH SUGGESTIONS
// ==========================================

/** Nothing shorter than this is a prefix worth matching anything against. */
const MIN_SUGGESTION_PREFIX = 2;

const SUGGESTION_LIMIT = 5;

/**
 * What a member could search for next, taken from what is actually on the
 * platform.
 *
 * Half of this used to be a literal list — 'javascript developer',
 * 'react jobs', 'python tutorial', 'data science' and six more — substring
 * matched against what she had typed and unioned with a genuine skills query,
 * so the two were indistinguishable in the response. It is reached from
 * search() whenever a search returns fewer than five results, which is to say
 * it is shown to a woman at the moment her search found nothing: exactly when
 * a suggestion she cannot act on is worst. Every one of those terms was US
 * tech recruiting and none of them had anything to do with a Queensland
 * women's platform, so following one landed her on an empty page a second
 * time.
 *
 * Every suggestion now names something that exists: a skill a member holds,
 * the title of a job that is open, the title of a course that is running, or
 * a hashtag the community has used this week. If none of those match what she
 * typed, the honest answer is no suggestions rather than a plausible one.
 */
export async function getSearchSuggestions(partialQuery: string): Promise<string[]> {
  const prefix = partialQuery.trim();
  if (prefix.length < MIN_SUGGESTION_PREFIX) return [];

  const cacheKey = CacheKeys.search(`suggestions:${prefix.toLowerCase()}`);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const contains = { contains: prefix, mode: 'insensitive' as const };

      const [skills, jobs, courses, tags] = await Promise.all([
        prisma.skill.findMany({
          where: { name: contains },
          select: { name: true },
          // Skills members actually hold come before skills nobody has
          // claimed, so the list leads with the one most likely to find her
          // somebody.
          orderBy: { users: { _count: 'desc' } },
          take: SUGGESTION_LIMIT,
        }),
        prisma.job.findMany({
          where: { status: 'ACTIVE', title: contains },
          select: { title: true },
          orderBy: { applicationCount: 'desc' },
          take: SUGGESTION_LIMIT,
        }),
        prisma.course.findMany({
          where: { isActive: true, title: contains },
          select: { title: true },
          orderBy: { createdAt: 'desc' },
          take: SUGGESTION_LIMIT,
        }),
        trendingHashtagTerms(),
      ]);

      const lower = prefix.toLowerCase();
      const suggestions = [
        ...skills.map((skill) => skill.name),
        ...jobs.map((job) => job.title),
        ...courses.map((course) => course.title),
        ...tags.filter((tag) => tag.toLowerCase().includes(lower)),
      ];

      // De-duplicated case-insensitively: 'Python' from the skill table and
      // 'python' from a hashtag are one suggestion, not two.
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const suggestion of suggestions) {
        const key = suggestion.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(suggestion.trim());
        if (unique.length === SUGGESTION_LIMIT) break;
      }
      return unique;
    },
    3600 // Cache for 1 hour
  );
}

// ==========================================
// TRENDING SEARCHES
// ==========================================

/**
 * The hashtags the community has used most in the last week, as plain search
 * terms. Counted over real posts and reels by the same aggregation the topics
 * page shows, so a term here always has something behind it.
 *
 * A failure is worth a line in the log and an empty list; trending is a
 * garnish and must not take a search response down with it.
 */
async function trendingHashtagTerms(limit = 8): Promise<string[]> {
  try {
    const { trendingTopics } = await import('../routes/topic.routes');
    const topics = await trendingTopics(7, limit);
    return topics.map((topic) => topic.tag);
  } catch (error) {
    logger.error('Failed to read trending topics for search', { error });
    return [];
  }
}

/**
 * What the community is searching for — or as close to it as this platform
 * can honestly get.
 *
 * This returned a literal array: 'AI jobs', 'remote work', 'tech startup',
 * 'web3', 'product manager', 'data analyst', 'UX designer', 'full stack
 * developer'. Its own comment said a real version would track search queries.
 * Wrapped in a thirty-minute cache, it read to anyone looking at a trace like
 * an aggregation result, and it was served unauthenticated to a Queensland
 * women's platform as if those eight US recruiting terms were what its
 * members were looking for.
 *
 * Nothing on this platform records what was searched for — there is no query
 * log to aggregate, and adding one would mean storing what every member
 * looked for, which is not a thing to do casually on a product used by women
 * hiding from someone. So this answers the nearest question it can answer
 * truthfully: what the community has been tagging this week. When nobody has
 * tagged anything, the list is empty, which is also the truth.
 */
export async function getTrendingSearches(): Promise<string[]> {
  const cacheKey = CacheKeys.search('trending');

  return cacheGetOrSet(cacheKey, async () => trendingHashtagTerms(), 1800);
}

// ==========================================
// OPENSEARCH IMPLEMENTATION
// ==========================================

/**
 * Drops the hits the viewer is not allowed to see.
 *
 * OpenSearch is the primary engine — search() only falls through to Prisma
 * when it errors — and its documents carry none of the safety fields: the
 * indexing calls live in the route files that write users and posts, and none
 * of them writes hideFromSearch, isPublic or a block list. Filtering in the
 * query would therefore have filtered on nothing.
 *
 * So the hits are confirmed against the database instead, with the same
 * clauses the Prisma searchers use. It costs one small `id IN (...)` lookup
 * per hit type per page, and it cannot fail open the way an index that somebody
 * forgot to re-index after a safety switch was flipped would: a document that
 * is stale, or that was indexed before any of these rules existed, is checked
 * against the row as it is now.
 */
async function allowedOpenSearchHits(hits: any[], viewer: ViewerContext): Promise<any[]> {
  const idsOfType = (wanted: SearchResult['type']) =>
    hits.filter((hit) => mapIndexToType(hit._index) === wanted).map((hit) => String(hit._id));

  const userIds = idsOfType('user');
  const mentorIds = idsOfType('mentor');
  const postIds = idsOfType('post');

  const postConditions: Prisma.PostWhereInput[] = [
    { id: { in: postIds } },
    { isHidden: false, isPublic: true },
    authorAudienceWhere(viewer.viewerId, viewer.followingIds),
  ];
  if (viewer.blockedIds.length > 0) postConditions.push({ authorId: { notIn: viewer.blockedIds } });
  if (viewer.viewerId) {
    postConditions.push({ NOT: { author: { dvSafetyProfile: { is: { blockedUserIds: { has: viewer.viewerId } } } } } });
  }

  const [users, mentors, posts] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { AND: [{ id: { in: userIds }, isActive: true }, hiddenMemberWhere(viewer)] }, select: { id: true } })
      : Promise.resolve([]),
    mentorIds.length
      ? prisma.mentorProfile.findMany({ where: { id: { in: mentorIds }, user: hiddenMemberWhere(viewer) }, select: { id: true } })
      : Promise.resolve([]),
    postIds.length ? prisma.post.findMany({ where: { AND: postConditions }, select: { id: true } }) : Promise.resolve([]),
  ]);

  const allowed = new Set([...users, ...mentors, ...posts].map((row) => row.id));

  return hits.filter((hit) => {
    const kind = mapIndexToType(hit._index);
    // Jobs, courses and videos are not member-visibility material: they belong
    // to organisations and to published catalogues, and none of the three
    // switches above applies to them.
    if (kind !== 'user' && kind !== 'mentor' && kind !== 'post') return true;
    return allowed.has(String(hit._id));
  });
}

async function searchWithOpenSearch(client: any, options: SearchOptions, viewer: ViewerContext): Promise<SearchResponse> {
  const { query, type = 'all', page = 1, limit = 20 } = options;
  const from = (page - 1) * limit;

  // Determine indices to search
  let indices: string[] = [];
  if (type === 'all') indices = Object.values(IndexNames);
  else if (type === 'users') indices = [IndexNames.USERS];
  else if (type === 'jobs') indices = [IndexNames.JOBS];
  else if (type === 'posts') indices = [IndexNames.POSTS];
  else if (type === 'courses') indices = [IndexNames.COURSES];
  else if (type === 'videos') indices = [IndexNames.VIDEOS];
  else if (type === 'mentors') indices = [IndexNames.MENTORS];

  const body = {
    from,
    size: limit,
    query: {
      multi_match: {
        query,
        fields: ['title^3', 'displayName^3', 'description', 'content', 'bio', 'skills'],
        fuzziness: 'AUTO',
      },
    },
    highlight: {
      fields: {
        description: {},
        content: {},
        bio: {},
      },
    },
  };

  const response = await client.search({
    index: indices,
    body,
  });

  const rawHits = response.body.hits.hits;
  const hits = await allowedOpenSearchHits(rawHits, viewer);
  // The engine's total less what this page was not allowed to show. It stays an
  // estimate for the pages nobody has asked for yet, which is the honest
  // answer: the alternative is reporting a count that includes people who have
  // asked not to be found.
  const total = Math.max(0, response.body.hits.total.value - (rawHits.length - hits.length));

  const results: SearchResult[] = hits.map((hit: any) => ({
    type: mapIndexToType(hit._index),
    id: hit._id,
    score: hit._score,
    title: hit._source.title || hit._source.displayName,
    content: hit._source.description || hit._source.content || hit._source.bio,
    highlight: hit.highlight ? Object.values(hit.highlight).join(' ... ') : undefined,
    metadata: hit._source,
  }));

  return {
    results,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    query,
  };
}

function mapIndexToType(index: string): SearchResult['type'] {
  if (index === IndexNames.USERS) return 'user';
  if (index === IndexNames.JOBS) return 'job';
  if (index === IndexNames.POSTS) return 'post';
  if (index === IndexNames.COURSES) return 'course';
  if (index === IndexNames.VIDEOS) return 'video';
  if (index === IndexNames.MENTORS) return 'mentor';
  return 'post'; // default
}

