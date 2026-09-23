/**
 * The panic button's wording is the one piece of text on this platform that a
 * woman may read while deciding whether help is coming. It used to say "Your
 * contacts were told" no matter what happened, because it read a field the
 * server does not return. These assertions are against the shape the server
 * really answers with (server/src/services/dv-safe.service.ts, PanicResult):
 * whatever the response, the screen must never claim someone was told unless
 * the server named them.
 */
import { describe, it, expect } from '@jest/globals';

import { describePanicOutcome, isEmailAddress } from '../panicAlert';

describe('what the phone says after the panic button', () => {
  it('names the people who were emailed', () => {
    const outcome = describePanicOutcome({ notifiedContacts: ['Mum', 'Aunty Jo'], unreachableContacts: [] });
    expect(outcome.reachedNobody).toBe(false);
    expect(outcome.title).toBe('2 people were told');
    expect(outcome.body).toContain('Mum and Aunty Jo');
    expect(outcome.body).toContain('000');
  });

  it('says plainly when nobody was reached, and why', () => {
    const outcome = describePanicOutcome({ notifiedContacts: [], unreachableContacts: ['Mum'] });
    expect(outcome.reachedNobody).toBe(true);
    expect(outcome.title).toBe('Nobody was told');
    expect(outcome.body).toContain('Mum');
    expect(outcome.body).toContain('000');
  });

  it('says nobody was told when there were no contacts to tell', () => {
    const outcome = describePanicOutcome({ notifiedContacts: [], unreachableContacts: [] });
    expect(outcome.reachedNobody).toBe(true);
    expect(outcome.title).toBe('Nobody was told');
    expect(outcome.body).toContain('no emergency contacts');
  });

  it('still names who was missed when only some were reached', () => {
    const outcome = describePanicOutcome({ notifiedContacts: ['Mum'], unreachableContacts: ['Dad', 'Sam'] });
    expect(outcome.reachedNobody).toBe(false);
    expect(outcome.title).toBe('One person was told');
    expect(outcome.body).toContain('Dad and Sam');
    expect(outcome.body).toContain('call those people yourself');
  });

  // The old bug in its exact shape: a reply that does not carry the list.
  // Anything we cannot read is reported as nobody having been told.
  it.each([
    ['an empty reply', null],
    ['a reply with no lists at all', {}],
    ['the field the screen used to read', { notified: 2 } as unknown as Record<string, unknown>],
  ])('treats %s as nobody having been told', (_label, payload) => {
    const outcome = describePanicOutcome(payload);
    expect(outcome.reachedNobody).toBe(true);
    expect(outcome.title).toBe('Nobody was told');
    expect(outcome.body).toContain('000');
  });
});

describe('the email address a contact must have', () => {
  it('accepts an ordinary address', () => {
    expect(isEmailAddress('jo@example.com')).toBe(true);
    expect(isEmailAddress('  jo.smith@mail.example.com.au  ')).toBe(true);
  });

  it('refuses what cannot be emailed', () => {
    expect(isEmailAddress('')).toBe(false);
    expect(isEmailAddress('0412 345 678')).toBe(false);
    expect(isEmailAddress('jo@example')).toBe(false);
    expect(isEmailAddress('jo example.com')).toBe(false);
  });
});
