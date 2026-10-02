import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { isSealed, openSafetyText, openSecret, sealSafetyText, sealSecret } from '../secret-box';

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

describe('Safety plan text at rest', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test' };
    delete process.env.TOTP_ENCRYPTION_KEY;
    process.env.DV_ENCRYPTION_KEY = 'c'.repeat(64);
  });
  afterEach(() => {
    process.env = env;
  });

  it('is sealed under the safe-chat key and opened again', () => {
    const sealed = sealSafetyText('["12 Wattle St"]');
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain('Wattle');
    expect(openSafetyText(sealed)).toBe('["12 Wattle St"]');
  });

  it('ignores the authenticator key entirely, so rotating it cannot lose a plan', () => {
    const sealed = sealSafetyText('plan');

    process.env.TOTP_ENCRYPTION_KEY = 'd'.repeat(64);
    expect(openSafetyText(sealed)).toBe('plan');
    expect(openSafetyText(sealSafetyText('plan'))).toBe('plan');

    // The two purposes never open each other's values.
    expect(openSecret(sealed)).toBeNull();
    expect(openSafetyText(sealSecret('seed'))).toBeNull();
  });

  it('cannot be opened under another key, and refuses to run in production without one', () => {
    const sealed = sealSafetyText('plan');
    process.env.DV_ENCRYPTION_KEY = 'e'.repeat(64);
    expect(openSafetyText(sealed)).toBeNull();

    delete process.env.DV_ENCRYPTION_KEY;
    process.env.TOTP_ENCRYPTION_KEY = 'd'.repeat(64);
    process.env.NODE_ENV = 'production';
    // A TOTP key alone is not a key for a plan.
    expect(() => sealSafetyText('plan')).toThrow(/DV_ENCRYPTION_KEY must be a 64-character hex key/);
  });
});
