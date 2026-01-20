/**
 * Search Service
 * Advanced search with relevance ranking and filtering
 */

import { prisma } from '../utils/prisma';
import { PostType } from '@prisma/client';
import { cacheGetOrSet, CacheKeys } from '../utils/cache';
import { getOpenSearchClient, IndexNames } from '../utils/opensearch';
import { logger } from '../utils/logger';

// ==========================================
// TYPES
// ==========================================

export interface SearchOptions {
  query: string;
  type?: 'all' | 'users' | 'posts' | 'jobs' | 'courses' | 'videos' | 'mentors';
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
    // Exact match bonus
    if (lowerText.includes(keyword)) {
      score += 10;
      
      // Word boundary match (more specific)
      const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordBoundaryRegex.test(text)) {
        score += 5;
      }
      
      // Count occurrences (diminishing returns)
      const occurrences = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
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
// SEARCH FUNCTIONS
// ==========================================

export async function search(options: SearchOptions): Promise<SearchResponse> {
  const openSearch = getOpenSearchClient();
  if (openSearch) {
    try {
      return await searchWithOpenSearch(openSearch, options);
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
      searchUsers(keywords, filters, persona).then((r) => { results.push(...r); })
    );
  }

  if (type === 'all' || type === 'posts') {
    searchPromises.push(
      searchPosts(keywords, filters).then((r) => { results.push(...r); })
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
      searchMentors(keywords, filters, persona).then((r) => { results.push(...r); })
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
  persona?: string
): Promise<SearchResult[]> {
  const users = await prisma.user.findMany({
    where: {
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
    include: {
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

async function searchPosts(
  keywords: string[],
  filters: SearchOptions['filters']
): Promise<SearchResult[]> {
  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      OR: [
        ...keywords.map((kw) => ({ content: { contains: kw, mode: 'insensitive' as const } })),
      ],
      ...(filters?.postType && Object.values(PostType).includes(filters.postType as any) && { type: filters.postType as any }),
      ...(filters?.hasMedia && {
        OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }],
      }),
    },
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
  persona?: string
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
    let personaBoost = 1;

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
        ...keywords.flatMap((kw) => [
          { title: { contains: kw, mode: 'insensitive' as const } },
          { description: { contains: kw, mode: 'insensitive' as const } },
        ]),
      ],
    },
    include: {
      author: { select: { id: true, displayName: true, avatar: true } },
    },
    take: 50,
  });

  return videos.map((video) => {
    const searchableText = [video.title, video.description, video.hashtags?.join(' ')].filter(Boolean).join(' ');
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

async function searchMentors(
  keywords: string[],
  _filters: SearchOptions['filters'],
  persona?: string
): Promise<SearchResult[]> {
  const mentors = await prisma.mentorProfile.findMany({
    where: {
      isAvailable: true,
      user: {
        isActive: true,
        OR: [
          ...keywords.flatMap((kw) => [
            { displayName: { contains: kw, mode: 'insensitive' as const } },
            { headline: { contains: kw, mode: 'insensitive' as const } },
            { bio: { contains: kw, mode: 'insensitive' as const } },
          ]),
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
      id: mentor.userId,
      score,
      title: mentor.user.displayName || 'Mentor',
      content: mentor.user.headline || mentor.user.bio || '',
      highlight: highlightMatch(searchableText, keywords),
      metadata: {
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

export async function getSearchSuggestions(partialQuery: string): Promise<string[]> {
  const cacheKey = CacheKeys.search(`suggestions:${partialQuery.toLowerCase()}`);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const suggestions: string[] = [];

      // Popular searches
      const popularSearches = [
        'javascript developer',
        'react jobs',
        'python tutorial',
        'data science',
        'machine learning',
        'web development',
        'mobile app',
        'ui/ux design',
        'product management',
        'startup jobs',
      ];

      // Filter by partial match
      const matching = popularSearches.filter((s) =>
        s.toLowerCase().includes(partialQuery.toLowerCase())
      );
      suggestions.push(...matching.slice(0, 5));

      // Add skill-based suggestions
      const skills = await prisma.user.findMany({
        where: {
          skills: { some: { skill: { name: { contains: partialQuery, mode: 'insensitive' } } } },
        },
        select: { skills: { select: { skill: { select: { name: true } } } } },
        take: 10,
      });

      const relatedSkills = new Set<string>();
      skills.forEach((u) => u.skills.forEach((s) => relatedSkills.add(s.skill.name)));
      suggestions.push(...Array.from(relatedSkills).slice(0, 3));

      return [...new Set(suggestions)].slice(0, 5);
    },
    3600 // Cache for 1 hour
  );
}

// ==========================================
// TRENDING SEARCHES
// ==========================================

export async function getTrendingSearches(): Promise<string[]> {
  const cacheKey = CacheKeys.search('trending');

  return cacheGetOrSet(
    cacheKey,
    async () => {
      // In production, this would track actual search queries
      // For now, return curated trending topics
      return [
        'AI jobs',
        'remote work',
        'tech startup',
        'web3',
        'product manager',
        'data analyst',
        'UX designer',
        'full stack developer',
      ];
    },
    1800 // Cache for 30 minutes
  );
}

// ==========================================
// OPENSEARCH IMPLEMENTATION
// ==========================================

async function searchWithOpenSearch(client: any, options: SearchOptions): Promise<SearchResponse> {
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

  const hits = response.body.hits.hits;
  const total = response.body.hits.total.value;

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

