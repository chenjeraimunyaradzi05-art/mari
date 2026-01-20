import request from 'supertest';
import { describe, it, expect, jest } from '@jest/globals';

// Avoid initializing a real Prisma client in tests.
jest.mock('../../utils/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

import { app } from '../../index';

describe('Legacy subscription webhook (deprecated)', () => {
  it('POST /api/subscriptions/webhook returns 410 and guidance', async () => {
    delete process.env.INTERNAL_WEBHOOK_DISABLE_KEY;
    const res = await request(app)
      .post('/api/subscriptions/webhook')
      .set('Content-Type', 'application/json')
      .send({ any: 'payload' })
      .expect(410);

    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toContain('/api/webhooks/stripe');
  });

  it('POST /api/subscriptions/webhook is silent (204) when disable key configured but missing', async () => {
    process.env.INTERNAL_WEBHOOK_DISABLE_KEY = 'secret123';

    await request(app)
      .post('/api/subscriptions/webhook')
      .set('Content-Type', 'application/json')
      .send({ any: 'payload' })
      .expect(204);
  });

  it('POST /api/subscriptions/webhook returns 200 guidance when disable key matches', async () => {
    process.env.INTERNAL_WEBHOOK_DISABLE_KEY = 'secret123';

    const res = await request(app)
      .post('/api/subscriptions/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Internal-Webhook-Disable-Key', 'secret123')
      .send({ any: 'payload' })
      .expect(200);

    expect(res.body.success).toBe(false);
    expect(res.body.deprecated).toBe(true);
    expect(String(res.body.message)).toContain('/api/webhooks/stripe');
  });
});
