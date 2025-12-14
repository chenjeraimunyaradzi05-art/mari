import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { logger } from '@/lib/logger';
import { recordApiMetric, recordCacheMetric, recordExperimentSplit } from '@/lib/metrics';
import { assignBucket, ExperimentBucket, isTreatment } from '@/lib/experiments';

const CACHE_TTL_SECONDS = 60;
const CANDIDATE_POOL = 120;
const EXPERIMENT_NAME = 'feed-ranking-v1';

type OrgPostRow = Prisma.OrgPostGetPayload<{ include: { organization: true } }>;
type ContentFeatureRow = Awaited<ReturnType<typeof prisma.contentFeature.findMany>>[number];
type UserFeatureRow = {
  interests?: string[] | null;
  activityScore?: number | null;
  completionRate?: number | null;
};
type BanditArmRow = Awaited<ReturnType<typeof prisma.banditArm.findMany>>[number];

const client = prisma as unknown as PrismaClient & {
  userFeature: { findUnique: (args: { where: { userId: string } }) => Promise<UserFeatureRow | null> };
};

type RankedPost = {
  post: OrgPostRow;
  score: number;
  reasons?: string[];
};

type RankInput = {
  userId?: string;
  limit: number;
  forceBucket?: ExperimentBucket;
};

const safeRedis = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    logger.warn('Feed cache unavailable', { error: (error as Error).message });
    return null;
  }
};

function interestBoost(tags: string[] | null | undefined, interests: string[] | null | undefined) {
  if (!tags?.length || !interests?.length) return 0;
  const overlap = tags.filter((t) => interests.includes(t)).length;
  return Math.min(0.2, overlap * 0.05);
}

const sampleBandit = (arm?: BanditArmRow) => {
  const alpha = arm?.alpha ?? 1;
  const beta = arm?.beta ?? 1;
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const std = Math.sqrt(variance);
  const jitter = (Math.random() * 2 - 1) * std;
  const value = mean + jitter;
  return Math.min(1, Math.max(0, value));
};

const diversityPenalty = (
  post: OrgPostRow,
  orgCounts: Map<string, number>,
  tagCounts: Map<string, number>
) => {
  const penalties: number[] = [];
  const orgId = post.organizationId ?? post.organization?.id;
  if (orgId) {
    const count = orgCounts.get(orgId) || 0;
    if (count > 0) penalties.push(count * 0.08);
  }
  (post.tags ?? []).forEach((tag) => {
    const count = tagCounts.get(tag) || 0;
    if (count > 0) penalties.push(count * 0.02);
  });
  return penalties.reduce((a, b) => a + b, 0);
};

function computeScore(
  post: OrgPostRow,
  feature: ContentFeatureRow | undefined,
  userFeature: UserFeatureRow | null
) {
  const now = Date.now();
  const hoursOld = Math.max(1, (now - post.createdAt.getTime()) / (1000 * 60 * 60));
  const recencyScore = Math.exp(-hoursOld / 72); // decays over 3 days

  const engagementRate = feature?.engagementRate ?? 0.02;
  const engagementScore = engagementRate * 0.5;

  const socialProof = (post.likes + post.comments * 1.5 + post.shares * 2) / 2000; // capped small weight
  const watchScore = Number(feature?.watchTime ?? 0n) / 120000; // scaled down
  const safety = (feature?.safetyScore ?? post.safetyScore ?? 1) * 0.1;
  const followerScore = (feature?.creatorFollowers ?? post.organization?.followers ?? 0) / 100000; // small boost

  const interest = interestBoost(post.tags ?? [], userFeature?.interests ?? []);
  const activity = (userFeature?.activityScore ?? 0.5) * 0.1;
  const completion = (userFeature?.completionRate ?? 0.5) * 0.05;

  return (
    recencyScore * 0.35 +
    engagementScore +
    socialProof +
    watchScore * 0.05 +
    followerScore * 0.05 +
    safety +
    interest +
    activity +
    completion
  );
}

