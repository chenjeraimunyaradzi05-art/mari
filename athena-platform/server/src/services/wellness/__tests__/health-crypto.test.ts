/**
 * Health records at rest: what the key rules mean for the wellness trackers,
 * medications, notes and booking reasons. The encryption itself is exercised
 * in utils/__tests__/encryption-key.test.ts; this holds the health-specific
 * promises: a record is never written under a key printed in the repository, an
 * older record still opens, and one that cannot be opened reads as unreadable
 * instead of throwing.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// A record nobody can open is counted where the operations screen reads, so a
// lost or skipped key shows up before a member finds it.
jest.mock('../../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

import { sealText } from '../../../utils/encryption-key';
import { recordFailure } from '../../../utils/ops-metrics';
import { decryptJson, encryptJson } from '../health-crypto';

const unreadableCount = () => (recordFailure as jest.Mock).mock.calls.filter((call) => call[0] === 'health.record_unreadable').length;

const KEY = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const OTHER_KEY = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';

describe('health records at rest', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, NODE_ENV: 'production', DV_ENCRYPTION_KEY: KEY };
    delete process.env.HEALTH_ENCRYPTION_KEY;
    delete process.env.HEALTH_ENCRYPTION_KEY_PREVIOUS;
    delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
  });
  afterEach(() => {
    process.env = env;
  });

  it('round-trips a record, hides what it says, and marks it with the version', () => {
    const sealed = encryptJson({ mood: 4, note: 'a hard week' });

    expect(sealed.startsWith('enc:v1:')).toBe(true);
    expect(sealed).not.toContain('mood');
    expect(sealed).not.toContain('hard week');
    expect(decryptJson(sealed)).toEqual({ mood: 4, note: 'a hard week' });
    expect(unreadableCount()).toBe(0);
  });

  it('refuses to write a record in production without a real key, and never as plain text', () => {
    delete process.env.DV_ENCRYPTION_KEY;
    expect(() => encryptJson({ mood: 4 })).toThrow(
      'HEALTH_ENCRYPTION_KEY (or DV_ENCRYPTION_KEY) must be a 64-character hex key in production'
    );

    process.env.DV_ENCRYPTION_KEY = '0'.repeat(64);
    expect(() => encryptJson({ mood: 4 })).toThrow(/and a random one/);
  });

  it('prefers its own key over the safe-chat key when it has one', () => {
    process.env.HEALTH_ENCRYPTION_KEY = OTHER_KEY;
    const sealed = encryptJson({ mood: 2 });

    delete process.env.HEALTH_ENCRYPTION_KEY;
    // Under the safe-chat key alone, it cannot be opened.
    expect(decryptJson(sealed)).toBeNull();

    process.env.HEALTH_ENCRYPTION_KEY = OTHER_KEY;
    expect(decryptJson(sealed)).toEqual({ mood: 2 });
  });

  it('reads a record written before there was a version mark', () => {
    const marked = encryptJson({ mood: 5 });
    expect(decryptJson(marked.slice('enc:v1:'.length))).toEqual({ mood: 5 });
  });

  it('answers null, not an error, for a record it cannot open, and counts each one for the operations screen', () => {
    const sealed = encryptJson({ mood: 3 });

    expect(decryptJson(sealed.slice(0, -4) + 'AAAA')).toBeNull();
    expect(decryptJson('not a record')).toBeNull();

    process.env.DV_ENCRYPTION_KEY = OTHER_KEY;
    expect(decryptJson(sealed)).toBeNull();

    expect(unreadableCount()).toBe(3);
    // Nothing of the record, and no id, goes into the count.
    for (const call of (recordFailure as jest.Mock).mock.calls) expect(String((call[1] as Error).message)).not.toContain(sealed);
  });

  it('answers null for a value that opens but is not JSON, rather than throwing', () => {
    // Sealed correctly, under the right key, but not a record.
    expect(decryptJson(sealText('health', 'plain words, not json'))).toBeNull();
    expect(unreadableCount()).toBe(1);
  });

  it('opens a record the previous key sealed once the key has rotated', () => {
    const sealed = encryptJson({ mood: 1 });

    process.env.DV_ENCRYPTION_KEY = OTHER_KEY;
    expect(decryptJson(sealed)).toBeNull();

    process.env.DV_ENCRYPTION_KEY_PREVIOUS = KEY;
    expect(decryptJson(sealed)).toEqual({ mood: 1 });
  });
});
