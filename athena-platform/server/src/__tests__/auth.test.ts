import request from 'supertest';

// Keep metrics endpoint open in tests
delete process.env.METRICS_TOKEN;

import { app } from '../index';

describe('auth endpoints (validation-only)', () => {
  it('POST /api/auth/register returns 400 for invalid payload', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('POST /api/auth/login returns 400 for invalid payload', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
  });

  it('POST /api/auth/refresh returns 400 when refreshToken is missing', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .send({})
      .expect(400);
  });

  it('POST /api/auth/logout returns 401 without Authorization header', async () => {
    await request(app)
      .post('/api/auth/logout')
      .send({})
      .expect(401);
  });
});
