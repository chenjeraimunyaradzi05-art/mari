import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { creativeDb } from '@/lib/db';
import { UpdateAdCreativeSchema } from '@/lib/validations';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

/**
 * GET /api/creatives/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const { id } = await params;
    const creative = await creativeDb.findById(id);
    const latency = performance.now() - start;
    recordApiMetric('api.creatives.id.get', latency, false);
    logger.info('Creative retrieved', { creativeId: id, correlationId, latencyMs: latency });
    const response = NextResponse.json(creative);
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.creatives.id.get', latency, true);
    if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    logger.error('Error getting creative', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}

/**
 * PATCH /api/creatives/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = UpdateAdCreativeSchema.parse(body);
    const creative = await creativeDb.update(id, validated);
    const latency = performance.now() - start;
    recordApiMetric('api.creatives.id.patch', latency, false);
    logger.info('Creative updated', { creativeId: id, correlationId, latencyMs: latency });
    const response = NextResponse.json(creative);
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.creatives.id.patch', latency, true);
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    logger.error('Error updating creative', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}

/**
 * DELETE /api/creatives/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const { id } = await params;
    await creativeDb.delete(id);
    const latency = performance.now() - start;
    recordApiMetric('api.creatives.id.delete', latency, false);
    logger.info('Creative deleted', { creativeId: id, correlationId, latencyMs: latency });
    const response = NextResponse.json({ success: true });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.creatives.id.delete', latency, true);
    if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    logger.error('Error deleting creative', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
