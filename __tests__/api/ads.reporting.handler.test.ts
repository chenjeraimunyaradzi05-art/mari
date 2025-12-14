import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/ads/reporting/route';

jest.mock('../../src/lib/db', () => {
  const mockMetrics = [
    { campaignId: 'c1', impressions: 10n, clicks: 2n, conversions: 1n, spendCents: 500n },
    { campaignId: 'c1', impressions: 5n, clicks: 1n, conversions: 0n, spendCents: 200n },
    { campaignId: 'c2', impressions: 8n, clicks: 1n, conversions: 1n, spendCents: 300n },
  ];
  return {
    prisma: {
      adCampaign: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
      },
      adMetricsDaily: {
        findMany: jest.fn().mockResolvedValue(mockMetrics),
      },
    },
  };
});

describe('API Handler: /api/ads/reporting', () => {
  it('aggregates metrics for organization campaigns', async () => {
    const req = {
      method: 'GET',
      nextUrl: {
        searchParams: new URLSearchParams({
          organizationId: 'org1',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        }),
      },
      headers: new Headers(),
    } as unknown as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    const c1 = body.data.find((r: { campaignId: string }) => r.campaignId === 'c1');
    expect(c1?.impressions).toBe(15);
    expect(body.summary.spendCents).toBe(1000);
  });
});
