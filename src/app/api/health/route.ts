import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMetricsSnapshot, ensureCorrelationId, recordApiMetric } from '@/lib/metrics';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const metrics = getMetricsSnapshot();
    const latency = performance.now() - start;
    recordApiMetric('api.health', latency, false);

    const response = NextResponse.json(
      {
        status: 'ok',
        db: 'ok',
        metrics,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.health', latency, true);
    logger.error('Healthcheck failed', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
    });
    const response = NextResponse.json({ status: 'degraded' }, { status: 503 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
