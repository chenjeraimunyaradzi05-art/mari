import { NextRequest } from 'next/server';

jest.mock('../../src/lib/db', () => ({
  prisma: {
    giftTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'gift-1', creatorId: 'creator-1', amount: 10 }),
    },
    liveStream: {
      update: jest.fn().mockResolvedValue({ id: 'stream-1', totalGifts: 10 }),
    },
  },
}));

import { POST } from '../../src/app/api/live/[id]/gift/route';

describe('API Handler: /api/live/[id]/gift', () => {
  it('returns 201 and a gift object (mocked)', async () => {
    const req = {
      method: 'POST',
      json: async () => ({ creatorId: 'creator-1', senderId: 'user-1', giftType: 'heart', amount: 10 }),
    } as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ id: 'creator-1' }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('gift-1');
    expect(data.creatorId).toBe('creator-1');
  });
});
