/**
 * Cold Start Algorithm Service
 * Handles new users with no history using demographic-based recommendations
 * Phase 2: Backend Logic & Integrations
 */

import { prisma } from '../utils/prisma';
import { Persona, type Prisma } from '@prisma/client';
import { hiddenMemberWhere, viewerContextFor, type ViewerContext } from './search.service';
import { authorAudienceWhere } from './audience.service';
import { getMentorMatch } from './algorithm.service';

// ==========================================
// TYPES
// ==========================================

export interface ColdStartProfile {
  userId: string;
  persona?: Persona;
  interests: string[];
  skills: string[];
  location?: string;
  industry?: string;
  careerLevel?: 'ENTRY' | 'MID' | 'SENIOR' | 'EXECUTIVE';
  goals: string[];
}

export interface ColdStartRecommendation {
  type: 'JOB' | 'COURSE' | 'MENTOR' | 'POST' | 'USER' | 'GROUP';
  id: string;
  title: string;
  reason: string;
  score: number;
  data: any;
}

// ==========================================
// DEMOGRAPHIC PROFILES
// ==========================================

// Popular content for each persona
const PERSONA_DEFAULTS: Record<Persona, {
  interests: string[];
  recommendedSkills: string[];
  contentTypes: string[];
}> = {
  EARLY_CAREER: {
    interests: ['career development', 'networking', 'skill building', 'interview tips'],
    recommendedSkills: ['Communication', 'Problem Solving', 'Time Management', 'Teamwork'],
    contentTypes: ['educational', 'career_tips', 'success_stories'],
  },
  MID_CAREER: {
    interests: ['leadership', 'work-life balance', 'salary negotiation', 'career transition'],
    recommendedSkills: ['Leadership', 'Project Management', 'Strategic Thinking', 'Mentoring'],
    contentTypes: ['industry_insights', 'leadership', 'professional_development'],
  },
  ENTREPRENEUR: {
    interests: ['startup', 'funding', 'business growth', 'networking'],
    recommendedSkills: ['Business Development', 'Financial Management', 'Marketing', 'Sales'],
    contentTypes: ['entrepreneurship', 'funding', 'business_tips'],
  },
  CREATOR: {
    interests: ['content creation', 'personal branding', 'monetization', 'audience growth'],
    recommendedSkills: ['Content Strategy', 'Video Production', 'Social Media', 'Storytelling'],
    contentTypes: ['creator_tips', 'monetization', 'platform_growth'],
  },
  MENTOR: {
    interests: ['coaching', 'leadership', 'giving back', 'professional development'],
    recommendedSkills: ['Coaching', 'Active Listening', 'Goal Setting', 'Feedback'],
    contentTypes: ['mentorship', 'coaching', 'leadership'],
  },
  EDUCATION_PROVIDER: {
    interests: ['curriculum design', 'online learning', 'student engagement', 'EdTech'],
    recommendedSkills: ['Instructional Design', 'Assessment', 'E-learning', 'Facilitation'],
    contentTypes: ['education', 'teaching', 'EdTech'],
  },
  EMPLOYER: {
    interests: ['talent acquisition', 'employer branding', 'diversity hiring', 'retention'],
    recommendedSkills: ['Recruiting', 'Employer Branding', 'Interview Skills', 'DEI'],
    contentTypes: ['recruiting', 'talent', 'workplace_culture'],
  },
  REAL_ESTATE: {
    interests: ['property investment', 'market trends', 'housing', 'commercial real estate'],
    recommendedSkills: ['Market Analysis', 'Negotiation', 'Property Management', 'Investment'],
    contentTypes: ['real_estate', 'investment', 'market_trends'],
  },
  GOVERNMENT_NGO: {
    interests: ['social impact', 'policy', 'community development', 'nonprofit management'],
    recommendedSkills: ['Grant Writing', 'Policy Analysis', 'Community Engagement', 'Program Management'],
    contentTypes: ['social_impact', 'policy', 'community'],
  },
};

// ==========================================
// COLD START DETECTION
// ==========================================

/**
 * Determine if a user is in "cold start" mode
 */
