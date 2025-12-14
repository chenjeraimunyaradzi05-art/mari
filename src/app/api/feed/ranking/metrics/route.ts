import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/feed/ranking/metrics?days=7
export async function GET(request: NextRequest) {
  try {
    const daysParam = request.nextUrl.searchParams.get('days');
    const days = Math.max(1, Math.min(30, Number(daysParam || 7)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const impressions = await prisma.rankingFeedback.groupBy({
      by: ['bucket'],
      where: { action: 'impression', createdAt: { gte: since } },
      _count: { _all: true },
    });

    const engagements = await prisma.rankingFeedback.groupBy({
      by: ['bucket'],
      where: {
        action: { in: ['like', 'comment', 'share', 'view'] },
        createdAt: { gte: since },
      },
      _count: { _all: true },
      _sum: { reward: true },
    });

    const byBucket: Record<string, { impressions: number; engagements: number; reward: number }> = {};
    impressions.forEach((row: (typeof impressions)[number]) => {
      const key = row.bucket || 'unknown';
      byBucket[key] = { impressions: row._count._all, engagements: 0, reward: 0 };
    });
    engagements.forEach((row: (typeof engagements)[number]) => {
      const key = row.bucket || 'unknown';
      if (!byBucket[key]) byBucket[key] = { impressions: 0, engagements: 0, reward: 0 };
      byBucket[key].engagements = row._count._all;
      byBucket[key].reward = row._sum.reward ?? 0;
    });

    const summary = Object.entries(byBucket).map(([bucket, stats]) => {
      const ctr = stats.impressions > 0 ? stats.engagements / stats.impressions : 0;
      const avgReward = stats.engagements > 0 ? stats.reward / stats.engagements : 0;
      return {
        bucket,
        impressions: stats.impressions,
        engagements: stats.engagements,
        ctr: Number((ctr * 100).toFixed(2)),
        avgReward: Number(avgReward.toFixed(3)),
      };
    });

    return NextResponse.json({ since: since.toISOString(), summary });
  } catch (error) {
    logger.error('Ranking metrics failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
