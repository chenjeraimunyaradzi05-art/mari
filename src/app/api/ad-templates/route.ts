import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// GET /api/ad-templates
export async function GET() {
  try {
    // Simulate ad template list
    const templates = [
      { id: '1', name: 'Banner', dimensions: '728x90' },
      { id: '2', name: 'Square', dimensions: '250x250' },
      { id: '3', name: 'Video Pre-roll', dimensions: '1920x1080' },
    ];
    logger.info('Fetched ad templates', { count: templates.length });
    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('Error fetching ad templates', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
