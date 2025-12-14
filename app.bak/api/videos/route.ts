import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UploadVideoSchema } from '@/lib/validations';
import { videoDb, prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/videos
 * Upload video and queue for processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = UploadVideoSchema.parse(body);

    const video = await videoDb.create({
      ...validated,
      status: 'processing',
      captionStatus: 'pending',
    });

    // Create processing queue entry
    await prisma.videoProcessingQueue.create({
      data: {
        videoId: video.id,
        status: 'pending',
        priority: 0,
      },
    });

    logger.info('Video uploaded', { videoId: video.id, title: video.title });

    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error uploading video', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
