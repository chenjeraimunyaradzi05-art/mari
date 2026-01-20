import { prisma } from '../utils/prisma';

export interface CareerCompassResult {
  targetRole: string;
  persona?: string | null;
  skillGaps: string[];
  recommendedCourses: Array<{
    id: string;
    title: string;
    providerName: string | null;
    type: string | null;
    cost: number | null;
  }>;
  suggestedJobs: Array<{
    id: string;
    title: string;
    organizationName: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  }>;
}

export interface OpportunityScanResult {
  jobs: Array<{
    id: string;
    title: string;
    organizationName: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  }>;
  courses: Array<{
    id: string;
    title: string;
    providerName: string | null;
    type: string | null;
  }>;
  events: Array<{
    id: string;
    title: string;
    date: Date;
    location: string | null;
    isFeatured: boolean;
  }>;
}

export interface SalaryEquityResult {
  targetRole: string;
  sampleSize: number;
  marketMedian: number | null;
  userTargetMid: number | null;
  gap: number | null;
  status: 'above' | 'below' | 'aligned' | 'insufficient_data';
  tips: string[];
}

export interface MentorMatchResult {
  mentors: Array<{
    id: string;
    userId: string;
    name: string;
    avatar: string | null;
    headline: string | null;
    specializations: string[];
    yearsExperience: number | null;
    rating: number | null;
    matchScore: number;
    matchReasons: string[];
  }>;
}

export interface IncomeStreamResult {
  creatorStatus: 'non_creator' | 'emerging' | 'growing' | 'established';
  revenuePotentialScore: number;
  diversificationScore: number;
  monthlyEarnings: number;
  avgGiftValue: number;
  followerCount: number;
  actionPlan: string[];
  channels: Array<{
    name: string;
    currentShare: number;
    potentialShare: number;
  }>;
}

export interface RecommendationEngineResult {
  generatedAt: Date;
  items: Array<{
    type: 'job' | 'course' | 'mentor' | 'post';
    id: string;
    title: string;
    score: number;
    reason: string;
  }>;
  userSignals: {
    persona: string | null;
    skillCount: number;
  };
}

const normalizeSkill = (value: string) => value.trim().toLowerCase();
const uniq = (values: string[]) => Array.from(new Set(values));

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string') as string[];
  }
  if (typeof value === 'string') return [value];
  return [];
};

async function getUserSkills(userId: string): Promise<string[]> {
  const skills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: { select: { name: true } } },
  });
  return skills.map((s) => normalizeSkill(s.skill.name));
}

