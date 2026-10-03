/**
 * The one place the encryption keys are read.
 *
 * Four copies of "load the key" had drifted, and not one of them refused a key
 * that was 64 valid hex characters and nothing else, which is what the all-zero
 * key in the example env file was. These tests hold what is common to safe
 * chats, health records, authenticator seeds and safety plans: production
 * refuses a missing, malformed or placeholder key at the moment something is
 * sealed, a sealed value carries a version mark and an unmarked older one still
 * opens, and a key can be retired without losing what it sealed.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { logger } from '../logger';
import {
  hasConfiguredKey,
  isSealed,
  openSealedText,
  openText,
  previousKeyVariable,
  sealText,
  SEALED_PREFIX,
} from '../encryption-key';

// Generated once with `openssl rand -hex 32` for this file; used nowhere else.
const KEY_A = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const KEY_B = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';
const KEY_C = '9d3f0b1c7a5e48d2b6c1f04e8a7d92b35c6e1f0a48b7d3c29e5a6f1b08c4d7e2';

const KEY_VARIABLES = [
  'DV_ENCRYPTION_KEY',
  'HEALTH_ENCRYPTION_KEY',
  'TOTP_ENCRYPTION_KEY',
  'DV_ENCRYPTION_KEY_PREVIOUS',
  'HEALTH_ENCRYPTION_KEY_PREVIOUS',
  'TOTP_ENCRYPTION_KEY_PREVIOUS',
];

describe('encryption keys', () => {
  const original = process.env;

  function environment(overrides: Record<string, string | undefined>) {
    const next: Record<string, string | undefined> = { ...original, ...overrides };
    for (const name of KEY_VARIABLES) if (!(name in overrides)) delete next[name];
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    process.env = next as NodeJS.ProcessEnv;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    environment({ NODE_ENV: 'test' });
  });
  afterEach(() => {
    process.env = original;
  });

  describe('sealing', () => {
    it('marks what it seals, never repeats a seal, and does not contain the text', () => {
      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY_A });
      const sealed = sealText('safe-chat', 'Leave Tuesday');

      expect(sealed.startsWith(SEALED_PREFIX)).toBe(true);
      expect(isSealed(sealed)).toBe(true);
      expect(sealed).not.toContain('Tuesday');
      expect(sealText('safe-chat', 'Leave Tuesday')).not.toBe(sealed);
      expect(openText('safe-chat', sealed)).toBe('Leave Tuesday');
    });

    it('seals and opens with no key at all outside production, under a development key', () => {
      const sealed = sealText('health', 'note');
      expect(openText('health', sealed)).toBe('note');
      expect(hasConfiguredKey('health')).toBe(false);
    });

    it('gives each purpose its own development key, so one purpose cannot open another', () => {
      const sealed = sealText('safe-chat', 'note');
      expect(openText('health', sealed)).toBeNull();
      expect(openText('secret', sealed)).toBeNull();
      expect(openText('safety-plan', sealed)).toBeNull();
    });

    it('seals and opens text that is not ASCII and not short', () => {
      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY_A });
      const text = 'Mum’s place — 12 Wattle St, Ipswich 🌿 '.repeat(200);
      expect(openText('safe-chat', sealText('safe-chat', text))).toBe(text);
    });
  });

  describe('in production', () => {
    it('refuses to seal with no key, and says which variable', () => {
      environment({ NODE_ENV: 'production' });
      expect(() => sealText('safe-chat', 'x')).toThrow('DV_ENCRYPTION_KEY must be a 64-character hex key in production');
      expect(() => sealText('health', 'x')).toThrow(
        'HEALTH_ENCRYPTION_KEY (or DV_ENCRYPTION_KEY) must be a 64-character hex key in production'
      );
      expect(() => sealText('secret', 'x')).toThrow(
        'TOTP_ENCRYPTION_KEY (or DV_ENCRYPTION_KEY) must be a 64-character hex key in production'
      );
      expect(() => sealText('safety-plan', 'x')).toThrow('DV_ENCRYPTION_KEY must be a 64-character hex key in production');
    });

    it.each([
      ['too short', KEY_A.slice(0, 63)],
      ['too long', KEY_A + 'a'],
      ['not hex', 'z'.repeat(64)],
      ['a hex key with a space in it', `${KEY_A.slice(0, 63)} `],
    ])('refuses a key that is %s', (_label, key) => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: key });
      expect(() => sealText('safe-chat', 'x')).toThrow(/64-character hex key in production/);
    });

    it.each([
      ['all zeros, which is what the example env file used to ship', '0'.repeat(64)],
      ['one repeated digit', '7'.repeat(64)],
      ['a short pattern repeated', 'deadbeef'.repeat(8)],
      ['a counting run repeated', '0123456789abcdef'.repeat(4)],
    ])('refuses %s, though it is 64 valid hex characters', (_label, key) => {
      expect(/^[0-9a-fA-F]{64}$/.test(key)).toBe(true);
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: key });
      expect(() => sealText('safe-chat', 'x')).toThrow(/must be a 64-character hex key in production, and a random one/);
    });

    it('never puts the key in the message', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: '0'.repeat(64) });
      try {
        sealText('safe-chat', 'x');
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as Error).message).not.toContain('0'.repeat(20));
      }
    });

    it('refuses a weak key on a variable that overrides the safe-chat key, naming that variable', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A, HEALTH_ENCRYPTION_KEY: '1'.repeat(64) });
      expect(() => sealText('health', 'x')).toThrow(/^HEALTH_ENCRYPTION_KEY must be a 64-character hex key/);
      // The safe chats are keyed from the other variable and are unaffected.
      expect(openText('safe-chat', sealText('safe-chat', 'x'))).toBe('x');
    });

    it('accepts a random key', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A });
      expect(openText('safe-chat', sealText('safe-chat', 'hello'))).toBe('hello');
      expect(hasConfiguredKey('safe-chat')).toBe(true);
    });

    it('opens to null, not an error, when the key is unusable, and says why in the log', () => {
      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY_A });
      const sealed = sealText('safe-chat', 'hello');

      environment({ NODE_ENV: 'production' });
      expect(openText('safe-chat', sealed)).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Sealed data cannot be opened: the encryption key is not usable.',
        expect.objectContaining({ purpose: 'safe-chat' })
      );
    });
  });

  describe('falling back between keys', () => {
    it('seals health records and authenticator seeds under the safe-chat key when they have none of their own', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A });
      const health = sealText('health', 'h');
      const secret = sealText('secret', 's');

      expect(openText('safe-chat', health)).toBe('h');
      expect(openText('safe-chat', secret)).toBe('s');
    });

    it('uses a key of its own when one is set', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A, HEALTH_ENCRYPTION_KEY: KEY_B });
      const health = sealText('health', 'h');

      expect(openText('safe-chat', health)).toBeNull();
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B });
      expect(openText('safe-chat', health)).toBe('h');
    });

    it('never keys a safety plan from the authenticator key', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A, TOTP_ENCRYPTION_KEY: KEY_B });
      const plan = sealText('safety-plan', 'plan');

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A, TOTP_ENCRYPTION_KEY: KEY_C });
      expect(openText('safety-plan', plan)).toBe('plan');
    });
  });

  describe('the version mark', () => {
    it('opens a value written before the mark existed, which is the same bytes without it', () => {
      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY_A });
      const marked = sealText('safe-chat', 'written long ago');
      const unmarked = marked.slice(SEALED_PREFIX.length);

      expect(isSealed(unmarked)).toBe(false);
      expect(openText('safe-chat', unmarked)).toBe('written long ago');
      expect(openText('safe-chat', marked)).toBe('written long ago');
    });

    it('does not mistake text for a seal', () => {
      expect(isSealed('GEZDGNBVGY3TQOJQ')).toBe(false);
      expect(isSealed(null)).toBe(false);
      expect(isSealed(undefined)).toBe(false);
      expect(isSealed('')).toBe(false);
    });
  });

  describe('a value it cannot open', () => {
    it('is null under another key, after tampering, when truncated, and when empty', () => {
      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY_A });
      const sealed = sealText('safe-chat', 'hello');

      expect(openText('safe-chat', sealed.slice(0, -4) + 'AAAA')).toBeNull();
      expect(openText('safe-chat', sealed.slice(0, 20))).toBeNull();
      expect(openText('safe-chat', 'enc:v1:not-base64-at-all')).toBeNull();
      expect(openText('safe-chat', '')).toBeNull();
      expect(openText('safe-chat', null)).toBeNull();
      expect(openText('safe-chat', undefined)).toBeNull();

      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY_B });
      expect(openText('safe-chat', sealed)).toBeNull();
    });
  });

  describe('retiring a key', () => {
    it('opens what the old key sealed once the new key is current and the old one is listed as previous', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A });
      const old = sealText('safe-chat', 'sealed under A');

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B });
      expect(openText('safe-chat', old)).toBeNull();

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B, DV_ENCRYPTION_KEY_PREVIOUS: KEY_A });
      expect(openText('safe-chat', old)).toBe('sealed under A');
      expect(openSealedText('safe-chat', old)).toEqual({ text: 'sealed under A', usedPreviousKey: true });
    });

    it('always seals under the current key, never a previous one', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B, DV_ENCRYPTION_KEY_PREVIOUS: KEY_A });
      const fresh = sealText('safe-chat', 'new');

      expect(openSealedText('safe-chat', fresh)).toEqual({ text: 'new', usedPreviousKey: false });

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B });
      expect(openText('safe-chat', fresh)).toBe('new');
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A });
      expect(openText('safe-chat', fresh)).toBeNull();
    });

    it('takes several previous keys, separated by commas or spaces', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A });
      const fromA = sealText('safe-chat', 'a');
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B });
      const fromB = sealText('safe-chat', 'b');

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_C, DV_ENCRYPTION_KEY_PREVIOUS: `${KEY_A}, ${KEY_B}` });
      expect(openText('safe-chat', fromA)).toBe('a');
      expect(openText('safe-chat', fromB)).toBe('b');

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_C, DV_ENCRYPTION_KEY_PREVIOUS: `${KEY_A}\n${KEY_B}` });
      expect(openText('safe-chat', fromB)).toBe('b');
    });

    it('accepts a retired key that would be refused as a current one, because that is the key that needs retiring', () => {
      environment({ NODE_ENV: 'test', DV_ENCRYPTION_KEY: '0'.repeat(64) });
      const underZeros = sealText('safe-chat', 'sealed under the example key');

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A, DV_ENCRYPTION_KEY_PREVIOUS: '0'.repeat(64) });
      expect(openText('safe-chat', underZeros)).toBe('sealed under the example key');
    });

    it('ignores a retired key that is not 64 hex characters, and logs which variable without its value', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B, DV_ENCRYPTION_KEY_PREVIOUS: `${KEY_A.slice(0, 40)}, not-hex` });

      expect(openText('safe-chat', sealText('safe-chat', 'x'))).toBe('x');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('DV_ENCRYPTION_KEY_PREVIOUS'),
        { variable: 'DV_ENCRYPTION_KEY_PREVIOUS' }
      );
      const logged = JSON.stringify((logger.error as jest.Mock).mock.calls);
      expect(logged).not.toContain(KEY_A.slice(0, 40));
    });

    it('applies the safe-chat key list to the purposes that fall back to that key', () => {
      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_A });
      const health = sealText('health', 'h');
      const secret = sealText('secret', 's');
      const plan = sealText('safety-plan', 'p');

      environment({ NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY_B, DV_ENCRYPTION_KEY_PREVIOUS: KEY_A });
      expect(openText('health', health)).toBe('h');
      expect(openText('secret', secret)).toBe('s');
      expect(openText('safety-plan', plan)).toBe('p');
    });

    it('names the companion variable after the key it replaces', () => {
      expect(previousKeyVariable('DV_ENCRYPTION_KEY')).toBe('DV_ENCRYPTION_KEY_PREVIOUS');
    });
  });
});
