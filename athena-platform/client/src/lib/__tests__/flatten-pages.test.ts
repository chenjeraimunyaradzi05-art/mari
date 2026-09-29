import { flattenPagesById } from '../hooks';

describe('flattenPagesById', () => {
  it('keeps every row from every page, in page order', () => {
    const rows = flattenPagesById<{ id: string; n: number }>([
      { data: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], pagination: { page: 1, hasMore: true } },
      { data: [{ id: 'c', n: 3 }], pagination: { page: 2, hasMore: false } },
    ]);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('shows a row that moved across a page boundary once, where it was first seen', () => {
    // A thread got a new message between the two fetches and jumped to the top,
    // so the second offset page repeats one the first already held.
    const rows = flattenPagesById<{ id: string; n: number }>([
      { data: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }] },
      { data: [{ id: 'b', n: 99 }, { id: 'c', n: 3 }] },
    ]);
    expect(rows).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]);
  });

  it('skips a page whose data is not a list, and rows without an id', () => {
    const rows = flattenPagesById<{ id: string }>([
      { data: null },
      { data: [{ id: 'a' }, null, { name: 'no id' }] as unknown[] },
    ]);
    expect(rows).toEqual([{ id: 'a' }]);
  });

  it('is empty before anything has loaded', () => {
    expect(flattenPagesById(undefined)).toEqual([]);
  });
});