export async function getCareerCompass(userId: string, targetRole?: string): Promise<CareerCompassResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentJobTitle: true, persona: true },
  });

  const role = targetRole?.trim() || user?.currentJobTitle || 'Generalist';
  const userSkills = await getUserSkills(userId);

  const jobs = await prisma.job.findMany({
    where: {
      title: { contains: role, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    include: {
      organization: { select: { name: true } },
      skills: { include: { skill: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  const requiredSkills = uniq(
    jobs.flatMap((job) => job.skills.map((skill) => normalizeSkill(skill.skill.name)))
  );

  const missingSkills = requiredSkills.filter((skill) => !userSkills.includes(skill));

  const recommendedCourses = missingSkills.length
    ? await prisma.course.findMany({
        where: {
          isActive: true,
          OR: missingSkills.map((skill) => ({
            title: { contains: skill, mode: 'insensitive' },
          })),
        },
        select: {
          id: true,
          title: true,
          providerName: true,
          type: true,
          cost: true,
        },
        take: 8,
      })
    : [];

  const suggestedJobs = jobs.slice(0, 8).map((job) => ({
    id: job.id,
    title: job.title,
    organizationName: job.organization?.name || null,
    city: job.city,
    state: job.state,
    country: job.country,
  }));

  return {
    targetRole: role,
    persona: user?.persona || null,
    skillGaps: missingSkills.slice(0, 12),
    recommendedCourses,
    suggestedJobs,
  };
}

export async function getOpportunityScan(userId?: string): Promise<OpportunityScanResult> {
  const now = new Date();

  const [jobs, courses, events] = await Promise.all([
    prisma.job.findMany({
      where: { status: 'ACTIVE' },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true, providerName: true, type: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.event.findMany({
      where: { date: { gte: now }, isHidden: false },
      select: { id: true, title: true, date: true, location: true, isFeatured: true },
      orderBy: [{ isFeatured: 'desc' }, { date: 'asc' }],
      take: 6,
    }),
  ]);

  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      organizationName: job.organization?.name || null,
      city: job.city,
      state: job.state,
      country: job.country,
    })),
    courses,
    events,
  };
}

export async function getSalaryEquity(userId: string, targetRole?: string): Promise<SalaryEquityResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentJobTitle: true,
      profile: { select: { salaryMin: true, salaryMax: true } },
    },
  });

  const role = targetRole?.trim() || user?.currentJobTitle || 'Generalist';
  const jobs = await prisma.job.findMany({
    where: {
      title: { contains: role, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    select: { salaryMin: true, salaryMax: true },
    take: 50,
  });

  const salaryValues = jobs
    .map((job) => {
      if (job.salaryMin && job.salaryMax) return (job.salaryMin + job.salaryMax) / 2;
      if (job.salaryMin) return job.salaryMin;
      if (job.salaryMax) return job.salaryMax;
      return null;
    })
    .filter((value): value is number => value !== null);

  const marketMedian = median(salaryValues);
  const userMin = user?.profile?.salaryMin ?? null;
  const userMax = user?.profile?.salaryMax ?? null;
  const userTargetMid = userMin && userMax ? (userMin + userMax) / 2 : userMin || userMax || null;

  let status: SalaryEquityResult['status'] = 'insufficient_data';
  let gap: number | null = null;

  if (marketMedian !== null && userTargetMid !== null) {
    gap = userTargetMid - marketMedian;
    if (Math.abs(gap) <= marketMedian * 0.05) {
      status = 'aligned';
    } else if (gap < 0) {
      status = 'below';
    } else {
      status = 'above';
    }
  }

  const tips = [
    'Quantify impact with metrics (revenue, savings, growth).',
    'Highlight certifications or courses tied to high-demand skills.',
    'Use recent market data to anchor negotiation discussions.',
  ];

  return {
    targetRole: role,
    sampleSize: salaryValues.length,
    marketMedian,
    userTargetMid,
    gap,
    status,
    tips,
  };
}

export async function getMentorMatch(userId: string): Promise<MentorMatchResult> {
  const userSkills = await getUserSkills(userId);
  const userSkillSet = new Set(userSkills);

  const mentors = await prisma.mentorProfile.findMany({
    where: { isAvailable: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          headline: true,
        },
      },
    },
    take: 40,
  });

  const ranked = mentors.map((mentor) => {
    const specializations = toStringArray(mentor.specializations).map(normalizeSkill);
    const overlap = specializations.filter((skill) => userSkillSet.has(skill));
    const ratingValue = mentor.rating ? Number(mentor.rating) : 0;
    const experienceValue = mentor.yearsExperience ? Math.min(mentor.yearsExperience / 5, 5) : 0;
    const matchScore = overlap.length * 3 + ratingValue + experienceValue;

    const reasons: string[] = [];
    if (overlap.length) {
      reasons.push(`Shared skills: ${overlap.slice(0, 3).join(', ')}`);
    }
    if (mentor.yearsExperience) {
      reasons.push(`${mentor.yearsExperience}+ years experience`);
    }
    if (ratingValue) {
      reasons.push(`Rated ${ratingValue.toFixed(1)}`);
    }

    return {
      id: mentor.id,
      userId: mentor.userId,
      name: `${mentor.user.firstName} ${mentor.user.lastName}`.trim(),
      avatar: mentor.user.avatar,
      headline: mentor.user.headline,
      specializations,
      yearsExperience: mentor.yearsExperience ?? null,
      rating: mentor.rating ? Number(mentor.rating) : null,
      matchScore,
      matchReasons: reasons,
    };
  });

  ranked.sort((a, b) => b.matchScore - a.matchScore);

  return {
    mentors: ranked.slice(0, 8),
  };
}

