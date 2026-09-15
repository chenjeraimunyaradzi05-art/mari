import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  forwardedClientIp,
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  trustedProxyIdentity,
} from '../trustedProxy';
import { secretMatches, secretMatchesAny } from '../../utils/secret-compare';

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
