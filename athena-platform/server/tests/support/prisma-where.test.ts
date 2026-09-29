import { describe, it, expect } from '@jest/globals';
import { matchesWhere, modelOver } from './prisma-where';

/**
 * The in-memory filter the safety suites run handlers' real `where` clauses
 * through. If it admitted a row Prisma would refuse, those suites would pass
 * over exactly the leak they exist to catch, so its semantics get a suite of
 * their own.
 */

const eve = {
  id: 'eve',
  displayName: 'Eve Gardener',
  isActive: true,
  tags: ['garden', 'bees'],
  profile: null,
  dvSafetyProfile: { hideFromSearch: false, blockedUserIds: ['ada'] },
  skills: [{ skill: { name: 'Pruning' } }],
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('matchesWhere', () => {
  it('matches scalars by equality and ignores undefined conditions', () => {
    expect(matchesWhere(eve, { id: 'eve', isActive: true, role: undefined })).toBe(true);
    expect(matchesWhere(eve, { id: 'ada' })).toBe(false);
  });

  it('reads contains with and without insensitive mode', () => {
    expect(matchesWhere(eve, { displayName: { contains: 'gardener', mode: 'insensitive' } })).toBe(true);
    expect(matchesWhere(eve, { displayName: { contains: 'gardener' } })).toBe(false);
  });

  it('reads in, notIn, has and dates', () => {
    expect(matchesWhere(eve, { id: { in: ['ada', 'eve'] } })).toBe(true);
    expect(matchesWhere(eve, { id: { notIn: ['eve'] } })).toBe(false);
    expect(matchesWhere(eve, { tags: { has: 'bees' } })).toBe(true);
    expect(matchesWhere(eve, { createdAt: { gte: new Date('2026-08-31T00:00:00.000Z') } })).toBe(true);
    expect(matchesWhere(eve, { createdAt: { lt: new Date('2026-08-31T00:00:00.000Z') } })).toBe(false);
  });

  it('treats an empty OR as matching nothing, as Prisma does', () => {
    expect(matchesWhere(eve, { OR: [] })).toBe(false);
  });

  it('combines AND, OR and NOT', () => {
    expect(matchesWhere(eve, { AND: [{ isActive: true }, { OR: [{ id: 'x' }, { id: 'eve' }] }] })).toBe(true);
    expect(matchesWhere(eve, { NOT: { id: 'eve' } })).toBe(false);
    expect(matchesWhere(eve, { NOT: [{ id: 'x' }, { id: 'y' }] })).toBe(true);
  });

  it('follows to-one relations with is, isNot and the bare form', () => {
    expect(matchesWhere(eve, { profile: { is: null } })).toBe(true);
    expect(matchesWhere(eve, { dvSafetyProfile: { is: { blockedUserIds: { has: 'ada' } } } })).toBe(true);
    expect(matchesWhere(eve, { NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: 'ada' } } } } })).toBe(false);
    expect(matchesWhere(eve, { dvSafetyProfile: { isNot: null } })).toBe(true);
    // A relation that is absent matches no filter on its fields.
    expect(matchesWhere(eve, { profile: { hideFromSearch: false } })).toBe(false);
    expect(matchesWhere(eve, { NOT: { profile: { is: { hideFromSearch: true } } } })).toBe(true);
  });

  it('follows list relations with some, every and none', () => {
    expect(matchesWhere(eve, { skills: { some: { skill: { name: { in: ['pruning'], mode: 'insensitive' } } } } })).toBe(true);
    expect(matchesWhere(eve, { skills: { none: { skill: { name: 'Pruning' } } } })).toBe(false);
    expect(matchesWhere(eve, { skills: { every: { skill: { name: 'Pruning' } } } })).toBe(true);
  });

  // The point of throwing: a filter it does not understand must fail the test
  // that reached it, not quietly admit or drop a row.
  it('throws on an operator it does not implement', () => {
    expect(() => matchesWhere(eve, { displayName: { search: 'eve' } })).toThrow(/not implemented|relation/);
    expect(() => matchesWhere(eve, { id: { equals: 'eve', lookalike: true } })).toThrow(/not implemented/);
  });
});

describe('modelOver', () => {
  it('applies where and take, and finds the first match', async () => {
    const rows = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ];
    const model = modelOver(() => rows);

    expect(await model.findMany({ where: { n: { gte: 2 } } })).toEqual([rows[1], rows[2]]);
    expect(await model.findMany({ where: { n: { gte: 1 } }, take: 1 })).toEqual([rows[0]]);
    expect(await model.findUnique({ where: { id: 'c' } })).toEqual(rows[2]);
    expect(await model.findFirst({ where: { id: 'z' } })).toBeNull();
    expect(await model.count({ where: { n: { lt: 3 } } })).toBe(2);
  });
});
