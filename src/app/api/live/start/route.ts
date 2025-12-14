import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StartLiveStreamSchema } from '@/lib/validations';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/live/start
 * Start a live stream
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = StartLiveStreamSchema.parse(body);

    const stream = await prisma.liveStream.create({
      data: {
        ...validated,
        status: 'live',
        startedAt: new Date(),
      },
    });

    logger.info('Live stream started', { streamId: stream.id, creatorId: validated.creatorId });

    return NextResponse.json(stream, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error starting live stream', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
