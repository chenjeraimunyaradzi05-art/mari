import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

/**
 * POST /api/cron/propensity
 * Populates UserPropensity features daily; intended to be called by a scheduler.
 */
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(1000, Math.max(1, Number(limitParam ?? 200)));

    const users = await prisma.user.findMany({ take: limit, orderBy: { updatedAt: 'desc' } });

    const updates = users.map((u, idx) => {
      const jitter = (idx % 10) * 0.01;
      return prisma.userPropensity.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          jobSeeking: 0.4 + jitter,
          courseInterest: 0.5 + jitter,
          spendingPower: 0.5,
          engagementLevel: 0.5 + jitter,
          churnRisk: 0.3 + jitter,
        },
        update: {
          jobSeeking: 0.4 + jitter,
          courseInterest: 0.5 + jitter,
          spendingPower: 0.5,
          engagementLevel: 0.5 + jitter,
          churnRisk: 0.3 + jitter,
        },
      });
    });

    await prisma.$transaction(updates);

    const latency = performance.now() - start;
    recordApiMetric('api.cron.propensity.post', latency, false);
    logger.info('Propensity features populated', { count: updates.length, correlationId, latencyMs: latency });

    const response = NextResponse.json({ updated: updates.length, latencyMs: Number(latency.toFixed(2)) });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.cron.propensity.post', latency, true);
    logger.error('Error populating propensity', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
