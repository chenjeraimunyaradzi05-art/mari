import { NextRequest, NextResponse } from 'next/server';
import { analyticsDb } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/campaigns
 * Get campaign analytics and dashboard metrics
 */
export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    if (!organizationId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'organizationId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const campaigns = await analyticsDb.getCampaignRevenue(
      organizationId,
      new Date(startDate),
      new Date(endDate)
    );

    logger.info('Campaign analytics retrieved', { organizationId, campaignCount: campaigns.length });

    return NextResponse.json({
      period: { startDate, endDate },
      campaigns,
      summary: {
        totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
        totalImpressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
        totalClicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
        totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
      },
    });
  } catch (error) {
    logger.error('Error getting campaign analytics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
