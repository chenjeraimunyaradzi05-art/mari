import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/feed/ranked/route';

jest.mock('../../src/lib/feed/ranker', () => ({
  getRankedFeed: jest.fn().mockResolvedValue({
    data: [],
    generatedAt: new Date().toISOString(),
    bucket: 'control',
    fromCache: false,
  }),
}));

describe('API Handler: /api/feed/ranked', () => {
  it('returns 200 and an empty feed array (mocked)', async () => {
    const req = {
      method: 'GET',
      nextUrl: { searchParams: new URLSearchParams({ limit: '10' }) },
    } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.meta.limit).toBe(10);
  });
});
