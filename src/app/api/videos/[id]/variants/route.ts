import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// GET /api/videos/[id]/variants
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idSchema = z.string().min(1);
    idSchema.parse(id);

    // Simulate HLS variants
    const variants = [
      { quality: '1080p', url: `/cdn/videos/${id}/1080p.m3u8` },
      { quality: '720p', url: `/cdn/videos/${id}/720p.m3u8` },
      { quality: '480p', url: `/cdn/videos/${id}/480p.m3u8` },
      { quality: '360p', url: `/cdn/videos/${id}/360p.m3u8` },
    ];
    logger.info('Video variants listed', { videoId: id, count: variants.length });
    return NextResponse.json({ videoId: id, variants });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error listing video variants', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
