import { describe, expect, it } from '@jest/globals';
import { RENEWAL_WINDOW_DAYS, holdDeadlineOf, isInRenewalWindow, recordedDeadlineOf } from '../escrow-deadline';

const DAY = 24 * 60 * 60 * 1000;
const created = new Date('2026-09-10T00:00:00.000Z');
const inDaysAfterCreation = (days: number) => new Date(created.getTime() + days * DAY).toISOString();

describe('When a hold stops being collectable', () => {
  it('is seven days after it was made when Stripe has not said', () => {
    expect(holdDeadlineOf({ createdAt: created }).toISOString()).toBe(inDaysAfterCreation(7));
    expect(holdDeadlineOf({ createdAt: created, metadata: null }).toISOString()).toBe(inDaysAfterCreation(7));
    expect(holdDeadlineOf({ createdAt: created, metadata: { serviceId: 'svc' } }).toISOString()).toBe(inDaysAfterCreation(7));
  });

  it('is the deadline Stripe reported, when one was recorded', () => {
    const metadata = { captureBefore: inDaysAfterCreation(5) };
    expect(holdDeadlineOf({ createdAt: created, metadata }).toISOString()).toBe(inDaysAfterCreation(5));
    expect(recordedDeadlineOf({ createdAt: created, metadata })?.toISOString()).toBe(inDaysAfterCreation(5));
  });

  it('allows for an extended authorisation of up to a month', () => {
    expect(holdDeadlineOf({ createdAt: created, metadata: { captureBefore: inDaysAfterCreation(30) } }).toISOString()).toBe(
      inDaysAfterCreation(30)
    );
  });

  it.each([
    ['not a date', 'tomorrow-ish'],
    ['not text', 12345],
    ['sooner than a day after the hold', inDaysAfterCreation(0.5)],
    ['before the hold was made', inDaysAfterCreation(-3)],
    ['more than a month out', inDaysAfterCreation(45)],
  ])('ignores a recorded deadline that is %s, and falls back to the seven days', (_why, captureBefore) => {
    expect(recordedDeadlineOf({ createdAt: created, metadata: { captureBefore } })).toBeNull();
    expect(holdDeadlineOf({ createdAt: created, metadata: { captureBefore } }).toISOString()).toBe(inDaysAfterCreation(7));
  });

  it('is not fooled by metadata that is not an object', () => {
    expect(recordedDeadlineOf({ createdAt: created, metadata: 'captureBefore' })).toBeNull();
    expect(recordedDeadlineOf({ createdAt: created, metadata: [inDaysAfterCreation(5)] })).toBeNull();
  });
});

describe('The last days of a hold', () => {
  it(`opens ${RENEWAL_WINDOW_DAYS} days before the deadline and stays open after it`, () => {
    const at = (days: number) => new Date(created.getTime() + days * DAY);

    expect(isInRenewalWindow({ createdAt: created }, at(4.9))).toBe(false);
    expect(isInRenewalWindow({ createdAt: created }, at(5))).toBe(true);
    expect(isInRenewalWindow({ createdAt: created }, at(6.5))).toBe(true);
    expect(isInRenewalWindow({ createdAt: created }, at(9))).toBe(true);
  });

  it('counts from Stripe’s deadline when there is one', () => {
    const hold = { createdAt: created, metadata: { captureBefore: inDaysAfterCreation(4) } };

    expect(isInRenewalWindow(hold, new Date(created.getTime() + 1.9 * DAY))).toBe(false);
    expect(isInRenewalWindow(hold, new Date(created.getTime() + 2 * DAY))).toBe(true);
  });
});
