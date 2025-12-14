import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type MatchScore = {
  jobId: string;
  score: number;
  reasons: string[];
  fairnessBoost?: number;
};

export async function getJobMatches(userId: string, limit = 10) {
  const start = performance.now();
  
  // 1. Fetch User Context
  const [member, userFeature] = await Promise.all([
    prisma.member.findUnique({ where: { userId } }),
    prisma.userFeature.findUnique({ where: { userId } }),
  ]);

  if (!member) {
    logger.warn('Matching requested for non-member user', { userId });
    return [];
  }

  // 2. Fetch Candidate Jobs (Open jobs)
  const jobs = await prisma.job.findMany({
    where: { status: 'OPEN' },
    orderBy: { postedDate: 'desc' },
    take: 100, // Candidate pool
    include: { company: true },
  });

  // 3. Score Jobs
  const scores: MatchScore[] = jobs.map((job) => {
    let score = 0;
    const reasons: string[] = [];
    let fairnessBoost = 0;

    // A. Interest Match (Simple keyword matching)
    if (userFeature?.interests) {
      const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
      let interestMatches = 0;
      
      for (const interest of userFeature.interests) {
        if (jobText.includes(interest.toLowerCase())) {
          interestMatches++;
        }
      }

      if (interestMatches > 0) {
        const boost = Math.min(0.5, interestMatches * 0.1);
        score += boost;
        reasons.push(`Matches ${interestMatches} interests`);
      }
    }

    // B. Location Match (Using profileData if available)
    const userLocation = (member.profileData as any)?.location;
    if (userLocation && job.location && userLocation === job.location) {
      score += 0.3;
      reasons.push('Location match');
    }

    // C. Recency Boost
    const daysOld = (Date.now() - job.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) {
      score += 0.1;
      reasons.push('New job');
    }

    // D. Fairness / Diversity Boost (Algorithmic Fairness)
    // If the job is from a "Verified Impact" employer or explicitly targets underrepresented groups
    // we give it a slight boost to ensure visibility.
    // if (job.company.verified) {
    //    fairnessBoost += 0.05;
    //    score += fairnessBoost;
    //    // We don't explicitly list this as a reason to the user to avoid confusion, 
    //    // but we track it for audit.
    // }

    // E. Base Score
    score += 0.1;

    return { jobId: job.id, score, reasons, fairnessBoost };
  });

  // 4. Sort and Rank
  const ranked = scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 5. Hydrate Results
  const results = ranked.map((match) => {
    const job = jobs.find((j) => j.id === match.jobId)!;
    return {
      ...job,
      matchScore: match.score,
      matchReasons: match.reasons,
      _fairnessBoost: match.fairnessBoost, // Internal use only
    };
  });

  logger.info('Job matches generated', { 
    userId, 
    count: results.length, 
    latency: performance.now() - start 
  });

  return results;
}
