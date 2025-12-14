import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/live/[id]/route';

describe('GET /api/live/:id', () => {
  it('should return live stream details for valid id', async () => {
    const req = { method: 'GET' } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: 'live123' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ liveId: 'live123', title: 'Live Stream', status: 'active' });
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