export async function isUserColdStart(userId: string): Promise<boolean> {
  const [interactions, profileCompletion] = await Promise.all([
    // Check interaction count
    prisma.like.count({ where: { userId } }),
    // Check profile completion
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        persona: true,
        currentJobTitle: true,
        profile: { select: { aboutMe: true } },
        skills: { select: { id: true } },
      },
    }),
  ]);
  
  // Cold start if:
  // - Less than 10 interactions
  // - No persona set
  // - Less than 3 skills
  const hasFewInteractions = interactions < 10;
  const hasNoPersona = !profileCompletion?.persona;
  const hasFewSkills = (profileCompletion?.skills?.length || 0) < 3;
  
  return hasFewInteractions || hasNoPersona || hasFewSkills;
}

/**
 * Get cold start score (0-100, higher = more cold start)
 */
export async function getColdStartScore(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      skills: true,
      _count: {
        select: {
          likes: true,
          posts: true,
          comments: true,
          following: true,
        },
      },
    },
  });
  
  if (!user) return 100;
  
  let score = 100;
  
  // Profile completion
  if (user.persona) score -= 15;
  if (user.currentJobTitle) score -= 10;
  if (user.profile?.aboutMe) score -= 10;
  if (user.skills.length >= 3) score -= 15;
  if (user.skills.length >= 5) score -= 10;
  
  // Interaction history
  if (user._count.likes >= 5) score -= 10;
  if (user._count.likes >= 20) score -= 10;
  if (user._count.posts >= 1) score -= 5;
  if (user._count.comments >= 5) score -= 5;
  if (user._count.following >= 5) score -= 10;
  
  return Math.max(0, score);
}

// ==========================================
// COLD START RECOMMENDATIONS
// ==========================================

/** "EARLY_CAREER" -> "early career", every underscore, not just the first. */
const personaLabel = (persona: Persona) => persona.toLowerCase().split('_').join(' ');

/**
 * The picks behind "New here? Start with these" on the feed (StartHereRail,
 * read through GET /api/feed/cold-start).
 *
 * ## It failed for everyone, and once it worked it would have shown the wrong people
 *
 * The job query filtered on `location` and `experienceLevel`, neither of which
 * is a Job column. User.country defaults to "Australia", so `location` was set
 * for every member and Prisma refused every call: the rail never had anything
 * to show. Fixing that alone would have put four unsafe picks in front of
 * every new member, so they are fixed with it:
 *
 *  - "People to meet" returned any active member of her persona with a post.
 *    It ignored "hide me from search", blocks in either direction and private
 *    profiles, so a woman who had hidden herself, or who had blocked the man
 *    she left, could be offered to him (or him to her) as someone to meet,
 *    with a link to the profile.
 *  - "A mentor in your field" had the same gaps, and was ordered by
 *    MentorProfile.rating, which has no writer. It now comes from
 *    getMentorMatch, which already leaves those people out and ranks by the
 *    skills they share and years of experience.
 *  - "Worth reading" took public posts with no regard for the author's
 *    audience setting or the viewer's blocks.
 *  - "A circle to join" could be a group moderators had hidden.
 *
 * Every reason now says what the pick was chosen for and nothing more. The
 * per-type `score` is an ordering between the groups, not a measurement; the
 * client drops it before anything renders (toStartHerePicks in lib/hooks.ts).
 */
