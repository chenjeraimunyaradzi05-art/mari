import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreateCampaignSchema } from '@/lib/validations';
import { campaignDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

/**
 * POST /api/campaigns
 * Create a new ad campaign
 */
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const body = await request.json();
    const validated = CreateCampaignSchema.parse(body);

    const campaign = await campaignDb.create(validated);

    const latency = performance.now() - start;
    recordApiMetric('api.campaigns.post', latency, false);
    logger.info('Campaign created', { campaignId: campaign.id, correlationId, latencyMs: latency });

    const response = NextResponse.json(campaign, { status: 201 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    if (error instanceof z.ZodError) {
      recordApiMetric('api.campaigns.post', latency, true);
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    recordApiMetric('api.campaigns.post', latency, true);
    logger.error('Error creating campaign', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}

/**
 * GET /api/campaigns
 * List all campaigns with filters
 */
export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
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

    const latency = performance.now() - start;
    recordApiMetric('api.campaigns.get', latency, false);
    logger.info('Campaigns listed', { organizationId, count: campaigns.length, correlationId, latencyMs: latency });

    const response = NextResponse.json({
      data: campaigns,
      pagination: { page, limit, count: campaigns.length },
    });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.campaigns.get', latency, true);
    logger.error('Error listing campaigns', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
