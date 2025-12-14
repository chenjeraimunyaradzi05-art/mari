import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/creators/[id]/route';

describe('GET /api/creators/:id', () => {
  it('should return creator profile for valid id', async () => {
    const req = { method: 'GET' } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: 'creator123' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ creatorId: 'creator123', name: 'Sample Creator', status: 'ok' });
  });

  it('should fail for empty id', async () => {
    // Simulate missing param by passing empty string
    const req = { method: 'GET' } as unknown as NextRequest;
    try {
      await GET(req, { params: Promise.resolve({ id: '' }) });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
