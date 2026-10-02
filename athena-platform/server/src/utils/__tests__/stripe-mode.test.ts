import { describe, it, expect } from '@jest/globals';
import { stripeModeOf } from '../stripe-mode';

/**
 * Stripe's keys say whether they move real money in their own prefix. Nothing
 * read it, so a launch on test keys took no money and said nothing.
 */
describe('stripeModeOf', () => {
  it.each(['sk_live_abc123', 'rk_live_abc123'])('reads %s as live', (key) => {
    expect(stripeModeOf(key)).toBe('live');
  });

  it.each(['sk_test_abc123', 'rk_test_abc123'])('reads %s as test', (key) => {
    expect(stripeModeOf(key)).toBe('test');
  });

  it('ignores surrounding whitespace, which a pasted secret often carries', () => {
    expect(stripeModeOf('  sk_live_abc123\n')).toBe('live');
  });

  it('does not call the placeholder the client is built from when no key is set a test key', () => {
    // utils/stripe builds a client from this value so the process can start;
    // it is not a key anybody configured.
    expect(stripeModeOf('sk_test_not_configured')).toBe('unknown');
  });

  it.each([undefined, null, '', '   ', 'whsec_abc', 'pk_live_abc', 'pk_test_abc', 'live_sk_abc', 'sk_abc'])(
    'is unknown for %p, which is not a Stripe secret key',
    (value) => {
      expect(stripeModeOf(value as any)).toBe('unknown');
    }
  );

  it('does not mistake a key with the word live somewhere else in it for a live one', () => {
    expect(stripeModeOf('sk_test_live_abc')).toBe('test');
    expect(stripeModeOf('xsk_live_abc')).toBe('unknown');
  });
});