export async function getRankedFeed({ userId, limit, forceBucket }: RankInput) {
  const start = performance.now();
  const bucket = assignBucket(EXPERIMENT_NAME, userId, forceBucket);
  const cacheKey = `feed:ranked:${bucket}:${userId ?? 'anon'}:${limit}`;

  recordExperimentSplit(EXPERIMENT_NAME, bucket);

  const cacheStart = performance.now();
  const cached = await safeRedis(() => redis.get(cacheKey));
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { data: RankedPost[]; generatedAt: string; bucket: ExperimentBucket };
      recordCacheMetric('feed.ranked', true, performance.now() - cacheStart);
      recordApiMetric('feed.ranked', performance.now() - start, false);
      return { ...parsed, fromCache: true };
    } catch (error) {
      logger.warn('Failed to parse feed cache', { error: (error as Error).message });
    }
  }
  recordCacheMetric('feed.ranked', false, performance.now() - cacheStart);

  const [userFeature, posts] = await Promise.all([
    userId ? client.userFeature.findUnique({ where: { userId } }) : null,
    prisma.orgPost.findMany({
      where: { visibility: 'public', flaggedForReview: false },
      orderBy: { createdAt: 'desc' },
      take: Math.max(limit * 3, CANDIDATE_POOL),
      include: { organization: true },
    }) as Promise<OrgPostRow[]>,
  ]);

  const contentFeatures = (await prisma.contentFeature.findMany({
    where: { contentId: { in: posts.map((p: OrgPostRow) => p.id) } },
  })) as ContentFeatureRow[];
  const featureMap = new Map(contentFeatures.map((f) => [f.contentId, f]));

  const banditArms = (await prisma.banditArm.findMany({
    where: { contentId: { in: posts.map((p: OrgPostRow) => p.id) } },
  })) as BanditArmRow[];
  const armMap = new Map(banditArms.map((arm) => [arm.contentId, arm]));

  let ranked: RankedPost[];
  if (isTreatment(bucket)) {
    const candidates = posts.map((post: OrgPostRow) => {
      const base = computeScore(post, featureMap.get(post.id), userFeature);
      const bandit = sampleBandit(armMap.get(post.id));
      
      const reasons: string[] = [];
      const now = Date.now();
      const hoursOld = (now - post.createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursOld < 24) reasons.push('Fresh');
      if (interestBoost(post.tags ?? [], userFeature?.interests ?? []) > 0.05) reasons.push('Matches interests');
      if ((post.likes + post.comments) > 50) reasons.push('Trending');
      if (bandit > 0.7) reasons.push('Discovery');

      return { post, score: base * 0.55 + bandit * 0.45, base, bandit, reasons };
    });

    const sorted = candidates.sort((a, b) => b.score - a.score);
    const orgCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const diversified: RankedPost[] = [];

    for (const candidate of sorted) {
      const penalty = diversityPenalty(candidate.post, orgCounts, tagCounts);
      diversified.push({ 
        post: candidate.post, 
        score: candidate.score - penalty,
        reasons: candidate.reasons 
      });

      const orgId = candidate.post.organizationId ?? candidate.post.organization?.id;
      if (orgId) orgCounts.set(orgId, (orgCounts.get(orgId) || 0) + 1);
      (candidate.post.tags ?? []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
      if (diversified.length >= limit * 2) break; // cap processing
    }

    ranked = diversified.sort((a, b) => b.score - a.score).slice(0, limit);
  } else {
    ranked = posts
      .slice(0, limit)
      .map((post: OrgPostRow, idx: number) => ({ post, score: Math.max(0, limit - idx) / limit }));
  }

  const payload = {
    data: ranked,
    generatedAt: new Date().toISOString(),
    bucket,
  };

  await safeRedis(() => redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS));

  // Best-effort store ranking positions and impressions
  const rankingRows = userId
    ? ranked.map((item, index) => ({
        userId,
        postId: item.post.id,
        rankScore: item.score,
        position: index + 1,
        experiment: bucket,
      }))
    : [];

  const impressions = ranked.map((item) => ({
    userId: userId ?? null,
    postId: item.post.id,
    bucket,
    experiment: EXPERIMENT_NAME,
    action: 'impression',
    reward: 0,
  }));

  prisma.rankingFeedback
    .createMany({ data: impressions, skipDuplicates: true })
    .catch((error) => logger.warn('rankingFeedback impressions skipped', { error: (error as Error).message }));

  if (rankingRows.length) {
    prisma.feedRanking
      .createMany({ data: rankingRows, skipDuplicates: true })
      .catch((error) => logger.warn('feedRanking persistence skipped', { error: (error as Error).message }));
  }

  // Update bandit arms for impressions
  Promise.all(
    ranked.map((item) =>
      prisma.banditArm.upsert({
        where: { contentId: item.post.id },
        create: {
          contentId: item.post.id,
          alpha: 1,
          beta: 1.1,
          impressions: 1,
          clicks: 0,
        },
        update: {
          impressions: { increment: 1 },
          beta: { increment: 0.1 },
        },
      })
    )
  ).catch((error) => logger.warn('banditArm impression update skipped', { error: (error as Error).message }));

  recordApiMetric('feed.ranked', performance.now() - start, false);
  return { ...payload, fromCache: false };
}
