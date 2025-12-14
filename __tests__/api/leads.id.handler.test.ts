import { NextRequest } from 'next/server';

jest.mock('../../src/lib/db', () => ({
  leadDb: {
    findById: jest.fn().mockResolvedValue({ id: 'lead-1', email: 'test@example.com', score: 80 }),
    update: jest.fn().mockResolvedValue({ id: 'lead-1', score: 90 }),
  },
}));

import { GET } from '../../src/app/api/leads/[id]/route';

describe('API Handler: /api/leads/[id]', () => {
  it('returns 200 and a lead object (mocked)', async () => {
    const req = { method: 'GET' } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('lead-1');
    expect(data.email).toBe('test@example.com');
  });
});
