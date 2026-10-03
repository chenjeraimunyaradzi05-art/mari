import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * GET /readyz, the probe the uptime workflow reads.
 *
 * It proved Postgres and nothing else. In production Redis is as much a
 * dependency: with it gone the nine scheduled sweeps are paused (escrow-expiry
 * warnings, reminders, scheduled posts) and the rate-limit counters are kept per
 * process, and the probe reported ready for as long as it lasted. It answers
 * 503 now. The host's own check stays on /livez (render.yaml, fly.toml), so a
 * Redis blip is reported, not answered with a restart of a healthy API.
 */

const mockQueryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRedisReady = jest.fn<() => Promise<boolean>>();
const mockLoggerError = jest.fn();

jest.mock('../utils/prisma', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
  connectWithRetry: jest.fn(async () => undefined),
}));

jest.mock('../utils/redis', () => ({
  ...jest.requireActual<typeof import('../utils/redis')>('../utils/redis'),
  redisReadyForTraffic: () => mockRedisReady(),
}));

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: (...args: unknown[]) => mockLoggerError(...args) },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../index';

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
  mockRedisReady.mockReset();
  mockRedisReady.mockResolvedValue(true);
  mockLoggerError.mockReset();
});

describe('GET /readyz', () => {
  it('is ready when Postgres and Redis answer', async () => {
    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(mockRedisReady).toHaveBeenCalledTimes(1);
  });

  it('is not ready when Redis does not answer, though Postgres does, and says only that the answer is no', async () => {
    mockRedisReady.mockResolvedValue(false);

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    // The route answers anyone; which dependency it was is in the log.
    expect(Object.keys(response.body).sort()).toEqual(['status', 'timestamp']);
    expect(JSON.stringify(response.body)).not.toMatch(/redis/i);
    expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Redis does not answer'));
  });

  it('is not ready when Postgres does not answer, and does not need to ask Redis', async () => {
    mockQueryRaw.mockRejectedValue(new Error("Can't reach database server at `ep-secret.neon.tech`:`5432`"));

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('ep-secret');
    expect(mockRedisReady).not.toHaveBeenCalled();
  });

  it('stays on /livez for the host: a Redis that does not answer does not make the process look dead', async () => {
    mockRedisReady.mockResolvedValue(false);

    const response = await request(app).get('/livez');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('live');
  });
});