export async function getColdStartRecommendations(
  userId: string,
  limit: number = 20
): Promise<ColdStartRecommendation[]> {
  const [user, viewer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: true } },
      },
    }),
    viewerContextFor(userId),
  ]);

  if (!user) return [];

  const persona = user.persona || 'EARLY_CAREER';
  const label = personaLabel(persona);
  const personaDefaults = PERSONA_DEFAULTS[persona];
  const userSkills = user.skills.map((s) => s.skill.name.toLowerCase());

  const recommendations: ColdStartRecommendation[] = [];

  // 1. Posts from members at her stage this week
  const popularPosts = await getPopularPostsForPersona(persona, 5, viewer);
  recommendations.push(...popularPosts.map((post) => ({
    type: 'POST' as const,
    id: post.id,
    title: post.content?.slice(0, 100) || 'Post',
    // What the query checked: the author shares her persona and posted in the
    // last seven days. It was "Popular in the ... community" for a post with
    // no likes at all.
    reason: `From the ${label} community this week`,
    score: 80,
    data: post,
  })));

  // 2. Courses whose titles name a skill common at her stage that she has not listed
  const recommendedSkills = personaDefaults.recommendedSkills.filter(
    (s) => !userSkills.includes(s.toLowerCase())
  );

  if (recommendedSkills.length > 0) {
    const courses = await getCoursesForSkills(recommendedSkills, 3);
    recommendations.push(...courses.map((course) => {
      const covers = recommendedSkills.find((skill) => course.title.toLowerCase().includes(skill.toLowerCase()));
      return {
        type: 'COURSE' as const,
        id: course.id,
        title: course.title,
        reason: covers ? `Covers ${covers}, which is not on your profile yet` : 'Course on ATHENA',
        score: 85,
        data: course,
      };
    }));
  }

  // 3. Roles, in her city first
  const jobs = await getJobsForPersona(persona, user.city ?? undefined, 4);
  recommendations.push(...jobs.map(({ job, inHerCity }) => ({
    type: 'JOB' as const,
    id: job.id,
    title: job.title,
    reason: inHerCity && job.city ? `In ${job.city}` : 'Recently posted role',
    score: 75,
    data: job,
  })));

  // 4. Mentors, ranked and filtered exactly as Mentor Match ranks and filters them
  const { mentors } = await getMentorMatch(userId, viewer);
  recommendations.push(...mentors.slice(0, 3).map((mentor) => ({
    type: 'MENTOR' as const,
    id: mentor.id,
    title: mentor.name,
    reason: mentor.matchReasons[0] ?? 'Taking new mentees',
    score: 70,
    data: mentor,
  })));

  // 5. Members at the same stage who post
  const usersToFollow = await getSuggestedUsersForPersona(userId, persona, 5, viewer);
  recommendations.push(...usersToFollow.map((u) => ({
    type: 'USER' as const,
    id: u.id,
    title: u.displayName || 'Member',
    reason: 'Same career stage as you',
    score: 65,
    data: u,
  })));

  // 6. Public circles on topics common at her stage
  const groups = await getGroupsForPersona(userId, persona, 3, viewer);
  recommendations.push(...groups.map((group) => ({
    type: 'GROUP' as const,
    id: group.id,
    title: group.name,
    reason: 'Public circle, open to join',
    score: 60,
    data: group,
  })));

  // Sort by score and limit
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ==========================================
// DATA FETCHERS
// ==========================================

/**
 * Who may appear in a new member's picks at all: not her, not anyone on either
 * side of a block, not anyone who asked to be hidden from search
 * (hiddenMemberWhere reads both stores of that switch), and not a suspended
 * account.
 */
function discoverableMemberWhere(viewer: ViewerContext): Prisma.UserWhereInput {
  return {
    isSuspended: false,
    ...(viewer.viewerId && { id: { not: viewer.viewerId } }),
    AND: [hiddenMemberWhere(viewer)],
  };
}

async function getPopularPostsForPersona(persona: Persona, limit: number, viewer: ViewerContext) {
  return prisma.post.findMany({
    where: {
      isPublic: true,
      isHidden: false,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      author: { persona, ...discoverableMemberWhere(viewer) },
      // The author's audience setting, as every feed applies it: public
      // authors, and connections-only authors she follows. Never a group post.
      AND: [authorAudienceWhere(viewer.viewerId, viewer.followingIds)],
    },
    orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
    take: limit,
    include: {
      author: { select: { displayName: true, avatar: true } },
    },
  });
}

async function getCoursesForSkills(skills: string[], limit: number) {
  return prisma.course.findMany({
    where: {
      isActive: true,
      OR: skills.map((skill) => ({
        title: { contains: skill, mode: 'insensitive' as const },
      })),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      organization: { select: { name: true } },
    },
  });
}

/**
 * Active roles, newest first. An early-career member is shown the kinds of
 * role that take people starting out, and roles asking for no more than two
 * years. With a city on her profile, roles there come first, and only those
 * are described as being there; the rest are topped up from anywhere.
 */
