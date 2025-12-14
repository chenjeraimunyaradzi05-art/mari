import { NextRequest, NextResponse } from 'next/server';
import { feedDb } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/feed
 * Get personalized feed
 */
export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

    const posts = await feedDb.getRecentPosts(limit, offset);

    logger.info('Feed retrieved', { count: posts.length, offset });

    return NextResponse.json({
      data: posts,
      pagination: { limit, offset, count: posts.length },
    });
  } catch (error) {
    logger.error('Error getting feed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
