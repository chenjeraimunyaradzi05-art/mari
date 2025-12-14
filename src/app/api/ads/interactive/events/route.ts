import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

const EventSchema = z.object({
  format: z.enum(['quiz', 'carousel', 'other']).default('other'),
  type: z.enum(['impression', 'engagement', 'conversion', 'submit', 'view']),
  creativeId: z.string().optional(),
  userId: z.string().optional(),
  payload: z.any().optional(),
});

export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const body = await request.json();
    const validated = EventSchema.parse(body);

    const event = await prisma.interactiveAdEvent.create({ data: validated });

    const latency = performance.now() - start;
    recordApiMetric('api.ads.interactive.events.post', latency, false);
    logger.info('Interactive ad event logged', { id: event.id, format: event.format, type: event.type, correlationId, latencyMs: Number(latency.toFixed(2)) });

    const response = NextResponse.json({ id: event.id });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.ads.interactive.events.post', latency, true);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error('Error logging interactive ad event', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