export async function getIncomeStream(userId: string): Promise<IncomeStreamResult> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [creatorProfile, giftStats, recentPosts] = await Promise.all([
    prisma.creatorProfile.findUnique({
      where: { userId },
      select: { isMonetized: true, tier: true, followerCount: true, totalEarnings: true },
    }),
    prisma.giftTransaction.aggregate({
      where: { receiverId: userId, createdAt: { gte: monthAgo } },
      _sum: { giftValue: true },
      _avg: { giftValue: true },
      _count: true,
    }),
    prisma.post.count({
      where: { authorId: userId, createdAt: { gte: monthAgo } },
    }),
  ]);

  const followerCount = creatorProfile?.followerCount || 0;
  const monthlyEarnings = (giftStats._sum.giftValue || 0) * 0.01;
  const avgGiftValue = (giftStats._avg.giftValue || 0) * 0.01;

  const activityScore = Math.min(40, recentPosts * 4);
  const audienceScore = Math.min(35, followerCount / 100);
  const revenueScore = Math.min(25, monthlyEarnings * 2);
  const revenuePotentialScore = Math.round(activityScore + audienceScore + revenueScore);

  const diversificationScore = Math.max(
    10,
    Math.min(100, 40 + (recentPosts > 6 ? 20 : 0) + (monthlyEarnings > 200 ? 20 : 0))
  );

  const creatorStatus: IncomeStreamResult['creatorStatus'] = creatorProfile?.isMonetized
    ? followerCount > 20000
      ? 'established'
      : followerCount > 3000
        ? 'growing'
        : 'emerging'
    : 'non_creator';

  const channels = [
    { name: 'Gifts', currentShare: 55, potentialShare: 45 },
    { name: 'Subscriptions', currentShare: 20, potentialShare: 25 },
    { name: 'Brand Deals', currentShare: 15, potentialShare: 20 },
    { name: 'Digital Products', currentShare: 10, potentialShare: 10 },
  ];

  const actionPlan = [
    'Schedule 2 revenue-focused live sessions per week.',
    'Bundle top-performing content into a paid mini-course.',
    'Collaborate with 1 complementary creator each month.',
    'Set a weekly goal for direct audience engagement (comments + DMs).',
  ];

  return {
    creatorStatus,
    revenuePotentialScore,
    diversificationScore,
    monthlyEarnings,
    avgGiftValue,
    followerCount,
    actionPlan,
    channels,
  };
}

export async function getRecommendationEngineV2(userId?: string): Promise<RecommendationEngineResult> {
  const [user, userSkills] = userId
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { persona: true } }),
        getUserSkills(userId),
      ])
    : [null, []];

  const skillSet = new Set(userSkills);

  const [jobs, courses, mentors, posts] = await Promise.all([
    prisma.job.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, title: true, city: true, state: true, country: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true, providerName: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.mentorProfile.findMany({
      where: { isAvailable: true },
      select: { id: true, user: { select: { firstName: true, lastName: true } }, specializations: true },
      take: 5,
    }),
    prisma.post.findMany({
      where: { isHidden: false },
      select: { id: true, content: true, viewCount: true },
      orderBy: { viewCount: 'desc' },
      take: 5,
    }),
  ]);

  const items: RecommendationEngineResult['items'] = [];

  jobs.forEach((job, index) => {
    items.push({
      type: 'job',
      id: job.id,
      title: job.title,
      score: 90 - index * 5,
      reason: 'High-growth role aligned with your search activity.',
    });
  });

  courses.forEach((course, index) => {
    items.push({
      type: 'course',
      id: course.id,
      title: course.title,
      score: 85 - index * 4,
      reason: `Upskill pathway from ${course.providerName || 'verified provider'}.`,
    });
  });

  mentors.forEach((mentor, index) => {
    const mentorSkills = toStringArray(mentor.specializations).map(normalizeSkill);
    const overlap = mentorSkills.filter((skill) => skillSet.has(skill)).length;
    items.push({
      type: 'mentor',
      id: mentor.id,
      title: `${mentor.user.firstName} ${mentor.user.lastName}`.trim(),
      score: 80 + overlap * 3 - index * 3,
      reason: overlap ? 'Shared skills and specialization match.' : 'Top-rated mentor in your domain.',
    });
  });

  posts.forEach((post, index) => {
    items.push({
      type: 'post',
      id: post.id,
      title: post.content.slice(0, 40),
      score: 75 - index * 2,
      reason: 'Trending in your community feed.',
    });
  });

  items.sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date(),
    items: items.slice(0, 12),
    userSignals: {
      persona: user?.persona || null,
      skillCount: userSkills.length,
    },
  };
}
