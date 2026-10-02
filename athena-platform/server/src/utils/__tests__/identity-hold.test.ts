/**
 * When a legal hold keeps a member's photo ID check out of reach. The redaction
 * made at the moment of a decision asks this about one member, and has to give
 * the answer the nightly sweep gives about all of them, because a redaction
 * cannot be taken back.
 */

import { describe, it, expect } from '@jest/globals';
import { holdCoversIdentityChecks, IDENTITY_HOLD_ALIASES } from '../identity-hold';

const hold = (affectedUserIds: string[], affectedDataTypes: string[]) => ({ affectedUserIds, affectedDataTypes });

describe('holdCoversIdentityChecks', () => {
  it('covers a member the hold names, whatever kind of record it is about', () => {
    expect(holdCoversIdentityChecks(hold(['ana'], []), 'ana')).toBe(true);
    expect(holdCoversIdentityChecks(hold(['ana'], ['messages']), 'ana')).toBe(true);
  });

  it('does not cover a member the hold does not name, when it is about something else', () => {
    expect(holdCoversIdentityChecks(hold(['bea'], []), 'ana')).toBe(false);
    expect(holdCoversIdentityChecks(hold(['bea'], ['messages', 'notifications']), 'ana')).toBe(false);
    expect(holdCoversIdentityChecks(hold([], []), 'ana')).toBe(false);
  });

  it('covers everyone while a hold names this kind of record, under every spelling the console and a person might use', () => {
    for (const alias of IDENTITY_HOLD_ALIASES) {
      expect(holdCoversIdentityChecks(hold([], [alias]), 'ana')).toBe(true);
    }
    for (const typed of ['Identity Verification', ' identity-verification ', 'VERIFICATION DOCUMENTS', 'Identity_Documents']) {
      expect(holdCoversIdentityChecks(hold(['bea'], [typed]), 'ana')).toBe(true);
    }
  });

  it('covers everyone while a hold is on everything', () => {
    expect(holdCoversIdentityChecks(hold([], ['*']), 'ana')).toBe(true);
    expect(holdCoversIdentityChecks(hold([], ['All']), 'ana')).toBe(true);
  });

  it('is not fooled by a word that only looks like it', () => {
    expect(holdCoversIdentityChecks(hold([], ['identity']), 'ana')).toBe(false);
    expect(holdCoversIdentityChecks(hold([], ['verification_tokens']), 'ana')).toBe(false);
    expect(holdCoversIdentityChecks(hold([], ['allowed']), 'ana')).toBe(false);
  });
});
