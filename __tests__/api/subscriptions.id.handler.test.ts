import { NextRequest } from 'next/server';
import { PATCH } from '../../src/app/api/subscriptions/[id]/route';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn().mockResolvedValue({
        id: '123',
        tier: 'free',
        status: 'active',
        stripeSubscriptionId: null, // Simulating local subscription for simplicity
      }),
      update: jest.fn().mockImplementation((args) => Promise.resolve({
        id: args.where.id,
        tier: args.data.tier,
        status: 'updated', // Mock return value
      })),
    },
  },
}));

describe('PATCH /api/subscriptions/:id', () => {
  it('should update subscription and return updated status', async () => {
    const req = {
      method: 'PATCH',
      json: async () => ({ tier: 'premium', status: 'active' })
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('123');
    expect(data.tier).toBe('premium');
    expect(data.status).toBe('updated');
  });

  it('should fail validation for invalid status', async () => {
    const req = {
      method: 'PATCH',
      json: async () => ({ tier: 'premium', status: 'invalid_status' })
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });
});
