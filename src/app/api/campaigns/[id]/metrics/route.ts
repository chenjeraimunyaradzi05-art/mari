import { NextRequest, NextResponse } from 'next/server';
import { campaignDb } from '@/lib/db';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * GET /api/campaigns/[id]/metrics
 * Get campaign daily metrics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
    const metrics = await campaignDb.getMetrics(id, days);

    logger.info('Campaign metrics retrieved', { campaignId: id, days });

    return NextResponse.json({
      campaignId: id,
      metrics,
      period: days,
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('Error getting metrics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
