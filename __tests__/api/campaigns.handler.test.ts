import { NextRequest } from 'next/server';

jest.mock('../../src/lib/db', () => ({
  campaignDb: {
    findByOrganization: jest.fn().mockResolvedValue([
      { id: 'c1', name: 'Test Campaign', organizationId: 'org-123' }
    ]),
  },
}));

import { GET } from '../../src/app/api/campaigns/route';

describe('API Handler: /api/campaigns', () => {
  it('returns 200 and a campaigns array (mocked)', async () => {
    // Mock NextRequest with organizationId param
    const req = {
      method: 'GET',
      headers: new Headers(),
      nextUrl: { searchParams: new URLSearchParams({ organizationId: 'org-123' }) },
      json: async () => ({}),
    } as unknown as NextRequest;

    // Call the handler
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.pagination).toBeDefined();
  });
});
