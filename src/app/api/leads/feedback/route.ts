import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leadDb } from '@/lib/db';
import { logger } from '@/lib/logger';

const FeedbackSchema = z.object({
  leadId: z.string().min(1),
  quality: z.enum(['good', 'bad']),
  comments: z.string().optional(),
});

// POST /api/leads/feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = FeedbackSchema.parse(body);

    const lead = await leadDb.findById(validated.leadId);
    const delta = validated.quality === 'good' ? 10 : -15;
    const newScore = Math.max(0, Math.min(100, (lead.score ?? 0) + delta));
    const tier = newScore >= 70 ? 'hot' : newScore >= 45 ? 'warm' : 'cold';

    await leadDb.updateScore(validated.leadId, newScore, tier);
    await leadDb.appendFeedback(validated.leadId, { quality: validated.quality, comments: validated.comments });

    logger.info('Lead feedback applied', { leadId: validated.leadId, quality: validated.quality });
    return NextResponse.json({ leadId: validated.leadId, score: newScore, tier });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error('Error applying feedback', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
