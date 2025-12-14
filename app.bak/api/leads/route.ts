import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CaptureLead, LeadListSchema } from '@/lib/validations';
import { leadDb } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/leads
 * Capture a lead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CaptureLead.parse(body);

    // Check for duplicate email
    const existing = await leadDb.findByEmail(validated.email);
    if (existing) {
      return NextResponse.json(
        { error: 'Lead with this email already exists', leadId: existing.id },
        { status: 409 }
      );
    }

    const lead = await leadDb.capture(validated);
    logger.info('Lead captured', { leadId: lead.id, email: lead.email });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error capturing lead', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/leads
 * List leads
 */
export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    const minScore = parseInt(request.nextUrl.searchParams.get('minScore') || '0');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;
    let leads;

    if (minScore > 0) {
      leads = await leadDb.getLeadsByScore(organizationId, minScore);
    } else {
      leads = await leadDb.findByOrganization(organizationId, skip, limit);
    }

    logger.info('Leads listed', { organizationId, count: leads.length });

    return NextResponse.json({
      data: leads,
      pagination: { page, limit, count: leads.length },
    });
  } catch (error) {
    logger.error('Error listing leads', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
