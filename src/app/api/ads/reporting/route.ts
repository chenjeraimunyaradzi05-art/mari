import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ensureCorrelationId, recordApiMetric } from '@/lib/metrics';

const ReportingSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  campaignId: z.string().optional(),
  organizationId: z.string().optional(),
});

/**
 * GET /api/ads/reporting
 * Returns impressions/clicks/spend by campaign for a date range.
 */
export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));
  const start = performance.now();
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validated = ReportingSchema.parse(params);

    const campaignIds: string[] = [];
    if (validated.campaignId) {
      campaignIds.push(validated.campaignId);
    } else if (validated.organizationId) {
      const campaigns = await prisma.adCampaign.findMany({
        where: { organizationId: validated.organizationId, deletedAt: null },
        select: { id: true },
      });
      campaignIds.push(...campaigns.map((c) => c.id));
    } else {
      return NextResponse.json({ error: 'campaignId or organizationId is required' }, { status: 400 });
    }

    if (!campaignIds.length) {
      return NextResponse.json({ data: [], summary: { impressions: 0, clicks: 0, conversions: 0, spendCents: 0 } });
    }

    const metrics = await prisma.adMetricsDaily.findMany({
      where: {
        campaignId: { in: campaignIds },
        date: { gte: validated.startDate, lte: validated.endDate },
      },
    });

    const byCampaign: Record<string, { impressions: number; clicks: number; conversions: number; spendCents: number; conversionValue: number }> = {};
    for (const m of metrics) {
      const bucket = byCampaign[m.campaignId] || { impressions: 0, clicks: 0, conversions: 0, spendCents: 0, conversionValue: 0 };
      bucket.impressions += Number(m.impressions);
      bucket.clicks += Number(m.clicks);
      bucket.conversions += Number(m.conversions);
      bucket.spendCents += Number(m.spendCents);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bucket.conversionValue += Number((m as any).conversionValue || 0);
      byCampaign[m.campaignId] = bucket;
    }

    const rows = Object.entries(byCampaign).map(([campaignId, stats]) => ({ campaignId, ...stats }));
    const summary = rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        conversions: acc.conversions + r.conversions,
        spendCents: acc.spendCents + r.spendCents,
        conversionValue: acc.conversionValue + r.conversionValue,
      }),
      { impressions: 0, clicks: 0, conversions: 0, spendCents: 0, conversionValue: 0 }
    );

    const latency = performance.now() - start;
    recordApiMetric('api.ads.reporting.get', latency, false);
    logger.info('Reporting fetched', { campaignCount: campaignIds.length, correlationId, latencyMs: latency });

    const response = NextResponse.json({ data: rows, summary });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric('api.ads.reporting.get', latency, true);
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    logger.error('Error fetching reporting', error instanceof Error ? error : new Error(String(error)), { correlationId, latencyMs: latency });
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
}
