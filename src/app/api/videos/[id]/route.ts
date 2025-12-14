import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UpdateCaptionsSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';

/**
 * GET /api/videos/[id]
 * Get video metadata and variants
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idSchema = z.string().min(1);
    idSchema.parse(id);

    // Simulate fetching video details
    const video = {
      videoId: id,
      title: 'Sample Video',
      duration: 120,
      status: 'ok',
      variants: ['360p', '720p', '1080p'],
    };
    logger.info('Fetched video details', video);
    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid video id', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error fetching video details', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/videos/[id]/captions
 * Update caption status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    // Use UpdateCaptionsSchema for validation
    const validated = UpdateCaptionsSchema.parse(body);

    // Simulate video update
    const video = {
      videoId: id,
      captions: validated.captions,
      captionStatus: validated.captionStatus,
      updated: true,
    };
    logger.info('Video captions updated', { videoId: id });
    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error updating video', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
