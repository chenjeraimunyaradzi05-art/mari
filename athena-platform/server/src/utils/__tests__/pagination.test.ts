import { clampLimit, clampPage, parsePagination } from '../pagination';

/**
 * The page-size rule every list shares.
 *
 * `parseInt(req.query.limit) || 20` was written at about a dozen list routes.
 * It does not stop a million, passes a negative on (Prisma reads a negative
 * `take` as "from the end"), and is NaN for text wherever the `|| 20` was
 * missing. These are the inputs a query string can hold.
 */

describe('clampLimit', () => {
  it('keeps a sensible number as it is', () => {
    expect(clampLimit('25')).toBe(25);
    expect(clampLimit(25)).toBe(25);
    expect(clampLimit('100')).toBe(100);
  });

  it('holds a huge number to the ceiling', () => {
    expect(clampLimit('1000000')).toBe(100);
    expect(clampLimit('9'.repeat(30))).toBe(100);
    expect(clampLimit('500', 20, 50)).toBe(50);
    expect(clampLimit(Number.MAX_SAFE_INTEGER, 20, 200)).toBe(200);
  });

  it('answers the usual page for anything that is not a whole number', () => {
    for (const value of ['abc', '', ' ', 'NaN', 'Infinity', undefined, null, {}, [], true, '0', 0]) {
      expect(clampLimit(value)).toBe(20);
    }
    expect(clampLimit('abc', 10, 50)).toBe(10);
  });

  it('never lets a negative through', () => {
    expect(clampLimit('-5')).toBe(1);
    expect(clampLimit(-100)).toBe(1);
  });

  it('reads what a number starts with, as parseInt does, and a repeated key by its first value', () => {
    expect(clampLimit('12abc')).toBe(12);
    expect(clampLimit('1.9')).toBe(1);
    // ?limit=5&limit=6 arrives as an array, which is not a number.
    expect(clampLimit(['5', '6'])).toBe(20);
  });

  it('keeps the fallback inside the ceiling', () => {
    expect(clampLimit(undefined, 500, 50)).toBe(50);
    expect(clampLimit(undefined, -3, 50)).toBe(1);
  });
});

describe('clampPage', () => {
  it('is a whole number from 1 up to 10,000', () => {
    expect(clampPage('3')).toBe(3);
    expect(clampPage('0')).toBe(1);
    expect(clampPage('-4')).toBe(1);
    expect(clampPage('abc')).toBe(1);
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage('99999999999')).toBe(10_000);
    expect(clampPage(50, 20)).toBe(20);
  });
});

describe('parsePagination', () => {
  it('holds the page to the same ceiling, so skip stays something Postgres will take as an OFFSET', () => {
    const { page, limit, skip } = parsePagination({ page: '99999999999', limit: '100' });

    expect(page).toBe(10_000);
    expect(skip).toBe(9_999 * limit);
    expect(Number.isSafeInteger(skip)).toBe(true);
  });

  it('is unchanged for ordinary requests', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(parsePagination({ page: 'x', limit: '1000' })).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePagination({ limit: '1000' }, 50).limit).toBe(50);
  });
});
