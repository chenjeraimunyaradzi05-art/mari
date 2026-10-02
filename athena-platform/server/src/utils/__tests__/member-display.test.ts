import { describe, it, expect, jest } from '@jest/globals';
import { PUBLIC_AUTHOR_SELECT, maskLegalNames, maskLegalNamesInResponses, parseDisplayName, publicName } from '../member-display';

/**
 * The pseudonymous display name. A member may be called by a public name that is
 * not her legal name, and the server, not the apps, keeps her legal first and last
 * name off every social surface.
 */

describe('publicName', () => {
  it('is the public name she chose, else her first name alone, never both legal names', () => {
    expect(publicName({ displayName: 'Willow Rain', firstName: 'Jane', lastName: 'Doe' })).toBe('Willow Rain');
    expect(publicName({ displayName: '  Willow  ', firstName: 'Jane', lastName: 'Doe' })).toBe('Willow');
    expect(publicName({ displayName: null, firstName: 'Jane', lastName: 'Doe' })).toBe('Jane');
    expect(publicName({ displayName: '   ', firstName: ' Jane ', lastName: 'Doe' })).toBe('Jane');
  });

  it('has something to say for a record with nothing in it', () => {
    expect(publicName(null)).toBe('Member');
    expect(publicName({ firstName: null, displayName: null })).toBe('Member');
    expect(publicName(undefined, 'A member')).toBe('A member');
  });

  it('is what the social selects load: no last name column at all', () => {
    expect(Object.keys(PUBLIC_AUTHOR_SELECT)).not.toContain('lastName');
    expect(Object.keys(PUBLIC_AUTHOR_SELECT)).toEqual(expect.arrayContaining(['id', 'displayName', 'avatar']));
  });
});

describe('maskLegalNames', () => {
  const jane = { id: 'u-jane', firstName: 'Jane', lastName: 'Doe', displayName: 'Willow Rain', avatar: 'a.png' };

  it('replaces another member\'s legal names with her public name, wherever the record sits', () => {
    const body = {
      success: true,
      data: [
        { id: 'p1', content: 'hello', author: jane, comments: [{ id: 'c1', author: { ...jane, displayName: null } }] },
        { id: 'conv1', participant: { id: 'u-ana', firstName: 'Ana', lastName: 'Ruiz', displayName: 'Ana Ruiz', avatar: null } },
      ],
    };

    const masked: any = maskLegalNames(body, 'u-viewer');

    expect(masked.data[0].author).toEqual({ id: 'u-jane', firstName: 'Willow Rain', lastName: '', displayName: 'Willow Rain', avatar: 'a.png' });
    // No pseudonym chosen: first name alone, and the surname is gone.
    expect(masked.data[0].comments[0].author).toMatchObject({ displayName: 'Jane', firstName: 'Jane', lastName: '' });
    expect(masked.data[1].participant).toMatchObject({ displayName: 'Ana Ruiz', lastName: '' });
    const written = JSON.stringify(masked);
    expect(written).not.toContain('Doe');
    // The legal first name of somebody who chose a public name does not ride along either.
    expect(masked.data[0].author.firstName).not.toBe('Jane');
    // Everything that is not a person is as it was.
    expect(masked.data[0]).toMatchObject({ id: 'p1', content: 'hello' });
    expect(masked.success).toBe(true);
  });

  it('leaves the viewer\'s own record as she gave it, by id or by userId', () => {
    const masked = maskLegalNames({ me: jane, mine: { userId: 'u-jane', firstName: 'Jane', lastName: 'Doe', displayName: null } }, 'u-jane');
    expect(masked.me).toEqual(jane);
    expect(masked.mine.lastName).toBe('Doe');
  });

  it('masks everyone when nobody is signed in', () => {
    expect(maskLegalNames({ author: jane }, undefined).author.lastName).toBe('');
  });

  it('does not touch what is not a person, or a person with no name to hide', () => {
    const body = {
      organisation: { id: 'o1', name: 'Quiet Streets', lastName: undefined },
      onlyDisplay: { id: 'u2', displayName: 'Mei', avatar: null },
      when: new Date('2026-09-01T00:00:00Z'),
      count: 3,
      nothing: null,
    };
    const masked = maskLegalNames(body, 'u-x');
    expect(masked.onlyDisplay).toEqual({ id: 'u2', displayName: 'Mei', avatar: null });
    expect(masked.when).toBe(body.when);
    expect(masked.organisation).toEqual(body.organisation);
    expect(masked.nothing).toBeNull();
  });

  it('does not change what it was given', () => {
    const body = { author: { ...jane } };
    maskLegalNames(body, 'u-viewer');
    expect(body.author).toEqual(jane);
  });
});

