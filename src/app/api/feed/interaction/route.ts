import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InteractionSchema } from '@/lib/validations';
import { feedDb } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/feed/interaction
 * Record user interaction (view, like, comment, share)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = InteractionSchema.parse(body);

    const interaction = await feedDb.recordInteraction(validated);

    logger.info('Interaction recorded', {
      userId: validated.userId,
      contentId: validated.contentId,
      actionType: validated.actionType,
      durationSeconds: validated.durationSeconds,
      bucket: validated.bucket,
      experiment: validated.experiment,
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error recording interaction', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
