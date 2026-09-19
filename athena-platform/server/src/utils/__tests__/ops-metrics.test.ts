import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import {
  opsSnapshot,
  recentFailureCount,
  recordCondition,
  recordFailure,
  recordIgnored,
  recordSuccess,
  resetOpsMetrics,
} from '../ops-metrics';

/**
 * These counters decide whether /health/detailed says "degraded", and the
 * webhook and escrow paths that feed them run where nobody is watching. The
 * distinctions below are the whole design — an ignored event is not a failure,
 * a standing condition is not an event — so they are pinned here rather than
 * left to the next reader to infer.
 */
describe('Operational counters', () => {
  beforeEach(() => {
    resetOpsMetrics();
  });

  describe('an ignored arrival is kept apart from a failure', () => {
    it('counts separately and writes nothing to the failure ring', () => {
      recordIgnored('stripe_webhook.bad_signature');
      recordIgnored('stripe_webhook.bad_signature');

      const snapshot = opsSnapshot();

      expect(snapshot.operations['stripe_webhook.bad_signature'].ignored).toBe(2);
      expect(snapshot.operations['stripe_webhook.bad_signature'].failure).toBe(0);
      expect(snapshot.totals).toEqual({ success: 0, failure: 0, ignored: 2 });
      // This is the point of it. A signature that does not verify is a stranger
      // being turned away on a public endpoint that is exempt from the rate
      // limiter; if it entered the ring, anyone could post twenty and evict
      // every real payment failure from the report.
      expect(snapshot.recentFailures).toEqual([]);
      expect(recentFailureCount()).toBe(0);
    });
  });

  describe('a standing condition replaces rather than accumulates', () => {
    it('reports the latest reading, not the sum of the readings', () => {
      recordCondition('escrow.lapsed', 3, 'Holds past their release date');
      recordCondition('escrow.lapsed', 5, 'Holds past their release date');

      expect(opsSnapshot().conditions['escrow.lapsed'].count).toBe(5);
    });

    it('falls back to zero once the thing it names is dealt with', () => {
      // The bug this replaced: the escrow sweep recorded every lapsed hold as a
      // failure on every run, so the count only ever grew and health never
      // returned to healthy once a single escrow lapsed.
      recordCondition('escrow.lapsed', 4);
      recordCondition('escrow.lapsed', 0);

      const condition = opsSnapshot().conditions['escrow.lapsed'];
      expect(condition.count).toBe(0);
      expect(condition.detail).toBeNull();
      expect(opsSnapshot().totals.failure).toBe(0);
    });

    it('refuses a count that is not a measurement', () => {
      recordCondition('escrow.lapsed', Number.NaN);
      recordCondition('escrow.lapsed', Number.POSITIVE_INFINITY);
      recordCondition('escrow.lapsed', -1);

      // Writing any of those would leave an operator reading NaN or a negative
      // number of lapsed holds as though it meant something.
      expect(opsSnapshot().conditions['escrow.lapsed']).toBeUndefined();
    });

    it('floors a fractional count rather than reporting 2.5 of a thing', () => {
      recordCondition('escrow.lapsed', 2.7);
      expect(opsSnapshot().conditions['escrow.lapsed'].count).toBe(2);
    });
  });

  describe('the failure ring', () => {
    it('keeps the most recent failures, newest first, and drops the oldest', () => {
      for (let i = 1; i <= 25; i += 1) {
        recordFailure('escrow.release', new Error(`failure ${i}`));
      }

      const { recentFailures, operations, totals } = opsSnapshot();

      expect(recentFailures).toHaveLength(20);
      expect(recentFailures[0].message).toBe('failure 25');
      expect(recentFailures[19].message).toBe('failure 6');
      // The ring is bounded but the totals are not, so volume stays honest even
      // though only twenty messages are retained.
      expect(operations['escrow.release'].failure).toBe(25);
      expect(totals.failure).toBe(25);
    });

    it('reads a message off whatever was thrown, and says so when there is none', () => {
      recordFailure('a', new Error('a real error'));
      recordFailure('b', 'a thrown string');
      recordFailure('c', { message: 'an object with a message' });
      recordFailure('d', undefined);

      const messages = opsSnapshot().recentFailures.map((f) => f.message);
      expect(messages).toEqual([
        'No message on the thrown value',
        'an object with a message',
        'a thrown string',
        'a real error',
      ]);
    });

    it('survives a value whose message getter throws', () => {
      const hostile = {
        get message(): string {
          throw new Error('not today');
        },
      };

      // Counting is never worth failing a payment over, so this must not throw.
      expect(() => recordFailure('hostile', hostile)).not.toThrow();
      expect(opsSnapshot().recentFailures[0].message).toBe('Unreadable error value');
    });

    it('truncates a message too long to read', () => {
      recordFailure('long', new Error('x'.repeat(500)));

      const { message } = opsSnapshot().recentFailures[0];
      expect(message).toHaveLength(301);
      expect(message.endsWith('…')).toBe(true);
    });
  });

  describe('recentFailureCount', () => {
    it('lets a failure fall out of the window as time passes', () => {
      // This is what stops health sitting at "degraded" forever because of one
      // failure at boot: the totals keep it, but it stops counting as current.
      jest.useFakeTimers().setSystemTime(new Date('2026-09-19T10:00:00.000Z'));
      try {
        recordFailure('escrow.release', new Error('at ten'));
        expect(recentFailureCount()).toBe(1);

        jest.setSystemTime(new Date('2026-09-19T10:14:00.000Z'));
        expect(recentFailureCount()).toBe(1);

        jest.setSystemTime(new Date('2026-09-19T10:16:00.000Z'));
        expect(recentFailureCount()).toBe(0);
        // Retained and still counted in the totals — it happened, it is just
        // no longer happening.
        expect(opsSnapshot().totals.failure).toBe(1);
        expect(opsSnapshot().recentFailures).toHaveLength(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('the operation-name cap', () => {
    it('folds names beyond the cap into one bucket instead of growing forever', () => {
      for (let i = 0; i < 120; i += 1) {
        recordSuccess(`op-${i}`);
      }

      const { operations, totals } = opsSnapshot();

      expect(Object.keys(operations)).toHaveLength(101);
      expect(operations['op-0'].success).toBe(1);
      expect(operations['op-99'].success).toBe(1);
      expect(operations['op-100']).toBeUndefined();
      expect(operations['(other)'].success).toBe(20);
      // Nothing is lost, only its name.
      expect(totals.success).toBe(120);
    });
  });

  it('says out loud that these numbers are one process, not the platform', () => {
    const { note, since } = opsSnapshot();

    expect(note).toMatch(/this process only/i);
    expect(note).toMatch(/lost on restart/i);
    expect(Number.isFinite(Date.parse(since))).toBe(true);
  });
});
