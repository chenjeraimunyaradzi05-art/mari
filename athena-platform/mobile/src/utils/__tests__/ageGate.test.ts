/**
 * The minimum age on the phone: the one rule for a typed date, and the two
 * refusals the server makes. The rule is the server's (18, on calendar parts),
 * so a birthday that has not come round yet does not count and a date that is
 * not on the calendar is not one.
 */
import { describe, it, expect } from '@jest/globals';
import { ageGateRefusalOf, isAdultDateOfBirth } from '../ageGate';

const NOW = new Date('2026-10-01T12:00:00Z');

describe('isAdultDateOfBirth', () => {
  it('counts the day she turns 18, and not the day before', () => {
    expect(isAdultDateOfBirth('2008-10-01', NOW)).toBe(true);
    expect(isAdultDateOfBirth('2008-10-02', NOW)).toBe(false);
  });

  it('is not fooled by a year that is 18 ago on paper but whose birthday is still to come', () => {
    expect(isAdultDateOfBirth('2008-12-31', NOW)).toBe(false);
    expect(isAdultDateOfBirth('2008-01-01', NOW)).toBe(true);
  });

  it('counts a 29 February birthday on the right side of the line', () => {
    expect(isAdultDateOfBirth('2008-02-29', new Date('2026-02-28T00:00:00Z'))).toBe(false);
    expect(isAdultDateOfBirth('2008-02-29', new Date('2026-03-01T00:00:00Z'))).toBe(true);
  });

  it('refuses a child, a date in the future, and an age nobody has reached', () => {
    expect(isAdultDateOfBirth('2012-05-05', NOW)).toBe(false);
    expect(isAdultDateOfBirth('2030-01-01', NOW)).toBe(false);
    expect(isAdultDateOfBirth('1890-01-01', NOW)).toBe(false);
  });

  it('refuses what is not a date: the wrong shape, or a day the calendar does not have', () => {
    for (const value of ['', 'abc', '1990/04/01', '01-04-1990', '1990-4-1', '1990-02-31', '1990-13-01', '1990-00-10']) {
      expect(isAdultDateOfBirth(value, NOW)).toBe(false);
    }
  });

  it('accepts an ordinary adult date', () => {
    expect(isAdultDateOfBirth('1990-04-01', NOW)).toBe(true);
  });
});

describe('ageGateRefusalOf', () => {
  const refusal = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

  it('reads a missing date of birth with the server’s sentence', () => {
    expect(ageGateRefusalOf(refusal(403, { code: 'DATE_OF_BIRTH_REQUIRED', error: 'Please add your date of birth before using this part of ATHENA.' }))).toEqual({
      code: 'DATE_OF_BIRTH_REQUIRED',
      message: 'Please add your date of birth before using this part of ATHENA.',
    });
  });

  it('reads an under-age account, from `message` as well as `error`', () => {
    expect(ageGateRefusalOf(refusal(403, { code: 'MINIMUM_AGE_NOT_MET', message: 'Not available on your account.' }))).toEqual({
      code: 'MINIMUM_AGE_NOT_MET',
      message: 'Not available on your account.',
    });
  });

  it('says something honest, and never the number, when the reply carries no sentence', () => {
    const missing = ageGateRefusalOf(refusal(403, { code: 'DATE_OF_BIRTH_REQUIRED' }));
    const under = ageGateRefusalOf(refusal(403, { code: 'MINIMUM_AGE_NOT_MET' }));

    expect(missing?.message).toMatch(/date of birth/i);
    expect(under?.message).toMatch(/for adults/i);
    expect(JSON.stringify([missing, under])).not.toMatch(/\b18\b/);
  });

  it('reads nothing into any other refusal or status', () => {
    expect(ageGateRefusalOf(refusal(403, { code: 'WOMAN_VERIFICATION_REJECTED', message: 'x' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(403, { message: 'Forbidden' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(401, { code: 'DATE_OF_BIRTH_REQUIRED' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(400, { code: 'DATE_OF_BIRTH_REQUIRED' }))).toBeNull();
    expect(ageGateRefusalOf(new Error('Network Error'))).toBeNull();
    expect(ageGateRefusalOf(null)).toBeNull();
  });
});
