import { NextRequest, NextResponse } from 'next/server';
import { getJobMatches } from '@/lib/matching/engine';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const MatchingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(10),
  userId: z.string().min(1),
});

/**
 * GET /api/matching
 * Get job matches for a user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const limit = request.nextUrl.searchParams.get('limit');

    const parsed = MatchingQuerySchema.parse({ userId, limit });

    const matches = await getJobMatches(parsed.userId, parsed.limit);

    return NextResponse.json({
      data: matches,
      count: matches.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as z.ZodError).issues }, { status: 400 });
    }
    logger.error('Error getting matches', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
