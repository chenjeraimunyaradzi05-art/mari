import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/ad-templates/route';

describe('GET /api/ad-templates', () => {
  it('should return ad template list', async () => {
    const req = { method: 'GET' } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.templates.length).toBeGreaterThan(0);
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.templates[0]).toHaveProperty('id');
    expect(data.templates[0]).toHaveProperty('name');
    expect(data.templates[0]).toHaveProperty('dimensions');
  });
});
