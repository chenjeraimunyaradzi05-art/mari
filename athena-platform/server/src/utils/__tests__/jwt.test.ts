import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { generateAccessToken, generateRefreshToken, isTokenOfType, verifyToken } from '../jwt';

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
