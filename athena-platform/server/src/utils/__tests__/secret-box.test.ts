import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { isSealed, openSecret, sealSecret } from '../secret-box';

const KEY = 'a'.repeat(64);

describe('The authenticator secret at rest', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test', TOTP_ENCRYPTION_KEY: KEY };
  });
  afterEach(() => {
    process.env = env;
  });

  it('is sealed on the way in and opened on the way out, never the same bytes twice', () => {
    const sealed = sealSecret('GEZDGNBVGY3TQOJQ');
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain('GEZDGNBVGY3TQOJQ');
    expect(openSecret(sealed)).toBe('GEZDGNBVGY3TQOJQ');
    expect(sealSecret('GEZDGNBVGY3TQOJQ')).not.toBe(sealed);
  });

  it('reads a value written before sealing existed as it is', () => {
    expect(isSealed('GEZDGNBVGY3TQOJQ')).toBe(false);
    expect(openSecret('GEZDGNBVGY3TQOJQ')).toBe('GEZDGNBVGY3TQOJQ');
    expect(openSecret(null)).toBeNull();
    expect(openSecret('')).toBeNull();
  });

  it('cannot be opened under another key or after tampering', () => {
    const sealed = sealSecret('GEZDGNBVGY3TQOJQ');
    process.env.TOTP_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(openSecret(sealed)).toBeNull();

    process.env.TOTP_ENCRYPTION_KEY = KEY;
    const tampered = sealed.slice(0, -4) + 'AAAA';
    expect(openSecret(tampered)).toBeNull();
    expect(openSecret('enc:v1:not-base64-at-all')).toBeNull();
  });

  it('falls back to the safe-chat key, and refuses to run in production without one', () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    process.env.DV_ENCRYPTION_KEY = 'c'.repeat(64);
    expect(openSecret(sealSecret('SECRET'))).toBe('SECRET');

    delete process.env.DV_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => sealSecret('SECRET')).toThrow(/64-character hex key/);
  });
});
