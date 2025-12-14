import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/analytics/videos/route';

describe('GET /api/analytics/videos', () => {
  it('should return video analytics data', async () => {
    const req = { method: 'GET' } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ views: 1000, likes: 100, shares: 10, watchTime: 5000, engagementRate: 0.12 });
  });
});
