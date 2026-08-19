import type { Job } from './types';

export interface PublicFallbackFeedPost {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    headline?: string;
    profileImage?: string;
    profileHref?: string;
  };
  _count?: {
    likes: number;
    comments: number;
  };
  likes?: { userId: string }[];
  media?: { url: string; type: string }[];
}

export interface PublicFallbackVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    displayName?: string;
    headline?: string;
  };
}

export const FALLBACK_JOBS: Job[] = [
  {
    id: 'spotlight-product-ops',
    title: 'Product Operations Lead',
    slug: 'product-operations-lead',
    description:
      'Build launch systems, close feedback loops, and coordinate cross-functional delivery across product, support, and growth teams.',
    postedById: 'athena-demo',
    type: 'FULL_TIME',
    status: 'ACTIVE',
    city: 'Perth',
    state: 'WA',
    country: 'Australia',
    isRemote: true,
    salaryMin: 120000,
    salaryMax: 145000,
    showSalary: true,
    viewCount: 0,
    applicationCount: 0,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    publishedAt: '2026-04-12T08:00:00.000Z',
    organization: {
      id: 'org-athena',
      name: 'ATHENA Labs',
      slug: 'athena-labs',
      country: 'Australia',
      industry: 'Career Technology',
      isVerified: true,
      safetyScore: 98,
      website: 'https://athena-empress.netlify.app',
      city: 'Perth',
      state: 'WA',
    },
  },
  {
    id: 'spotlight-growth-marketing',
    title: 'Growth Marketing Strategist',
    slug: 'growth-marketing-strategist',
    description:
      'Own lifecycle campaigns, referral experiments, and creator partnerships focused on women building long-term career momentum.',
    postedById: 'athena-demo',
    type: 'CONTRACT',
    status: 'ACTIVE',
    city: 'Sydney',
    state: 'NSW',
    country: 'Australia',
    isRemote: true,
    salaryMin: 90000,
    salaryMax: 115000,
    showSalary: true,
    viewCount: 0,
    applicationCount: 0,
    createdAt: '2026-04-02T08:00:00.000Z',
    updatedAt: '2026-04-02T08:00:00.000Z',
    publishedAt: '2026-04-10T08:00:00.000Z',
    organization: {
      id: 'org-lighthouse',
      name: 'Lighthouse Studio',
      slug: 'lighthouse-studio',
      country: 'Australia',
      industry: 'Digital Strategy',
      isVerified: true,
      safetyScore: 94,
      city: 'Sydney',
      state: 'NSW',
    },
  },
  {
    id: 'spotlight-community-partnerships',
    title: 'Community Partnerships Manager',
    slug: 'community-partnerships-manager',
    description:
      'Shape partner activations, mentorship experiences, and regional events that bring trusted opportunities into the ATHENA ecosystem.',
    postedById: 'athena-demo',
    type: 'PART_TIME',
    status: 'ACTIVE',
    city: 'Melbourne',
    state: 'VIC',
    country: 'Australia',
    isRemote: false,
    salaryMin: 70000,
    salaryMax: 90000,
    showSalary: true,
    viewCount: 0,
    applicationCount: 0,
    createdAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-03T08:00:00.000Z',
    publishedAt: '2026-04-08T08:00:00.000Z',
    organization: {
      id: 'org-rise',
      name: 'Rise Collective',
      slug: 'rise-collective',
      country: 'Australia',
      industry: 'Community & Partnerships',
      isVerified: true,
      safetyScore: 96,
      city: 'Melbourne',
      state: 'VIC',
    },
  },
];

