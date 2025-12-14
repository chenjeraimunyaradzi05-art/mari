import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UploadVideoSchema } from '@/lib/validations';
import { videoDb, prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

/**
 * POST /api/videos
 * Upload video and queue for processing
 */
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
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

    const latency = performance.now() - start;
    recordApiMetric('api.videos.post', latency, false);
    logger.info('Video uploaded', { videoId: video.id, title: video.title, correlationId, latencyMs: latency });

    const response = NextResponse.json(video, { status: 201 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    if (error instanceof z.ZodError) {
      recordApiMetric('api.videos.post', latency, true);
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    recordApiMetric('api.videos.post', latency, true);
    logger.error('Error uploading video', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
