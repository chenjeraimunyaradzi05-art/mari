import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { videoQueue } from '@/lib/queue/videoQueue';

// POST /api/videos/process
// Enqueue the next pending video job into BullMQ for async processing
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const job = await prisma.videoProcessingQueue.findFirst({
      where: { status: 'pending' },
      orderBy: { priority: 'desc' },
      select: { videoId: true },
    });

    if (!job) {
      const latency = performance.now() - start;
      recordApiMetric('api.videos.process', latency, false);
      const response = NextResponse.json({ message: 'No pending jobs' }, { status: 200 });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    }

    const asset = await prisma.videoAsset.findUnique({ where: { id: job.videoId }, select: { id: true, originalUrl: true } });
    if (!asset) {
      await prisma.videoProcessingQueue.update({ where: { videoId: job.videoId }, data: { status: 'failed', errorMessage: 'Video missing' } });
      const latency = performance.now() - start;
      recordApiMetric('api.videos.process', latency, true);
      const response = NextResponse.json({ error: 'Video missing' }, { status: 404 });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    }

    await prisma.videoProcessingQueue.update({
      where: { videoId: job.videoId },
      data: { status: 'queued' },
    });

    await videoQueue.add(
      'transcode',
      { videoId: job.videoId, inputPath: asset.originalUrl },
      { jobId: job.videoId, attempts: 3, backoff: { type: 'exponential', delay: 30000 }, removeOnComplete: true, removeOnFail: false }
    );

    const latency = performance.now() - start;
    recordApiMetric('api.videos.process', latency, false);
    logger.info('Enqueued video job', { videoId: job.videoId, correlationId, latencyMs: latency });
    const response = NextResponse.json({ message: 'queued', videoId: job.videoId }, { status: 202 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.videos.process', latency, true);
    logger.error('Error processing video job', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    // If a job was claimed, mark it failed
    const videoId = typeof (error as Record<string, unknown>)?.videoId === 'string'
      ? (error as Record<string, unknown>).videoId as string
      : undefined;

    if (videoId) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.videoProcessingQueue.update({ where: { videoId }, data: { status: 'failed', errorMessage: message } }).catch(() => undefined);
      await prisma.videoAsset.update({ where: { id: videoId }, data: { status: 'failed' } }).catch(() => undefined);
    }
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
