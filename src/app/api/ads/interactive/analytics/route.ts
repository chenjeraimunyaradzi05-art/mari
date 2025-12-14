import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const since = request.nextUrl.searchParams.get('since');
    const sinceDate = since ? new Date(since) : undefined;

    const where = sinceDate ? { createdAt: { gte: sinceDate } } : {};
    const grouped = await prisma.interactiveAdEvent.groupBy({
      by: ['format', 'type'],
      _count: { _all: true },
      where,
    });

    const rows = grouped.map((g) => ({ format: g.format, type: g.type, count: g._count._all }));

    const latency = performance.now() - start;
    recordApiMetric('api.ads.interactive.analytics.get', latency, false);
    logger.info('Interactive analytics fetched', { rows: rows.length, correlationId, latencyMs: Number(latency.toFixed(2)) });

    const response = NextResponse.json({ data: rows });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.ads.interactive.analytics.get', latency, true);
    logger.error('Error fetching interactive analytics', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
