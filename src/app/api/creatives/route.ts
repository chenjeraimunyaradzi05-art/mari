import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreateAdCreativeSchema } from '@/lib/validations';
import { creativeDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

const ListSchema = z.object({
  campaignId: z.string().min(1),
});

/**
 * POST /api/creatives
 * Create a new ad creative
 */
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const body = await request.json();
    const validated = CreateAdCreativeSchema.parse(body);

    const creative = await creativeDb.create(validated);

    const latency = performance.now() - start;
    recordApiMetric('api.creatives.post', latency, false);
    logger.info('Creative created', { creativeId: creative.id, campaignId: creative.campaignId, correlationId, latencyMs: latency });

    const response = NextResponse.json(creative, { status: 201 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    if (error instanceof z.ZodError) {
      recordApiMetric('api.creatives.post', latency, true);
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    recordApiMetric('api.creatives.post', latency, true);
    logger.error('Error creating creative', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}

/**
 * GET /api/creatives?campaignId=...
 */
export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validated = ListSchema.parse(params);

    const creatives = await creativeDb.findByCampaign(validated.campaignId);

    const latency = performance.now() - start;
    recordApiMetric('api.creatives.get', latency, false);
    logger.info('Creatives listed', { campaignId: validated.campaignId, count: creatives.length, correlationId, latencyMs: latency });

    const response = NextResponse.json({ data: creatives });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    if (error instanceof z.ZodError) {
      recordApiMetric('api.creatives.get', latency, true);
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    recordApiMetric('api.creatives.get', latency, true);
    logger.error('Error listing creatives', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
