import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UpdateCaptionsSchema } from '@/lib/validations';
import { videoDb, isAppError } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/videos/[id]
 * Get video metadata and variants
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const video = await videoDb.findById(params.id);
    logger.info('Video retrieved', { videoId: params.id });
    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    logger.error('Error getting video', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/videos/[id]/captions
 * Update caption status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = UpdateCaptionsSchema.parse(body);

    const video = await videoDb.update(params.id, validated);
    logger.info('Video captions updated', { videoId: params.id });

    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    logger.error('Error updating video', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
