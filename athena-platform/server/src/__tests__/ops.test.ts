import request from 'supertest';

// Ensure we don't require auth for metrics in this test suite
delete process.env.METRICS_TOKEN;

import { app } from '../index';

describe('ops endpoints', () => {
  it('GET /health returns 200', async () => {
    await request(app).get('/health').expect(200);
  });

  it('GET /livez returns 200', async () => {
    await request(app).get('/livez').expect(200);
  });

  it('GET /metrics returns 200 and includes http_requests_total', async () => {
    const res = await request(app).get('/metrics').expect(200);
    expect(res.text).toContain('http_requests_total');
  });
});
