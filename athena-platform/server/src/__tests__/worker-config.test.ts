import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { validateWorkerStartupConfiguration } from '../utils/worker-config';

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
});
