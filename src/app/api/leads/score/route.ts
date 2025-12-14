import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leadDb } from '@/lib/db';
import { scoreLead } from '@/lib/leadScoring';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

const ScoreSchema = z.object({
  leadId: z.string().min(1),
});

/**
 * POST /api/leads/score
 * Scores a lead, persists score + tier, returns model metadata.
 */
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const body = await request.json();
    const validated = ScoreSchema.parse(body);

    const lead = await leadDb.findById(validated.leadId);
    const scored = scoreLead({
      source: lead.source,
      tier: lead.tier,
      createdAt: lead.createdAt,
    });

    await leadDb.updateScore(validated.leadId, scored.score, scored.tier, scored.priceCents, scored.explanation);

    const latency = performance.now() - start;
    recordApiMetric('api.leads.score.post', latency, false);
    logger.info('Lead scored', { leadId: validated.leadId, score: scored.score, tier: scored.tier, correlationId, latencyMs: latency });

    const driftBaseline = 0.65;
    const drift = scored.metrics?.accuracy !== undefined && scored.metrics.accuracy < driftBaseline - 0.05;

    const response = NextResponse.json({
      leadId: validated.leadId,
      score: scored.score,
      tier: scored.tier,
      probability: Number(scored.probability.toFixed(4)),
      modelVersion: scored.modelVersion,
      metrics: scored.metrics,
      explanation: scored.explanation,
      priceCents: scored.priceCents,
      drift,
      latencyMs: Number(latency.toFixed(2)),
    });
    if (drift) {
      response.headers.set('x-drift-alert', 'accuracy-drop');
      logger.warn('Lead scoring drift detected', { accuracy: scored.metrics?.accuracy, baseline: driftBaseline, leadId: validated.leadId });
    }
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.leads.score.post', latency, true);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error('Error scoring lead', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
