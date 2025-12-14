import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { deliverWithRetries } from '@/lib/leads/delivery';

const WebhookSchema = z.object({
  leadId: z.string().min(1),
  destinationUrl: z.string().url(),
  priceCents: z.number().int().nonnegative().optional(),
  retries: z.number().int().min(0).max(5).default(2),
  timeoutMs: z.number().int().min(100).max(1500).default(800),
});

// POST /api/leads/webhook
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const body = await request.json();
    const validated = WebhookSchema.parse(body);
    const delivery = await deliverWithRetries({
      destinationUrl: validated.destinationUrl,
      payload: { leadId: validated.leadId, priceCents: validated.priceCents },
      retries: validated.retries,
      timeoutMs: validated.timeoutMs,
      correlationId,
    });

    const latency = performance.now() - start;
    recordApiMetric('api.leads.webhook.post', latency, delivery.status !== 'delivered');

    if (delivery.status === 'delivered') {
      const response = NextResponse.json(
        {
          status: 'delivered',
          leadId: validated.leadId,
          attempts: delivery.attempts,
          latencyMs: delivery.latencyMs,
        },
        { status: 201 }
      );
      response.headers.set('x-correlation-id', correlationId);
      logger.info('Lead webhook delivered', {
        leadId: validated.leadId,
        url: validated.destinationUrl,
        attempts: delivery.attempts,
        correlationId,
        latencyMs: delivery.latencyMs,
      });
      return response;
    }

    const response = NextResponse.json({ error: 'Delivery failed', leadId: validated.leadId }, { status: 502 });
    response.headers.set('x-correlation-id', correlationId);
    logger.error(
      'Lead webhook failed after retries',
      delivery.lastError instanceof Error ? delivery.lastError : undefined,
      { leadId: validated.leadId, url: validated.destinationUrl, attempts: delivery.attempts, correlationId }
    );
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.leads.webhook.post', latency, true);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error delivering lead webhook', error instanceof Error ? error : new Error(String(error)), { correlationId });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
