import { NextRequest, NextResponse } from 'next/server';
import { feedDb, prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { FeedQuerySchema } from '@/lib/validations';
import { getRankedFeed } from '@/lib/feed/ranker';

/**
 * GET /api/feed
 * Get personalized feed
 */
export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const filter = request.nextUrl.searchParams.get('filter') || 'latest';
    const userId = request.nextUrl.searchParams.get('userId') || undefined;
    const type = request.nextUrl.searchParams.get('type') || undefined;
    const tag = request.nextUrl.searchParams.get('tag') || undefined;

    const parsed = FeedQuerySchema.parse({ limit, offset, filter, userId, type, tag });

    let posts: any[] = [];
    let meta: Record<string, any> = {};

    if (parsed.filter === 'recommended' || parsed.filter === 'for-you') {
      const ranked = await getRankedFeed({ userId: parsed.userId, limit: parsed.limit });
      // Merge ranking data into the post object
      posts = ranked.data.map(item => ({
        ...item.post,
        ranking: {
          score: item.score,
          reasons: item.reasons
        }
      }));
      meta = {
        bucket: ranked.bucket,
        generatedAt: ranked.generatedAt,
        fromCache: ranked.fromCache
      };
    } else if (type === 'social') {
      // Fetch from the new Social Post model
      const socialPosts = await prisma.post.findMany({
        take: parsed.limit,
        skip: parsed.offset,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              firstName: true,
              lastName: true,
              profileImage: true,
            }
          }
        }
      });
      posts = socialPosts;
    } else {
      posts = await feedDb.getRecentPosts(parsed.limit, parsed.offset, parsed.filter, parsed.type, parsed.tag);
    }

    logger.info('Feed retrieved', {
      count: posts.length,
      offset: parsed.offset,
      filter: parsed.filter,
      userId: parsed.userId,
      type: parsed.type,
      tag: parsed.tag,
      ...meta
    });

    return NextResponse.json({
      data: posts,
      pagination: { limit: parsed.limit, offset: parsed.offset, count: posts.length },
      filter: parsed.filter,
      type: parsed.type,
      tag: parsed.tag,
      meta
    });
  } catch (error) {
    logger.error('Error getting feed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
