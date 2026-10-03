import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Prisma } from '@prisma/client';

import {
  planColumnValue,
  presentSafetyPlan,
  readPlanPart,
  sealPlanLines,
  SAFETY_PLAN_FIELDS,
} from '../safety-plan-seal';
import { isSealed, sealSafetyText } from '../secret-box';

const KEY = 'a'.repeat(64);

describe('A safety plan kept sealed', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY };
    delete process.env.TOTP_ENCRYPTION_KEY;
  });
  afterEach(() => {
    process.env = env;
  });

  it('round-trips a list of lines through one sealed string', () => {
    const sealed = sealPlanLines(['Jo - 0400 000 000', 'Library on Adelaide St']);

    expect(isSealed(sealed)).toBe(true);
    // The whole name and number, not a two-letter piece of it: the sealed
    // string is base64 over random bytes, and a pair of letters such as "Jo"
    // turns up in it by chance about one run in forty.
    expect(sealed).not.toContain('Jo - 0400');
    expect(sealed).not.toContain('Adelaide');
    expect(readPlanPart(sealed)).toEqual({ lines: ['Jo - 0400 000 000', 'Library on Adelaide St'], state: 'sealed' });
  });

  it('never seals the same lines to the same bytes twice', () => {
    expect(sealPlanLines(['a'])).not.toBe(sealPlanLines(['a']));
  });

  it('reads the ways a part was stored before sealing existed', () => {
    expect(readPlanPart(['Mum’s place', '  ', 'The library'])).toEqual({ lines: ['Mum’s place', 'The library'], state: 'plain' });
    expect(readPlanPart('one\n\ntwo')).toEqual({ lines: ['one', 'two'], state: 'plain' });
    expect(readPlanPart(null)).toEqual({ lines: null, state: 'empty' });
    expect(readPlanPart(undefined)).toEqual({ lines: null, state: 'empty' });
    expect(readPlanPart([])).toEqual({ lines: null, state: 'empty' });
    expect(readPlanPart(['  '])).toEqual({ lines: null, state: 'empty' });
    expect(readPlanPart({ not: 'a list' })).toEqual({ lines: null, state: 'unsupported' });
    expect(readPlanPart(42)).toEqual({ lines: null, state: 'unsupported' });
  });

  it('does not read a list holding anything but text as a shorter list: sealing it would drop the rest', () => {
    expect(readPlanPart(['A line', { street: '9 Fig Ave' }])).toEqual({ lines: null, state: 'unsupported' });
    expect(readPlanPart([{ name: 'Jo' }])).toEqual({ lines: null, state: 'unsupported' });
    expect(readPlanPart(['A line', 7])).toEqual({ lines: null, state: 'unsupported' });
    // A null in a list is nothing, not data.
    expect(readPlanPart(['A line', null])).toEqual({ lines: ['A line'], state: 'plain' });
  });

  it('calls a part it cannot open unreadable instead of showing its bytes', () => {
    const sealed = sealPlanLines(['Old address']);

    process.env.DV_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(readPlanPart(sealed)).toEqual({ lines: null, state: 'unreadable' });

    process.env.DV_ENCRYPTION_KEY = KEY;
    expect(readPlanPart(sealed.slice(0, -4) + 'AAAA')).toEqual({ lines: null, state: 'unreadable' });
    expect(readPlanPart('enc:v1:not-base64-at-all')).toEqual({ lines: null, state: 'unreadable' });
  });

  it('calls a sealed value that is not a list unreadable', () => {
    expect(readPlanPart(sealSafetyText('{"a":1}'))).toEqual({ lines: null, state: 'unreadable' });
    expect(readPlanPart(sealSafetyText('not json'))).toEqual({ lines: null, state: 'unreadable' });
  });

  describe('what is written for a part she sent', () => {
    it('leaves a part she did not send alone', () => {
      expect(planColumnValue(undefined)).toBeUndefined();
    });

    it('clears a part she emptied, since there is nothing in it to protect', () => {
      expect(planColumnValue(null)).toBe(Prisma.JsonNull);
      expect(planColumnValue([])).toBe(Prisma.JsonNull);
      expect(planColumnValue(['', '   '])).toBe(Prisma.JsonNull);
    });

    it('seals the lines she kept, trimmed', () => {
      const value = planColumnValue(['  Jo  ', '', 'Library']);
      expect(typeof value).toBe('string');
      expect(readPlanPart(value)).toEqual({ lines: ['Jo', 'Library'], state: 'sealed' });
    });
  });

  describe('presented to her', () => {
    it('opens all seven parts and reports a fully sealed row as encrypted', () => {
      const row: Record<string, unknown> = { id: 'plan-1', userId: 'her', lastReviewedAt: new Date('2026-10-01') };
      for (const field of SAFETY_PLAN_FIELDS) row[field] = sealPlanLines([`${field} line`]);

      const presented = presentSafetyPlan(row);

      for (const field of SAFETY_PLAN_FIELDS) expect(presented[field]).toEqual([`${field} line`]);
      expect(presented).toMatchObject({ id: 'plan-1', userId: 'her', encryptedAtRest: true, unreadableParts: [] });
    });

    it('says a row is not encrypted while any part is still readable lists', () => {
      const presented = presentSafetyPlan({ id: 'plan-1', safeLocations: ['Mum’s place'], exitStrategies: sealPlanLines(['Bus']) });

      expect(presented.safeLocations).toEqual(['Mum’s place']);
      expect(presented.exitStrategies).toEqual(['Bus']);
      expect(presented.encryptedAtRest).toBe(false);
    });

    it('treats a row with nothing in it as encrypted, not as a warning', () => {
      expect(presentSafetyPlan({ id: 'plan-1', safeLocations: [], exitStrategies: null })).toMatchObject({
        encryptedAtRest: true,
        unreadableParts: [],
      });
    });

    it('lists the parts it could not open and shows no bytes for them', () => {
      process.env.DV_ENCRYPTION_KEY = 'b'.repeat(64);
      const other = sealPlanLines(['x']);
      process.env.DV_ENCRYPTION_KEY = KEY;

      const presented = presentSafetyPlan({ id: 'plan-1', legalContacts: other, financialPlan: sealPlanLines(['Cash']) });

      expect(presented.legalContacts).toBeNull();
      expect(presented.unreadableParts).toEqual(['legalContacts']);
      expect(presented.financialPlan).toEqual(['Cash']);
      expect(JSON.stringify(presented)).not.toContain('enc:v1:');
    });

    it('names a part kept in a shape it cannot show, so the page does not save a blank over it', () => {
      // A row from before the route validated its body. Nothing can be shown
      // for it, but it is hers, and reading as empty would have her next save
      // clear it without her ever seeing what was there.
      const presented = presentSafetyPlan({
        id: 'plan-1',
        emergencyContacts: [{ name: 'Jo', phone: '0400 000 000' }],
        safeLocations: sealPlanLines(['Library']),
      });

      expect(presented.emergencyContacts).toBeNull();
      expect(presented.unreadableParts).toEqual(['emergencyContacts']);
      expect(presented.encryptedAtRest).toBe(false);
      expect(presented.safeLocations).toEqual(['Library']);
      expect(JSON.stringify(presented)).not.toContain('0400');
    });
  });
});
