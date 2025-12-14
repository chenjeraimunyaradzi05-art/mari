import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getRankedFeed } from '@/lib/feed/ranker';
import { ExperimentBucket } from '@/lib/experiments';

const FeedRankSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  userId: z.string().optional(),
  experiment: z.enum(['control', 'heuristic']).optional(),
});

// GET /api/feed/ranked?limit=20&userId=abc&experiment=control
export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const userId = request.nextUrl.searchParams.get('userId') || undefined;
    const experiment = request.nextUrl.searchParams.get('experiment') as ExperimentBucket | null;

    const validated = FeedRankSchema.parse({ limit, userId, experiment: experiment ?? undefined });

    const { data, generatedAt, bucket, fromCache } = await getRankedFeed({
      userId: validated.userId,
      limit: validated.limit,
      forceBucket: validated.experiment,
    });

    logger.info('Ranked feed generated', { count: data.length, bucket, cache: fromCache });

    return NextResponse.json(
      {
        data: data.map((item) => ({ ...item.post, score: item.score })),
        meta: {
          limit: validated.limit,
          bucket,
          cache: fromCache ? 'hit' : 'miss',
          generatedAt,
        },
      },
      {
        headers: {
          'X-Experiment-Bucket': bucket,
          'X-Feed-Cache': fromCache ? 'hit' : 'miss',
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error generating ranked feed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
