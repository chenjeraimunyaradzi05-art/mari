import { prisma } from '../utils/prisma';

export interface TrustScoreResult {
  score: number;
  factors: Array<{ label: string; points: number }>;
  updatedAt: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

async function ensureUserTrustScore(userId: string) {
  return prisma.userTrustScore.upsert({
    where: { userId },
    create: {
      userId,
      trustScore: 50,
      communityFeedback: 50,
      badges: [],
    },
    update: {},
  });
}

async function applyTrustDelta(
  userId: string,
  delta: number,
  updates?: Partial<{ reportsAgainst: number; reportsSubmitted: number; lastIncidentAt: Date; communityFeedback: number }>
) {
  const record = await ensureUserTrustScore(userId);
  const trustScore = clamp(record.trustScore + delta, 0, 100);
  const communityFeedback = updates?.communityFeedback !== undefined
    ? clamp(updates.communityFeedback, 0, 100)
    : record.communityFeedback;

  const updated = await prisma.userTrustScore.update({
    where: { userId },
    data: {
      trustScore,
      communityFeedback,
      reportsAgainst: updates?.reportsAgainst,
      reportsSubmitted: updates?.reportsSubmitted,
      lastIncidentAt: updates?.lastIncidentAt,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      trustScore: updated.trustScore,
      trustScoreUpdatedAt: new Date(),
    },
  });

  return updated;
}

export async function calculateTrustScore(userId: string): Promise<TrustScoreResult> {
  const [user, postCount, completedReferrals, badgeCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        isSuspended: true,
        profile: { select: { linkedinUrl: true, websiteUrl: true } },
      },
    }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.referral.count({
      where: { referrerId: userId, status: 'COMPLETED' },
    }),
    prisma.verificationBadge.count({
      where: { userId, status: 'APPROVED' },
    }),
  ]);

  const factors: Array<{ label: string; points: number }> = [];
  let score = 50;

  if (user?.emailVerified) {
    score += 10;
    factors.push({ label: 'Email verified', points: 10 });
  }

  if (user?.profile?.linkedinUrl) {
    score += 5;
    factors.push({ label: 'LinkedIn connected', points: 5 });
  }

  if (user?.profile?.websiteUrl) {
    score += 3;
    factors.push({ label: 'Website connected', points: 3 });
  }

  if (postCount > 0) {
    const postPoints = clamp(Math.floor(postCount / 3), 0, 10);
    score += postPoints;
    if (postPoints > 0) {
      factors.push({ label: 'Content contributions', points: postPoints });
    }
  }

  if (completedReferrals > 0) {
    const referralPoints = clamp(completedReferrals * 2, 0, 10);
    score += referralPoints;
    factors.push({ label: 'Referrals', points: referralPoints });
  }

  if (badgeCount > 0) {
    const badgePoints = clamp(badgeCount * 4, 0, 20);
    score += badgePoints;
    factors.push({ label: 'Verification badges', points: badgePoints });
  }

  if (user?.isSuspended) {
    score -= 40;
    factors.push({ label: 'Account suspension', points: -40 });
  }

  score = clamp(score, 0, 100);
  const updatedAt = new Date().toISOString();

  await prisma.user.update({
    where: { id: userId },
    data: {
      trustScore: score,
      trustScoreUpdatedAt: updatedAt,
    },
  });

  return { score, factors, updatedAt };
}

export async function recordSafetyReport(reporterId: string, reportedUserId?: string | null) {
  const now = new Date();

  const reporterBase = await ensureUserTrustScore(reporterId);
  const reportedBase = reportedUserId ? await ensureUserTrustScore(reportedUserId) : null;

  const [reporterRecord, reportedRecord] = await Promise.all([
    applyTrustDelta(reporterId, 0, {
      reportsSubmitted: reporterBase.reportsSubmitted + 1,
    }),
    reportedUserId && reportedBase
      ? applyTrustDelta(reportedUserId, -4, {
          reportsAgainst: reportedBase.reportsAgainst + 1,
          communityFeedback: reportedBase.communityFeedback - 4,
          lastIncidentAt: now,
        })
      : Promise.resolve(null),
  ]);

  return { reporterRecord, reportedRecord };
}

export async function recordUserBlock(blockedUserId: string) {
  const now = new Date();
  const blockedBase = await ensureUserTrustScore(blockedUserId);
  return applyTrustDelta(blockedUserId, -2, {
    reportsAgainst: blockedBase.reportsAgainst + 1,
    communityFeedback: blockedBase.communityFeedback - 2,
    lastIncidentAt: now,
  });
}
