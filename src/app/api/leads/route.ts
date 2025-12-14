import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CaptureLead } from '@/lib/validations';
import { leadDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

/**
 * POST /api/leads
 * Capture a lead
 */
export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
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
    const latency = performance.now() - start;
    recordApiMetric('api.leads.post', latency, false);
    logger.info('Lead captured', { leadId: lead.id, email: lead.email, correlationId, latencyMs: latency });

    const response = NextResponse.json(lead, { status: 201 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    if (error instanceof z.ZodError) {
      recordApiMetric('api.leads.post', latency, true);
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    recordApiMetric('api.leads.post', latency, true);
    logger.error('Error capturing lead', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}

/**
 * GET /api/leads
 * List leads
 */
export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
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

    const latency = performance.now() - start;
    recordApiMetric('api.leads.get', latency, false);
    logger.info('Leads listed', { organizationId, count: leads.length, correlationId, latencyMs: latency });

    const response = NextResponse.json({
      data: leads,
      pagination: { page, limit, count: leads.length },
    });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.leads.get', latency, true);
    logger.error('Error listing leads', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      latencyMs: latency,
    });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
