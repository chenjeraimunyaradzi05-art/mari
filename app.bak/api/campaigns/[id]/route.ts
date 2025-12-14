import { NextRequest, NextResponse } from 'next/server';
import { campaignDb } from '@/lib/db';
import { NotFoundError, isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * GET /api/campaigns/[id]
 * Get campaign details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await campaignDb.findById(params.id);
    logger.info('Campaign retrieved', { campaignId: params.id });
    return NextResponse.json(campaign);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('Error getting campaign', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update campaign
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const campaign = await campaignDb.update(params.id, body);
    logger.info('Campaign updated', { campaignId: params.id });
    return NextResponse.json(campaign);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('Error updating campaign', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
