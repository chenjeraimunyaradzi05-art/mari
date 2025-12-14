import { NextRequest } from 'next/server';

jest.mock('../../src/lib/db', () => ({
  videoDb: {
    findById: jest.fn().mockResolvedValue({ id: 'vid-1', title: 'Demo Video', duration: 120 }),
    update: jest.fn().mockResolvedValue({ id: 'vid-1', title: 'Demo Video', duration: 120, captions: 'updated' }),
  },
}));

import { GET } from '../../src/app/api/videos/[id]/route';

describe('API Handler: /api/videos/[id]', () => {
  it('returns 200 and a video object (mocked)', async () => {
    const req = { method: 'GET' } as unknown as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: 'vid-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.videoId).toBe('vid-1');
    expect(data.title).toBe('Sample Video');
    expect(data.status).toBe('ok');
    expect(data.variants).toEqual(['360p', '720p', '1080p']);
  });
});

describe('PATCH /api/videos/:id/captions', () => {
  it('should update captions and return updated video', async () => {
    const req = {
      method: 'PATCH',
      json: async () => ({ captions: 'https://example.com/captions.vtt', captionStatus: 'completed' })
    } as unknown as NextRequest;
    const { PATCH } = await import('../../src/app/api/videos/[id]/route');
    const res = await PATCH(req, { params: Promise.resolve({ id: 'vid-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.videoId).toBe('vid-1');
    expect(data.captions).toBe('https://example.com/captions.vtt');
    expect(data.captionStatus).toBe('completed');
    expect(data.updated).toBe(true);
  });

  it('should fail validation for missing captions', async () => {
    const req = {
      method: 'PATCH',
      json: async () => ({ status: 'approved' })
    } as unknown as NextRequest;
    const { PATCH } = await import('../../src/app/api/videos/[id]/route');
    const res = await PATCH(req, { params: Promise.resolve({ id: 'vid-1' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });
});
