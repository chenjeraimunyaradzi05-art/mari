import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreateCampaignSchema, CampaignListSchema, UpdateCampaignSchema } from '@/lib/validations';
import { campaignDb } from '@/lib/db';
import { ValidationError, isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * POST /api/campaigns
 * Create a new ad campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateCampaignSchema.parse(body);

    const campaign = await campaignDb.create(validated);

    logger.info('Campaign created', { campaignId: campaign.id });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error creating campaign', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/campaigns
 * List all campaigns with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;
    const campaigns = await campaignDb.findByOrganization(organizationId, skip, limit);

    logger.info('Campaigns listed', { organizationId, count: campaigns.length });

    return NextResponse.json({
      data: campaigns,
      pagination: { page, limit, count: campaigns.length },
    });
  } catch (error) {
    logger.error('Error listing campaigns', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
