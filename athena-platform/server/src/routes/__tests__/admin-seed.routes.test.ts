import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

// Mocks must be defined before the router imports them.
jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    post: { count: jest.fn(), upsert: jest.fn() },
    video: { count: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// The real limiter reaches for Redis; the gates are what these tests cover.
jest.mock('../../middleware/rateLimiter', () => ({
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

import seedRouter from '../admin-seed.routes';
import { prisma } from '../../utils/prisma';

const VALID_TOKEN = 'a'.repeat(32);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/seed', seedRouter);
  return app;
}

const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('Admin seed routes - access gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setEnv({
      NODE_ENV: 'development',
      ALLOW_DB_SEEDING: 'true',
      SEED_API_TOKEN: VALID_TOKEN,
    });
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('404s when ALLOW_DB_SEEDING is not enabled', async () => {
    setEnv({ ALLOW_DB_SEEDING: undefined });

    const res = await request(buildApp())
      .get('/api/admin/seed/status')
      .set('x-seed-token', VALID_TOKEN);

    expect(res.status).toBe(404);
  });

  it('404s in production even when seeding is enabled and the token is correct', async () => {
    setEnv({ NODE_ENV: 'production' });

    const res = await request(buildApp())
      .get('/api/admin/seed/status')
      .set('x-seed-token', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('404s when SEED_API_TOKEN is shorter than 32 characters', async () => {
    setEnv({ SEED_API_TOKEN: 'too-short' });

    const res = await request(buildApp())
      .get('/api/admin/seed/status')
      .set('x-seed-token', 'too-short');

    expect(res.status).toBe(404);
  });

  it('404s when the request token does not match', async () => {
    const res = await request(buildApp())
      .get('/api/admin/seed/status')
      .set('x-seed-token', 'b'.repeat(32));

    expect(res.status).toBe(404);
  });

  it('404s when no token header is sent at all', async () => {
    const res = await request(buildApp()).get('/api/admin/seed/status');

    expect(res.status).toBe(404);
  });

  it('allows the request when every gate passes', async () => {
    (prisma.user.count as any).mockResolvedValue(12);
    (prisma.post.count as any).mockResolvedValue(34);
    (prisma.video.count as any).mockResolvedValue(8);

    const res = await request(buildApp())
      .get('/api/admin/seed/status')
      .set('x-seed-token', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ users: 12, posts: 34, videos: 8, admins: 12 });
  });

  it('rejects seeding content when there are no users to attribute it to', async () => {
    (prisma.user.findMany as any).mockResolvedValue([]);

    const res = await request(buildApp())
      .post('/api/admin/seed/content')
      .set('x-seed-token', VALID_TOKEN)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Seed users first/i);
  });
});