export const FALLBACK_POSTS: PublicFallbackFeedPost[] = [
  {
    id: 'fallback-post-1',
    content:
      'Career momentum grows faster when job search, mentorship, community, and AI support all live in one place. What part of your next chapter are you focusing on this month?',
    createdAt: '2026-04-16T09:00:00.000Z',
    author: {
      id: 'athena-team',
      firstName: 'ATHENA',
      lastName: 'Team',
      headline: 'Platform updates and launch notes',
      profileHref: '/feed',
    },
    _count: {
      likes: 28,
      comments: 6,
    },
    likes: [],
  },
  {
    id: 'fallback-post-2',
    content:
      'Women in product, operations, and growth are sharing interview prep wins inside the ATHENA network this week. Light mode is available, but the platform now ships dark-first by default.',
    createdAt: '2026-04-15T14:30:00.000Z',
    author: {
      id: 'launch-mentor',
      firstName: 'Maya',
      lastName: 'Chen',
      headline: 'Startup mentor and operator',
      profileHref: '/mentors',
    },
    _count: {
      likes: 41,
      comments: 9,
    },
    likes: [],
  },
  {
    id: 'fallback-post-3',
    content:
      'If the live feed is still syncing, use this space as a quick orientation hub: check jobs, explore mentors, and open the floating AI assistant for guidance on resumes, interviews, and strategy.',
    createdAt: '2026-04-14T18:45:00.000Z',
    author: {
      id: 'community-guide',
      firstName: 'Nadia',
      lastName: 'Brooks',
      headline: 'Community success lead',
      profileHref: '/help/community-guidelines',
    },
    _count: {
      likes: 33,
      comments: 4,
    },
    likes: [],
  },
];

export const FALLBACK_VIDEOS: PublicFallbackVideo[] = [
  {
    id: 'fallback-video-1',
    title: 'Three ways to reset your job search rhythm',
    description:
      'Use a weekly scorecard, tighten your story, and let ATHENA AI help you practice before interviews.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
    duration: 24,
    likes: 182,
    comments: 14,
    shares: 9,
    isLiked: false,
    author: {
      id: 'creator-athena',
      firstName: 'ATHENA',
      lastName: 'Coach',
      displayName: 'ATHENA Coach',
      headline: 'Career strategy and momentum systems',
    },
  },
  {
    id: 'fallback-video-2',
    title: 'How to talk about your wins without underselling them',
    description:
      'A quick interview framing guide for product, operations, and growth roles.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80',
    duration: 31,
    likes: 241,
    comments: 19,
    shares: 17,
    isLiked: false,
    author: {
      id: 'creator-maya',
      firstName: 'Maya',
      lastName: 'Chen',
      displayName: 'Maya Chen',
      headline: 'Startup mentor and operator',
    },
  },
  {
    id: 'fallback-video-3',
    title: 'Build momentum when the backend is still reconnecting',
    description:
      'Jobs, mentors, community, and AI guidance should still feel usable while live systems recover.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    duration: 28,
    likes: 129,
    comments: 8,
    shares: 5,
    isLiked: false,
    author: {
      id: 'creator-nadia',
      firstName: 'Nadia',
      lastName: 'Brooks',
      displayName: 'Nadia Brooks',
      headline: 'Community success lead',
    },
  },
];

interface JobFilterParams {
  search: string;
  location: string;
  type: string;
  isRemote: boolean;
}

export function isFallbackJobId(id?: string | null) {
  return typeof id === 'string' && id.startsWith('spotlight-');
}

export function isFallbackPostId(id?: string | null) {
  return typeof id === 'string' && id.startsWith('fallback-post-');
}

export function isFallbackVideoId(id?: string | null) {
  return typeof id === 'string' && id.startsWith('fallback-video-');
}

export function filterFallbackJobs(jobs: Job[], params: JobFilterParams) {
  const searchNeedle = params.search.trim().toLowerCase();
  const locationNeedle = params.location.trim().toLowerCase();

  return jobs.filter((job) => {
    if (params.type && job.type !== params.type) {
      return false;
    }

    if (params.isRemote && !job.isRemote) {
      return false;
    }

    if (
      searchNeedle &&
      !`${job.title} ${job.description} ${job.organization?.name || ''}`
        .toLowerCase()
        .includes(searchNeedle)
    ) {
      return false;
    }

    if (
      locationNeedle &&
      !`${job.city || ''} ${job.state || ''} ${job.country}`
        .toLowerCase()
        .includes(locationNeedle)
    ) {
      return false;
    }

    return true;
  });
}

