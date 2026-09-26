import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

/**
 * What "ready" means to the ML client.
 *
 * The feed ranker asked whether the whole ML service was healthy, and the
 * service says "healthy" only when every model an endpoint reads is loaded.
 * career_compass has no artefact and cannot honestly be given one, so the
 * ranker — whose router reads no model — never ran once, while the runbook
 * said it worked without an artefact. These guard the distinction: a caller
 * that needs no model is served by a degraded service, and a caller that
 * names a model is served only when that model is loaded.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type Health = { status: string; models_loaded?: Record<string, boolean> };

function loadClient(health: Health | Error) {
  const fetchMock = jest.fn(async () => {
    if (health instanceof Error) throw health;
    return { ok: true, status: 200, json: async () => health } as unknown as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  let client: typeof import('../ml.service').mlService | undefined;
  jest.isolateModules(() => {
    // A fresh copy of the module per test is the point of isolateModules, and
    // only a synchronous require can load one inside its callback.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    client = require('../ml.service').mlService;
  });
  return { client: client!, fetchMock };
}

describe('ML service readiness', () => {
  const savedFetch = global.fetch;
  const savedUrl = process.env.ML_SERVICE_URL;

  beforeEach(() => {
    process.env.ML_SERVICE_URL = 'http://ml-service:8000';
  });

  afterEach(() => {
    global.fetch = savedFetch;
    if (savedUrl === undefined) delete process.env.ML_SERVICE_URL;
    else process.env.ML_SERVICE_URL = savedUrl;
  });

  it('serves a model-free caller from a degraded service, and refuses one that needs the missing model', async () => {
    const { client } = loadClient({ status: 'degraded', models_loaded: { career_compass: false } });

    await expect(client.isReady()).resolves.toBe(true);
    await expect(client.isReady('career_compass')).resolves.toBe(false);

    // The health report still says the service is not fully ready, and says
    // separately that the ranker can run.
    const health = await client.describeHealth();
    expect(health.ready).toBe(false);
    expect(health.feedRankerCanRun).toBe(true);
  });

  it('serves a caller that names a model once the service reports it loaded', async () => {
    const { client } = loadClient({ status: 'healthy', models_loaded: { career_compass: true } });

    await expect(client.isReady('career_compass')).resolves.toBe(true);
    expect((await client.describeHealth()).ready).toBe(true);
  });

  it('is not ready for anyone when the service does not answer', async () => {
    const { client } = loadClient(new Error('getaddrinfo ENOTFOUND ml-service'));

    await expect(client.isReady()).resolves.toBe(false);
    const health = await client.describeHealth();
    expect(health.feedRankerCanRun).toBe(false);
    expect(health.error).toMatch(/ENOTFOUND/);
  });

  it('does not treat an unknown status word as answering', async () => {
    const { client } = loadClient({ status: 'starting' });

    await expect(client.isReady()).resolves.toBe(false);
  });
});
