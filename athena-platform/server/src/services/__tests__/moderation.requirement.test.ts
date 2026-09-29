/**
 * What member content does when nothing is configured to screen it.
 *
 * It used to publish, in every environment, with the gap announced in a log
 * line, counted, and shown on the readiness check — but never decided by
 * anybody. A production deployment whose key had lapsed published every post
 * and every image the platform received unread. MODERATION_REQUIRED is now the
 * decision, and production defaults to refusing what the whole community sees
 * while keeping conversations open, so a woman writing to a support line is
 * never cut off by a missing key.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('openai', () => jest.fn().mockImplementation(() => ({ moderations: { create: jest.fn() } })));

jest.mock('../../utils/prisma', () => ({ prisma: { adminFlag: { create: jest.fn() } } }));

jest.mock('../../utils/cache', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type ModerationModule = typeof import('../moderation.service');

/** The mocks the most recently loaded copy of the module writes to. */
let recordFailure: jest.Mock;
let loggerError: jest.Mock;

const savedEnv = { ...process.env };

/** The module reads its keys when it loads, so each case loads its own copy. */
function loadWithoutProviders(env: Record<string, string | undefined>): ModerationModule {
  delete process.env.AI_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  let loaded: ModerationModule | undefined;
  jest.isolateModules(() => {
    // A fresh copy of the module per case is the point of isolateModules, and
    // only a synchronous require can load one inside its callback; its mocks
    // are read from the same registry so the assertions see what it wrote.
    /* eslint-disable @typescript-eslint/no-require-imports */
    loaded = require('../moderation.service') as ModerationModule;
    recordFailure = (require('../../utils/ops-metrics') as { recordFailure: jest.Mock }).recordFailure;
    loggerError = (require('../../utils/logger') as { logger: { error: jest.Mock } }).logger.error;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return loaded!;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('The MODERATION_REQUIRED decision', () => {
  it('defaults to refusing public content in production and to publishing elsewhere', () => {
    expect(loadWithoutProviders({ NODE_ENV: 'production', MODERATION_REQUIRED: undefined }).moderationRequirement()).toBe('public');
    expect(loadWithoutProviders({ NODE_ENV: 'development', MODERATION_REQUIRED: undefined }).moderationRequirement()).toBe('off');
  });

  it('reads the words an operator would write', () => {
    const service = loadWithoutProviders({ NODE_ENV: 'production' });
    const answers = (['off', 'false', 'public', 'TRUE', 'all'] as const).map((value) => {
      process.env.MODERATION_REQUIRED = value;
      return service.moderationRequirement();
    });
    expect(answers).toEqual(['off', 'off', 'public', 'public', 'all']);
  });

  it('falls back to the environment default on a value it cannot read, and says so', () => {
    const service = loadWithoutProviders({ NODE_ENV: 'production', MODERATION_REQUIRED: 'sometimes' });
    expect(service.moderationRequirement()).toBe('public');
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('MODERATION_REQUIRED'), { value: 'sometimes' });
  });
});

describe('Text with no provider', () => {
  it("refuses a post with a 503 that tells her it is our outage, not her words, under 'public'", async () => {
    const service = loadWithoutProviders({ MODERATION_REQUIRED: 'public' });

    await expect(service.assertContentAllowed('Hello everyone', { kind: 'post', userId: 'u1' })).rejects.toMatchObject({
      statusCode: 503,
      message: service.PUBLISHING_PAUSED,
    });
    await expect(service.assertContentAllowed('My new bio', { kind: 'profile', userId: 'u1' })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_refused', expect.any(Error));
  });

  it("keeps conversations open under 'public', and counts them", async () => {
    const service = loadWithoutProviders({ MODERATION_REQUIRED: 'public' });

    await expect(
      service.assertContentAllowed('Is anyone on the support line tonight?', { kind: 'message', userId: 'u1' })
    ).resolves.toBeUndefined();
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_publish', expect.any(Error));
  });

  it("refuses conversations too under 'all'", async () => {
    const service = loadWithoutProviders({ MODERATION_REQUIRED: 'all' });

    await expect(service.assertContentAllowed('Hi', { kind: 'live_chat', userId: 'u1' })).rejects.toMatchObject({
      statusCode: 503,
      message: service.MESSAGE_CHECK_UNAVAILABLE,
    });
  });

  it("publishes and counts every write under 'off'", async () => {
    const service = loadWithoutProviders({ MODERATION_REQUIRED: 'off', NODE_ENV: 'production' });

    await expect(service.assertContentAllowed('Hello everyone', { kind: 'post', userId: 'u1' })).resolves.toBeUndefined();
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_publish', expect.any(Error));
  });
});

describe('Images with no provider', () => {
  it("refuses an upload with a 503 whenever screening is required", async () => {
    const service = loadWithoutProviders({ MODERATION_REQUIRED: 'public' });

    await expect(service.moderateImage(Buffer.from('image'))).rejects.toMatchObject({
      statusCode: 503,
      message: service.IMAGE_CHECK_UNAVAILABLE,
    });
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_image_refused', expect.any(Error));
  });

  it("lets it through, counted, under 'off'", async () => {
    const service = loadWithoutProviders({ MODERATION_REQUIRED: 'off' });

    await expect(service.moderateImage(Buffer.from('image'))).resolves.toMatchObject({ action: 'allow' });
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_image', expect.any(Error));
    expect(service.isImageModerationConfigured()).toBe(false);
  });
});
