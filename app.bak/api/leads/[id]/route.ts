import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UpdateLeadSchema } from '@/lib/validations';
import { leadDb } from '@/lib/db';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * GET /api/leads/[id]
 * Get lead details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await leadDb.findById(params.id);
    logger.info('Lead retrieved', { leadId: params.id });
    return NextResponse.json(lead);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('Error getting lead', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/[id]
 * Update lead status or tier
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = UpdateLeadSchema.parse(body);

    const lead = await leadDb.update(params.id, validated);
    logger.info('Lead updated', { leadId: params.id });

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('Error updating lead', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
