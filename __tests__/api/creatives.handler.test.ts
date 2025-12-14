import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/creatives/route';

jest.mock('../../src/lib/db', () => ({
  creativeDb: {
    findByCampaign: jest.fn().mockResolvedValue([{ id: 'cr1', title: 'Creative 1', campaignId: 'camp1' }]),
    create: jest.fn().mockResolvedValue({ id: 'cr-new', title: 'New Creative', campaignId: 'camp1' }),
  },
}));

describe('API Handler: /api/creatives', () => {
  it('lists creatives by campaign', async () => {
    const req = {
      method: 'GET',
      nextUrl: { searchParams: new URLSearchParams({ campaignId: 'camp1' }) },
      headers: new Headers(),
    } as unknown as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe('cr1');
  });

  it('creates a creative', async () => {
    const payload = {
      campaignId: 'camp1',
      organizationId: 'org1',
      title: 'Hero',
      description: 'desc',
      mediaUrl: 'https://example.com/img.png',
      mediaType: 'image',
      callToAction: 'Apply',
      landingUrl: 'https://example.com',
      format: 'image',
    };

    const req = {
      method: 'POST',
      headers: new Headers(),
      json: async () => payload,
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('cr-new');
    expect(body.campaignId).toBe('camp1');
  });
});
