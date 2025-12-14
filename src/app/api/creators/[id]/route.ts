import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// GET /api/creators/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idSchema = z.string().min(1);
    idSchema.parse(id);

    // Simulate fetching creator profile
    const creator = {
      creatorId: id,
      name: 'Sample Creator',
      followers: 12000,
      videos: 34,
      status: 'ok',
    };
    logger.info('Fetched creator profile', creator);
    return NextResponse.json(creator);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid creator id', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error fetching creator profile', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
