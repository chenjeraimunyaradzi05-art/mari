import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// GET /api/live/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idSchema = z.string().min(1);
    idSchema.parse(id);

    // Simulate fetching live stream details
    const live = {
      liveId: id,
      title: 'Live Stream',
      viewers: 250,
      status: 'active',
      startedAt: new Date().toISOString(),
    };
    logger.info('Fetched live stream details', live);
    return NextResponse.json(live);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid live id', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error fetching live stream details', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
