import { NextRequest } from 'next/server';
import { DELETE } from '../../src/app/api/campaigns/[id]/route';

jest.mock('../../src/lib/db', () => ({
  campaignDb: {
    delete: jest.fn().mockResolvedValue({ id: 'camp1', status: 'archived' }),
  },
}));

describe('API Handler: DELETE /api/campaigns/[id]', () => {
  it('soft deletes a campaign', async () => {
    const req = { method: 'DELETE' } as unknown as NextRequest;
    const params = Promise.resolve({ id: 'camp1' });

    const res = await DELETE(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.campaign.id).toBe('camp1');
  });
});
