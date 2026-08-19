import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { resolveWorkerRedisUrl, validateWorkerStartupConfiguration } from '../utils/worker-config';

describe('validateWorkerStartupConfiguration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('requires Redis in production when workers are enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_WORKERS = 'true';

    const result = validateWorkerStartupConfiguration();

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('REDIS_URL')]));
  });

  it('requires provider URLs when workers are enabled and simulation is disabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_WORKERS = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.WORKER_ALLOW_SIMULATION = 'false';
    process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'false';
    process.env.PUSH_NOTIFICATION_ALLOW_SIMULATION = 'false';
    process.env.DATA_EXPORT_ALLOW_SIMULATION = 'false';

    const result = validateWorkerStartupConfiguration();

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('VIDEO_PROCESSOR_URL'),
        expect.stringContaining('PUSH_NOTIFICATION_PROVIDER_URL'),
        expect.stringContaining('DATA_EXPORT_PROCESSOR_URL'),
      ])
    );
  });

  it('passes when production workers are explicitly configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_WORKERS = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.VIDEO_PROCESSOR_URL = 'https://processor.example.test';
    process.env.PUSH_NOTIFICATION_PROVIDER_URL = 'https://push.example.test';
    process.env.DATA_EXPORT_PROCESSOR_URL = 'https://export.example.test';
    process.env.WORKER_ALLOW_SIMULATION = 'false';
    process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'false';
    process.env.PUSH_NOTIFICATION_ALLOW_SIMULATION = 'false';
    process.env.DATA_EXPORT_ALLOW_SIMULATION = 'false';

    const result = validateWorkerStartupConfiguration();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires the enable flag for dedicated production worker startup', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_WORKERS;
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.VIDEO_PROCESSOR_URL = 'https://processor.example.test';
    process.env.PUSH_NOTIFICATION_PROVIDER_URL = 'https://push.example.test';
    process.env.DATA_EXPORT_PROCESSOR_URL = 'https://export.example.test';

    const result = validateWorkerStartupConfiguration({
      forceEnabled: true,
      requireEnableFlag: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('ENABLE_WORKERS=true')]));
  });

  it('does not fall back to localhost Redis in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;

    expect(() => resolveWorkerRedisUrl()).toThrow(/REDIS_URL/);
  });

  it('allows localhost Redis fallback outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_URL;

    expect(resolveWorkerRedisUrl()).toBe('redis://localhost:6379');
  });
});
