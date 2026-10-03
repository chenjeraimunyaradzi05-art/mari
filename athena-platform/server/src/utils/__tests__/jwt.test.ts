import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  DEFAULT_ACCESS_TOKEN_LIFETIME,
  DEFAULT_REFRESH_TOKEN_LIFETIME,
  generateAccessToken,
  generateRefreshToken,
  getJwtSecretOrThrow,
  isTokenOfType,
  mayUseDevelopmentJwtSecret,
  verifyToken,
} from '../jwt';

const payload = { userId: 'u1', email: 'u@athena.com', role: 'USER', persona: 'EARLY_CAREER' };
const SECRET = 'a-test-secret-that-is-at-least-32-characters';

describe('Tokens know which door they open', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test', JWT_SECRET: SECRET };
  });
  afterEach(() => {
    process.env = env;
  });

  it('an access token is not a refresh token, and a refresh token is not an access token', () => {
    const access = generateAccessToken(payload);
    const refresh = generateRefreshToken(payload);

    expect(verifyToken(access, 'access').userId).toBe('u1');
    expect(verifyToken(refresh, 'refresh').userId).toBe('u1');
    expect(() => verifyToken(access, 'refresh')).toThrow(jwt.JsonWebTokenError);
    expect(() => verifyToken(refresh, 'access')).toThrow(jwt.JsonWebTokenError);
    // Without a stated expectation the signature alone is checked, as before.
    expect(verifyToken(refresh).userId).toBe('u1');
  });

  it('a refresh token issued before the claim existed still refreshes; it never grants access', () => {
    const legacy = jwt.sign(payload, SECRET, { expiresIn: '1h' });
    expect(verifyToken(legacy, 'refresh').userId).toBe('u1');
    expect(() => verifyToken(legacy, 'access')).toThrow(jwt.JsonWebTokenError);
    expect(isTokenOfType({}, 'refresh')).toBe(true);
    expect(isTokenOfType({}, 'access')).toBe(false);
  });

  it('only the algorithm this server signs with is accepted', () => {
    const none = jwt.sign({ ...payload, typ: 'access' }, '', { algorithm: 'none' });
    expect(() => verifyToken(none, 'access')).toThrow(jwt.JsonWebTokenError);

    const otherHmac = jwt.sign({ ...payload, typ: 'access' }, SECRET, { algorithm: 'HS512' });
    expect(() => verifyToken(otherHmac, 'access')).toThrow(jwt.JsonWebTokenError);
  });
});

describe('There is no signing key to fall back on outside development and test', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = env;
  });

  function withoutSecret(nodeEnv: string | undefined) {
    const next = { ...env } as Record<string, string | undefined>;
    delete next.JWT_SECRET;
    if (nodeEnv === undefined) delete next.NODE_ENV;
    else next.NODE_ENV = nodeEnv;
    process.env = next as NodeJS.ProcessEnv;
  }

  it.each(['production', 'staging', 'preview', undefined])(
    'refuses to sign or verify when NODE_ENV is %s and JWT_SECRET is not set',
    (nodeEnv) => {
      withoutSecret(nodeEnv);
      expect(() => getJwtSecretOrThrow()).toThrow(/JWT_SECRET must be set/);
      expect(() => generateAccessToken(payload)).toThrow(/JWT_SECRET must be set/);
      expect(() => generateRefreshToken(payload)).toThrow(/JWT_SECRET must be set/);
      expect(() => verifyToken('anything.at.all')).toThrow(/JWT_SECRET must be set/);
      expect(mayUseDevelopmentJwtSecret()).toBe(false);
    }
  );

  it('says which NODE_ENV it saw, so a mistyped one is found quickly', () => {
    withoutSecret('stagign');
    expect(() => getJwtSecretOrThrow()).toThrow('NODE_ENV is "stagign"');
    withoutSecret(undefined);
    expect(() => getJwtSecretOrThrow()).toThrow('NODE_ENV is not set');
  });

  it.each(['development', 'test'])('signs with the built-in key when NODE_ENV is %s', (nodeEnv) => {
    withoutSecret(nodeEnv);
    expect(mayUseDevelopmentJwtSecret()).toBe(true);
    expect(verifyToken(generateAccessToken(payload), 'access').userId).toBe('u1');
  });

  it('uses the configured secret everywhere, production included', () => {
    process.env = { ...env, NODE_ENV: 'production', JWT_SECRET: SECRET } as NodeJS.ProcessEnv;
    expect(getJwtSecretOrThrow()).toBe(SECRET);
    expect(verifyToken(generateAccessToken(payload), 'access').userId).toBe('u1');
  });

  it('does not accept a token signed with the built-in key once a real secret is configured', () => {
    process.env = { ...env, NODE_ENV: 'production', JWT_SECRET: SECRET } as NodeJS.ProcessEnv;
    const forged = jwt.sign({ ...payload, typ: 'access' }, 'dev-only-secret-not-for-production', { algorithm: 'HS256' });
    expect(() => verifyToken(forged, 'access')).toThrow(jwt.JsonWebTokenError);
  });
});

describe('Token lifetimes are one pair, in code and in every deployment file', () => {
  const root = path.resolve(__dirname, '..', '..', '..', '..', '..');

  function lifetimeFrom(file: string, key: string): string {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    // render.yaml:  - key: JWT_EXPIRES_IN / value: 15m      fly.toml:  JWT_EXPIRES_IN = "15m"
    const yaml = new RegExp(String.raw`key:\s*${key}\s+value:\s*["']?([0-9]+[smhd])["']?`).exec(text);
    const toml = new RegExp(String.raw`^\s*${key}\s*=\s*"([0-9]+[smhd])"`, 'm').exec(text);
    const found = yaml?.[1] ?? toml?.[1];
    if (!found) throw new Error(`${key} not found in ${file}`);
    return found;
  }

  it('the defaults are fifteen minutes and a week', () => {
    expect(DEFAULT_ACCESS_TOKEN_LIFETIME).toBe('15m');
    expect(DEFAULT_REFRESH_TOKEN_LIFETIME).toBe('7d');
  });

  it.each(['render.yaml', 'athena-platform/server/fly.toml'])('%s deploys the same pair the code defaults to', (file) => {
    expect(lifetimeFrom(file, 'JWT_EXPIRES_IN')).toBe(DEFAULT_ACCESS_TOKEN_LIFETIME);
    expect(lifetimeFrom(file, 'JWT_REFRESH_EXPIRES_IN')).toBe(DEFAULT_REFRESH_TOKEN_LIFETIME);
  });

  it('a deployment that sets neither variable gets a 15 minute access token and a 7 day refresh token', () => {
    const next = { ...process.env, NODE_ENV: 'test', JWT_SECRET: SECRET } as Record<string, string | undefined>;
    delete next.JWT_EXPIRES_IN;
    delete next.JWT_REFRESH_EXPIRES_IN;
    const saved = process.env;
    process.env = next as NodeJS.ProcessEnv;
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fresh = require('../jwt') as typeof import('../jwt');
        const access = jwt.decode(fresh.generateAccessToken(payload)) as { exp: number; iat: number };
        const refresh = jwt.decode(fresh.generateRefreshToken(payload)) as { exp: number; iat: number };
        expect(access.exp - access.iat).toBe(15 * 60);
        expect(refresh.exp - refresh.iat).toBe(7 * 24 * 60 * 60);
      });
    } finally {
      process.env = saved;
    }
  });
});
