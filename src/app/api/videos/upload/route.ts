import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, readFile, unlink, readdir, access } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { prisma, videoDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

const UPLOAD_ROOT = join(process.cwd(), '.uploads');

async function concatChunks(chunkDir: string, totalChunks: number, destination: string) {
  await writeFile(destination, Buffer.alloc(0));
  const writeStream = createWriteStream(destination, { flags: 'a' });
  for (let i = 0; i < totalChunks; i += 1) {
    const chunkPath = join(chunkDir, `${i}.part`);
    const chunk = await readFile(chunkPath);
    writeStream.write(chunk);
    await unlink(chunkPath).catch(() => undefined);
  }
  writeStream.end();
}

// POST /api/videos/upload (chunked form-data)
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const uploadId = (formData.get('uploadId') as string) || randomUUID();
    const chunkIndex = Number(formData.get('chunkIndex') || '0');
    const totalChunks = Number(formData.get('totalChunks') || '1');
    const title = (formData.get('title') as string) || 'untitled';
    const description = (formData.get('description') as string) || null;

    if (!(file instanceof File)) {
      const latency = performance.now() - start;
      recordApiMetric('api.videos.upload', latency, true);
      return NextResponse.json({ error: 'file field is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const chunkDir = join(UPLOAD_ROOT, uploadId);
    await mkdir(chunkDir, { recursive: true });
    const chunkPath = join(chunkDir, `${chunkIndex}.part`);
    await writeFile(chunkPath, buffer);
    // If already finalized, return the existing video id
    const doneMarker = join(chunkDir, '.done');
    const metaPath = join(chunkDir, 'video.json');
    try {
      await access(doneMarker);
      const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as { videoId?: string };
      const response = NextResponse.json({ status: 'complete', uploadId, videoId: meta.videoId }, { status: 200 });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch {
      // not done yet
    }

    // Check if all chunks have arrived
    const files = await readdir(chunkDir);
    const partFiles = files.filter((f) => f.endsWith('.part'));

    if (partFiles.length === totalChunks) {
      // Attempt to acquire a lock to finalize once
      const lockPath = join(chunkDir, '.finalizing');
      try {
        await writeFile(lockPath, `${Date.now()}`, { flag: 'wx' });
      } catch {
        // Another request is finalizing; acknowledge chunk receipt
        const latency = performance.now() - start;
        recordApiMetric('api.videos.upload', latency, false);
        const response = NextResponse.json({ status: 'chunk_received', uploadId, chunkIndex }, { status: 202 });
        response.headers.set('x-correlation-id', correlationId);
        return response;
      }

      try {
        const finalPath = join(chunkDir, 'combined');
        await concatChunks(chunkDir, totalChunks, finalPath);

        const video = await videoDb.create({
          title,
          description: description ?? undefined,
          originalUrl: finalPath,
          status: 'processing',
          captionStatus: 'pending',
        });

        await prisma.videoProcessingQueue.create({
          data: {
            videoId: video.id,
            status: 'pending',
            priority: 0,
          },
        });

        await writeFile(metaPath, JSON.stringify({ videoId: video.id }), 'utf-8');
        await writeFile(doneMarker, 'ok');
        await unlink(lockPath).catch(() => undefined);

        const latency = performance.now() - start;
        recordApiMetric('api.videos.upload', latency, false);
        logger.info('Chunked upload complete; video queued', {
          uploadId,
          videoId: video.id,
          correlationId,
          latencyMs: latency,
        });

        const response = NextResponse.json({ status: 'complete', uploadId, videoId: video.id }, { status: 201 });
        response.headers.set('x-correlation-id', correlationId);
        return response;
      } catch (error) {
        await unlink(lockPath).catch(() => undefined);
        throw error;
      }
    }

    const latency = performance.now() - start;
    recordApiMetric('api.videos.upload', latency, false);
    logger.info('Chunk received', { uploadId, chunkIndex, totalChunks, correlationId, latencyMs: latency });
    const response = NextResponse.json({ status: 'chunk_received', uploadId, chunkIndex }, { status: 200 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.videos.upload', latency, true);
    logger.error('Error handling chunked upload', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
