import { prisma } from "@/lib/prisma";

export interface PropensityScores {
  jobSeeking: number;
  courseInterest: number;
  spendingPower: number;
  engagementLevel: number;
  churnRisk: number;
}

export async function calculateUserPropensity(userId: string): Promise<PropensityScores> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      member: true,
      posts: true,
      comments: true,
      likes: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const scores: PropensityScores = {
    jobSeeking: 0,
    courseInterest: 0,
    spendingPower: 0,
    engagementLevel: 0,
    churnRisk: 0,
  };

  // 1. Job Seeking Score (0-1)
  if (user.member?.employmentStatus === "UNEMPLOYED" || user.member?.currentPathway === "LOOKING_FOR_WORK") {
    scores.jobSeeking = 0.9;
  } else if (user.member?.employmentStatus === "CASUAL") {
    scores.jobSeeking = 0.6;
  } else {
    scores.jobSeeking = 0.2;
  }

  // 2. Course Interest Score (0-1)
  // Heuristic: Lower education level or specific pathway goals might indicate interest
  if (user.member?.educationLevel === "HIGH_SCHOOL" || user.member?.currentPathway === "STUDY") {
    scores.courseInterest = 0.8;
  } else {
    scores.courseInterest = 0.3;
  }

  // 3. Spending Power (0-1)
  // Normalize income. Assume 100k is 1.0
  const income = user.member?.annualIncome || 0;
  scores.spendingPower = Math.min(income / 100000, 1);

  // 4. Engagement Level (0-1)
  // Based on recent activity (posts + comments + likes)
  const activityCount = user.posts.length + user.comments.length + user.likes.length;
  scores.engagementLevel = Math.min(activityCount / 20, 1); // Cap at 20 interactions

  // 5. Churn Risk (0-1)
  // Based on last login. If > 30 days, high risk.
  if (user.lastLogin) {
    const daysSinceLogin = (Date.now() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    scores.churnRisk = Math.min(daysSinceLogin / 30, 1);
  } else {
    scores.churnRisk = 1.0; // Never logged in or unknown
  }

  return scores;
}

export async function updateUserPropensity(userId: string) {
  const scores = await calculateUserPropensity(userId);

  await prisma.userPropensity.upsert({
    where: { userId },
    update: {
      ...scores,
      updatedAt: new Date(),
    },
    create: {
      userId,
      ...scores,
    },
  });

  return scores;
}