export function findFallbackJob(id?: string | null) {
  return FALLBACK_JOBS.find((job) => job.id === id) || null;
}

export function findFallbackVideo(id?: string | null) {
  return FALLBACK_VIDEOS.find((video) => video.id === id) || null;
}

type SearchType = 'all' | 'users' | 'posts' | 'jobs' | 'courses' | 'videos' | 'mentors';

function matchesNeedle(parts: Array<string | undefined>, needle: string) {
  if (!needle) {
    return true;
  }

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function buildFallbackSearchResults(query: string, type: SearchType = 'all', limit = 25) {
  const needle = query.trim().toLowerCase();
  const include = (resultType: SearchType) => type === 'all' || type === resultType;

  const results = [
    ...(
      include('jobs')
        ? FALLBACK_JOBS.filter((job) =>
            matchesNeedle(
              [job.title, job.description, job.organization?.name, job.city, job.state],
              needle
            )
          ).map((job) => ({
            id: job.id,
            type: 'job' as const,
            title: job.title,
            content: job.description,
            metadata: {
              city: job.city,
              state: job.state,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              createdAt: job.publishedAt,
              company: {
                name: job.organization?.name,
                logo: job.organization?.logo,
              },
            },
          }))
        : []
    ),
    ...(
      include('posts')
        ? FALLBACK_POSTS.filter((post) =>
            matchesNeedle(
              [post.content, post.author.firstName, post.author.lastName, post.author.headline],
              needle
            )
          ).map((post) => ({
            id: post.id,
            type: 'post' as const,
            title: `${post.author.firstName} ${post.author.lastName}`.trim(),
            content: post.content,
            metadata: {
              author: {
                displayName: `${post.author.firstName} ${post.author.lastName}`.trim(),
              },
              likeCount: post._count?.likes,
              commentCount: post._count?.comments,
            },
          }))
        : []
    ),
    ...(
      include('videos')
        ? FALLBACK_VIDEOS.filter((video) =>
            matchesNeedle(
              [video.title, video.description, video.author.displayName, video.author.headline],
              needle
            )
          ).map((video) => ({
            id: video.id,
            type: 'video' as const,
            title: video.title,
            content: video.description,
            metadata: {
              thumbnailUrl: video.thumbnailUrl,
              duration: video.duration,
              viewCount: video.likes * 11,
              author: {
                displayName:
                  video.author.displayName ||
                  `${video.author.firstName} ${video.author.lastName}`.trim(),
              },
            },
          }))
        : []
    ),
    ...(
      include('mentors')
        ? [
            {
              id: 'fallback-mentor-maya',
              type: 'mentor' as const,
              title: 'Maya Chen',
              content:
                'Startup mentor for operators and women building career momentum through product, growth, and leadership.',
              metadata: {
                headline: 'Startup mentor and operator',
                rating: 4.9,
                sessionCount: 124,
                avatar: '',
              },
            },
          ].filter((mentor) => matchesNeedle([mentor.title, mentor.content, mentor.metadata.headline as string], needle))
        : []
    ),
    ...(
      include('users')
        ? [
            {
              id: 'fallback-user-athena',
              type: 'user' as const,
              title: 'ATHENA Team',
              content: 'Platform updates, launch guidance, and trusted navigation across jobs, community, and AI.',
              metadata: {
                followers: 4200,
              },
            },
          ].filter((user) => matchesNeedle([user.title, user.content], needle))
        : []
    ),
  ].slice(0, limit);

  return {
    results,
    total: results.length,
    page: 1,
    totalPages: results.length > 0 ? 1 : 0,
    suggestions: ['Product Operations', 'Mentorship', 'Remote roles', 'AI career coach'],
  };
}

export function getFallbackHealthPayload() {
  return {
    success: true,
    status: 'degraded',
    source: 'frontend-fallback',
    frontend: 'ok',
    backend: 'unavailable',
    message: 'Public site is serving curated fallback data while the backend reconnects.',
  };
}
