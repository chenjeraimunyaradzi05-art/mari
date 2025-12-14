import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/leads/score/route';

const mockUpdate = jest.fn();

jest.mock('../../src/lib/db', () => ({
  leadDb: {
    findById: jest.fn().mockResolvedValue({
      id: 'lead1',
      source: 'ad_campaign',
      tier: 'warm',
      createdAt: new Date().toISOString(),
    }),
    updateScore: (...args: unknown[]) => mockUpdate(...args),
  },
}));

describe('API Handler: /api/leads/score', () => {
  it('scores and persists a lead', async () => {
    const req = {
      method: 'POST',
      headers: new Headers(),
      json: async () => ({ leadId: 'lead1' }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leadId).toBe('lead1');
    expect(typeof body.score).toBe('number');
    expect(['hot', 'warm', 'cold']).toContain(body.tier);
    expect(mockUpdate).toHaveBeenCalledWith(
      'lead1', 
      expect.any(Number), 
      expect.any(String),
      expect.anything(),
      expect.anything()
    );
  });
});
