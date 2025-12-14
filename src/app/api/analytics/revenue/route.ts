import { NextRequest, NextResponse } from 'next/server';
import { analyticsDb } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/revenue
 * Get creator revenue and payout summary
 */
export async function GET(request: NextRequest) {
  try {
    const creatorId = request.nextUrl.searchParams.get('creatorId');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    if (!creatorId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'creatorId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const revenue = await analyticsDb.getCreatorRevenue(
      creatorId,
      new Date(startDate),
      new Date(endDate)
    );

    const topCreators = await analyticsDb.getTopCreators(10);

    logger.info('Revenue analytics retrieved', { creatorId });

    return NextResponse.json({
      creator: {
        id: creatorId,
        ...revenue,
      },
      period: { startDate, endDate },
      topCreators,
    });
  } catch (error) {
    logger.error('Error getting revenue analytics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
