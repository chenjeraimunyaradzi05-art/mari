import { prisma } from '@/lib/db';

export type CareerInsight = {
  type: 'GROWTH' | 'ALERT' | 'OPPORTUNITY';
  message: string;
  actionableStep: string;
  score?: number;
};

export async function generateCareerInsights(userId: string): Promise<CareerInsight[]> {
  const insights: CareerInsight[] = [];
  
  const member = await prisma.member.findUnique({
    where: { userId },
    include: {
      enrollments: true,
      jobApplications: true,
      goals: true,
    }
  });

  if (!member) return [];

  // 1. Skill Gap Analysis
  if (member.enrollments.length === 0) {
    insights.push({
      type: 'GROWTH',
      message: 'You haven\'t enrolled in any courses yet.',
      actionableStep: 'Browse our "AI for Beginners" course to boost your profile.',
      score: 0.8
    });
  }

  // 2. Application Velocity
  const recentApps = member.jobApplications.filter(a => 
    (Date.now() - a.appliedDate.getTime()) < 30 * 24 * 60 * 60 * 1000
  );
  
  if (recentApps.length > 5 && recentApps.every(a => a.status === 'REJECTED')) {
    insights.push({
      type: 'ALERT',
      message: 'We noticed a few recent rejections.',
      actionableStep: 'Schedule a session with a Mentor to review your resume.',
      score: 0.9
    });
  }

  // 3. Goal Tracking
  const pendingGoals = member.goals.filter(g => g.status === 'IN_PROGRESS');
  if (pendingGoals.length > 0) {
    insights.push({
      type: 'OPPORTUNITY',
      message: `You have ${pendingGoals.length} active goals.`,
      actionableStep: 'Update your progress on "Learn Python" to keep your momentum.',
      score: 0.7
    });
  }

  return insights.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export async function generateCreatorInsights(userId: string): Promise<CareerInsight[]> {
  // Placeholder for Creator/Social insights
  return [
    {
      type: 'GROWTH',
      message: 'Your recent reels averaged 2.3% engagement.',
      actionableStep: 'Try posting between 6pm-8pm for 4%+ engagement.',
      score: 0.95
    }
  ];
}
