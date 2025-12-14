import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// GET /api/analytics/leads
export async function GET() {
  try {
    // Simulate funnel data
    const funnel = [
      { stage: 'new', count: 120 },
      { stage: 'contacted', count: 80 },
      { stage: 'qualified', count: 40 },
      { stage: 'converted', count: 10 },
    ];
    logger.info('Lead funnel analytics listed', { stages: funnel.length });
    return NextResponse.json({ funnel });
  } catch (error) {
    logger.error('Error listing lead funnel analytics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