async function getJobsForPersona(persona: Persona, city: string | undefined, limit: number) {
  const base: Prisma.JobWhereInput = { status: 'ACTIVE' };
  if (persona === 'EARLY_CAREER') {
    base.type = { in: ['FULL_TIME', 'INTERNSHIP', 'APPRENTICESHIP'] };
    base.OR = [{ experienceMin: null }, { experienceMin: { lte: 2 } }];
  }

  const local = city
    ? await prisma.job.findMany({
        where: { ...base, city: { equals: city, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { organization: { select: { name: true, logo: true } } },
      })
    : [];

  const rest =
    local.length < limit
      ? await prisma.job.findMany({
          where: { ...base, id: { notIn: local.map((job) => job.id) } },
          orderBy: { createdAt: 'desc' },
          take: limit - local.length,
          include: { organization: { select: { name: true, logo: true } } },
        })
      : [];

  return [
    ...local.map((job) => ({ job, inHerCity: true })),
    ...rest.map((job) => ({ job, inHerCity: false })),
  ];
}

async function getSuggestedUsersForPersona(
  userId: string,
  persona: Persona,
  limit: number,
  viewer: ViewerContext
) {
  return prisma.user.findMany({
    where: {
      persona,
      isActive: true,
      // Has some activity
      posts: { some: {} },
      AND: [
        discoverableMemberWhere(viewer),
        // Someone she already follows is not someone new to meet.
        { id: { notIn: [userId, ...viewer.followingIds] } },
        // A private profile is closed to strangers, and offering one to
        // strangers as a person to meet is the discovery she switched off.
        { NOT: { safetySettings: { is: { profileVisibility: 'private' } } } },
      ],
    },
    orderBy: { lastLoginAt: 'desc' },
    take: limit,
    select: {
      id: true,
      displayName: true,
      avatar: true,
      headline: true,
      _count: { select: { posts: true, followers: true } },
    },
  });
}

async function getGroupsForPersona(userId: string, persona: Persona, limit: number, viewer: ViewerContext) {
  // Map persona to group categories
  const categoryMap: Partial<Record<Persona, string[]>> = {
    EARLY_CAREER: ['career', 'networking', 'skills'],
    ENTREPRENEUR: ['startup', 'business', 'funding'],
    CREATOR: ['content', 'creator', 'social media'],
  };

  const categories = categoryMap[persona] || ['general'];

  return prisma.group.findMany({
    where: {
      privacy: 'PUBLIC',
      // Hidden by moderators, already hers, or started by someone on the
      // other side of a block.
      isHidden: false,
      members: { none: { userId } },
      ...(viewer.blockedIds.length > 0 && { createdById: { notIn: viewer.blockedIds } }),
      OR: categories.map((cat) => ({
        name: { contains: cat, mode: 'insensitive' as const },
      })),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { members: true } },
    },
  });
}

// ==========================================
// ONBOARDING SUGGESTIONS
// ==========================================

/**
 * Get personalized onboarding steps for cold start user
 */
export async function getOnboardingSuggestions(userId: string): Promise<{
  step: string;
  action: string;
  priority: number;
}[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      skills: true,
      _count: {
        select: {
          following: true,
          posts: true,
        },
      },
    },
  });
  
  if (!user) return [];
  
  const suggestions: { step: string; action: string; priority: number }[] = [];
  
  // Profile completion
  if (!user.persona) {
    suggestions.push({
      step: 'Select your persona',
      action: '/onboarding/persona',
      priority: 1,
    });
  }
  
  if (!user.profile?.aboutMe) {
    suggestions.push({
      step: 'Add a bio',
      action: '/settings/profile',
      priority: 2,
    });
  }
  
  if (user.skills.length < 3) {
    suggestions.push({
      step: 'Add your skills',
      action: '/settings/skills',
      priority: 3,
    });
  }
  
  if (!user.avatar) {
    suggestions.push({
      step: 'Upload a profile photo',
      action: '/settings/profile',
      priority: 4,
    });
  }
  
  // Social engagement
  if (user._count.following < 5) {
    suggestions.push({
      step: 'Follow 5 people in your field',
      action: '/discover/people',
      priority: 5,
    });
  }
  
  if (user._count.posts === 0) {
    suggestions.push({
      step: 'Create your first post',
      action: '/compose',
      priority: 6,
    });
  }
  
  return suggestions.sort((a, b) => a.priority - b.priority);
}

export const coldStartAlgorithm = {
  isUserColdStart,
  getColdStartScore,
  getColdStartRecommendations,
  getOnboardingSuggestions,
};