describe('maskLegalNamesInResponses', () => {
  it('answers through the mask, reading the signed-in member at the moment of the answer', () => {
    const sent: unknown[] = [];
    const res: any = { json: jest.fn((body: unknown) => { sent.push(body); return res; }) };
    const req: any = {};
    const next = jest.fn();

    maskLegalNamesInResponses(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // authenticate runs after the middleware is installed and before the answer.
    req.user = { id: 'u-jane' };
    res.json({ own: { id: 'u-jane', firstName: 'Jane', lastName: 'Doe' }, other: { id: 'u-x', firstName: 'Xi', lastName: 'Wen', displayName: null } });

    expect(sent[0]).toEqual({
      own: { id: 'u-jane', firstName: 'Jane', lastName: 'Doe' },
      other: { id: 'u-x', firstName: 'Xi', lastName: '', displayName: 'Xi' },
    });
  });
});

describe('parseDisplayName', () => {
  it('accepts an ordinary name, tidies its spacing, and keeps its capitals', () => {
    expect(parseDisplayName('Willow Rain')).toEqual({ ok: true, value: 'Willow Rain' });
    expect(parseDisplayName('   Willow    Rain  ')).toEqual({ ok: true, value: 'Willow Rain' });
    expect(parseDisplayName("Mei-Ling O'Brien")).toEqual({ ok: true, value: "Mei-Ling O'Brien" });
    expect(parseDisplayName('Zoë')).toEqual({ ok: true, value: 'Zoë' });
    expect(parseDisplayName('Aroha 🌿')).toEqual({ ok: true, value: 'Aroha 🌿' });
    // Another script, and a letter outside the Latin range.
    expect(parseDisplayName('نور')).toEqual({ ok: true, value: 'نور' });
  });

  it('reads an empty name as "no public name", so she is called by her first name alone', () => {
    expect(parseDisplayName('')).toEqual({ ok: true, value: null });
    expect(parseDisplayName('   ')).toEqual({ ok: true, value: null });
    expect(parseDisplayName(null)).toEqual({ ok: true, value: null });
    expect(parseDisplayName(undefined)).toEqual({ ok: true, value: null });
  });

  it.each([
    ['an email address', 'jane.doe@example.com', /email/i],
    ['a handle', '@willow', /email addresses and handles/i],
    ['a web address', 'visit www.example.com', /web addresses/i],
    ['a bare domain', 'willow.com', /web addresses/i],
    ['a phone number', 'Call 0412 345 678', /phone numbers/i],
    ['an international number', '+61 412 345 678', /phone numbers/i],
    ['digits and nothing else', '12345', /letter/i],
    ['too short', 'W', /at least 2/i],
    ['too long', 'W'.repeat(61), /up to 60/i],
    ['a hidden control character', 'Wil​low', /ordinary punctuation/i],
    ['a right-to-left override', 'Willow‮gnp', /ordinary punctuation/i],
    ['a control character', 'Wil\u0007low', /ordinary punctuation/i],
  ])('refuses %s', (_what, name, message) => {
    const result = parseDisplayName(name);
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(message);
  });

  it.each(['Admin', 'ATHENA Moderator', 'athena.team', 'Athena  Support', 'Trust & Safety', 'Official ATHENA', 'The Moderator', 'sys admin', 'Verified'])(
    'refuses %s, which reads as staff',
    (name) => {
      const result = parseDisplayName(name);
      expect(result.ok).toBe(false);
      expect((result as { message: string }).message).toMatch(/staff/i);
    }
  );

  it('does not refuse a real name that merely contains one of those letters, or is Athena', () => {
    expect(parseDisplayName('Athena')).toEqual({ ok: true, value: 'Athena' });
    expect(parseDisplayName('Admiral Hopper')).toEqual({ ok: true, value: 'Admiral Hopper' });
    expect(parseDisplayName('Modupe')).toEqual({ ok: true, value: 'Modupe' });
    expect(parseDisplayName('Support Sally Jones').ok).toBe(true);
  });

  it('refuses text that is not text', () => {
    expect(parseDisplayName(42)).toMatchObject({ ok: false });
    expect(parseDisplayName({ name: 'x' })).toMatchObject({ ok: false });
  });
});
