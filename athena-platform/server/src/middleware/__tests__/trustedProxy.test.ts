import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  forwardedClientIp,
  MIN_SECRET_LENGTH,
  PROXY_CLIENT_IP_HEADER,
  PROXY_REJECTED_OPERATION,
  PROXY_SECRET_HEADER,
  PROXY_TRUSTED_OPERATION,
  trustedProxyIdentity,
} from '../trustedProxy';
import { secretMatches, secretMatchesAny } from '../../utils/secret-compare';
import { opsSnapshot, resetOpsMetrics } from '../../utils/ops-metrics';

const SECRET = 'a-proxy-secret-that-is-long-enough-to-count';

function appWithProxyIdentity() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(trustedProxyIdentity);
  app.get('/whoami', (req, res) => res.json({ ip: req.ip, viaProxy: req.viaTrustedProxy === true }));
  return app;
}

describe('The address a request is judged by', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, PROXY_SHARED_SECRET: SECRET };
  });
  afterEach(() => {
    process.env = env;
  });

  it('is the forwarded one when the web proxy proves itself', async () => {
    const res = await request(appWithProxyIdentity())
      .get('/whoami')
      .set(PROXY_SECRET_HEADER, SECRET)
      .set(PROXY_CLIENT_IP_HEADER, '203.0.113.7')
      .expect(200);
    expect(res.body).toEqual({ ip: '203.0.113.7', viaProxy: true });
  });

  it('stays the socket address when the secret is wrong, missing or unconfigured', async () => {
    const wrong = await request(appWithProxyIdentity())
      .get('/whoami')
      .set(PROXY_SECRET_HEADER, 'not-the-secret')
      .set(PROXY_CLIENT_IP_HEADER, '203.0.113.7')
      .expect(200);
    expect(wrong.body.ip).not.toBe('203.0.113.7');
    expect(wrong.body.viaProxy).toBe(false);

    const missing = await request(appWithProxyIdentity())
      .get('/whoami')
      .set(PROXY_CLIENT_IP_HEADER, '203.0.113.7')
      .expect(200);
    expect(missing.body.ip).not.toBe('203.0.113.7');

    delete process.env.PROXY_SHARED_SECRET;
    const unconfigured = await request(appWithProxyIdentity())
      .get('/whoami')
      .set(PROXY_SECRET_HEADER, SECRET)
      .set(PROXY_CLIENT_IP_HEADER, '203.0.113.7')
      .expect(200);
    expect(unconfigured.body.ip).not.toBe('203.0.113.7');
  });

  it('ignores a forwarded value that is not an address', () => {
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: SECRET, [PROXY_CLIENT_IP_HEADER]: 'evil' }, SECRET)).toBeNull();
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: SECRET, [PROXY_CLIENT_IP_HEADER]: '' }, SECRET)).toBeNull();
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: SECRET, [PROXY_CLIENT_IP_HEADER]: '2001:db8::1' }, SECRET)).toBe('2001:db8::1');
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: SECRET, [PROXY_CLIENT_IP_HEADER]: '10.0.0.1' }, 'short')).toBeNull();
  });

  it('refuses a secret too short to be one', () => {
    process.env.PROXY_SHARED_SECRET = 'tiny';
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: 'tiny', [PROXY_CLIENT_IP_HEADER]: '203.0.113.7' })).toBeNull();
  });

  it('holds a secret to the same 32 characters the production boot check does', () => {
    // 20 characters used to be believed here while env.ts refused it at boot.
    const twenty = 'twenty-characters-xx';
    process.env.PROXY_SHARED_SECRET = twenty;
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: twenty, [PROXY_CLIENT_IP_HEADER]: '203.0.113.7' })).toBeNull();

    const thirtyTwo = 'x'.repeat(MIN_SECRET_LENGTH);
    process.env.PROXY_SHARED_SECRET = thirtyTwo;
    expect(forwardedClientIp({ [PROXY_SECRET_HEADER]: thirtyTwo, [PROXY_CLIENT_IP_HEADER]: '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('counts proved and refused proxy requests where an operator can see them', async () => {
    resetOpsMetrics();
    const app = appWithProxyIdentity();

    await request(app).get('/whoami').set(PROXY_SECRET_HEADER, SECRET).set(PROXY_CLIENT_IP_HEADER, '203.0.113.7').expect(200);
    await request(app).get('/whoami').set(PROXY_SECRET_HEADER, 'not-the-secret').set(PROXY_CLIENT_IP_HEADER, '203.0.113.7').expect(200);
    // A request with no header at all is a phone or a direct caller, and is
    // not counted either way.
    await request(app).get('/whoami').expect(200);

    const ops = opsSnapshot().operations;
    expect(ops[PROXY_TRUSTED_OPERATION]).toMatchObject({ success: 1, failure: 0 });
    // Ignored, not failed: a stranger sending a wrong header must not be able
    // to hold the health check at degraded.
    expect(ops[PROXY_REJECTED_OPERATION]).toMatchObject({ ignored: 1, failure: 0 });
    expect(opsSnapshot().recentFailures).toEqual([]);
  });
});

describe('secretMatches', () => {
  it('matches only the exact secret, whatever the lengths, and never when nothing is configured', () => {
    expect(secretMatches('s3cret', 's3cret')).toBe(true);
    expect(secretMatches('s3cre', 's3cret')).toBe(false);
    expect(secretMatches('s3cret-longer', 's3cret')).toBe(false);
    expect(secretMatches('S3CRET', 's3cret')).toBe(false);
    expect(secretMatches('anything', undefined)).toBe(false);
    expect(secretMatches('anything', '')).toBe(false);
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches(['s3cret'], 's3cret')).toBe(false);
    expect(secretMatches(undefined, 's3cret')).toBe(false);
  });

  it('accepts any of several configured secrets', () => {
    expect(secretMatchesAny('two', ['one', 'two'])).toBe(true);
    expect(secretMatchesAny('three', ['one', 'two'])).toBe(false);
    expect(secretMatchesAny('one', [undefined, '', 'one'])).toBe(true);
    expect(secretMatchesAny('one', [])).toBe(false);
  });
});
