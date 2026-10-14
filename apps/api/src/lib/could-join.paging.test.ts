import { describe, expect, it } from 'vitest';
import { couldJoinCursor, pageCouldJoin, sortCouldJoin } from './could-join.js';

type Row = { starts_on: string | null; thread_id: string };
const row = (starts_on: string | null, thread_id: string): Row => ({ starts_on, thread_id });

/** Walk every page the way a client does, and report what it saw. */
function walk(sorted: Row[], size: number): { seen: string[]; requests: number } {
  const seen: string[] = [];
  let cursor: string | null = null;
  let requests = 0;
  for (;;) {
    const { items, nextCursor } = pageCouldJoin(sorted, cursor, size);
    requests += 1;
    seen.push(...items.map((r) => r.thread_id));
    if (!nextCursor) return { seen, requests };
    cursor = nextCursor;
    // A client cannot loop for ever on a bug; neither can this.
    if (requests > 100) throw new Error('pagination did not terminate');
  }
}

// ---------------------------------------------------------------------------
// THE PROPERTY THAT MATTERS, and the reason this is a function rather than a
// few lines in a route: walking the pages must visit every row EXACTLY once.
//
// A cursor that skips a row loses an offer the member was entitled to. One
// that repeats a row looks like duplicated data. Neither is visible in a test
// that fetches a single page, which is the test somebody writes by default.
// ---------------------------------------------------------------------------
describe('walking the pages', () => {
  it('sees every row exactly once, at every page size', () => {
    const all = sortCouldJoin([
      row('2026-11-01', 'c'),
      row('2026-11-01', 'a'),
      row('2026-10-30', 'z'),
      row('2026-12-24', 'm'),
      row(null, 'undated-2'),
      row('2026-11-01', 'b'),
      row(null, 'undated-1'),
    ]);
    const expected = all.map((r) => r.thread_id);
    for (const size of [1, 2, 3, 6, 7, 20]) {
      const { seen } = walk(all, size);
      expect(seen, `page size ${size}`).toEqual(expected);
    }
  });

  it('terminates on an empty list', () => {
    expect(walk([], 5)).toEqual({ seen: [], requests: 1 });
  });

  it('hands out one more cursor when the last page is exactly full', () => {
    // Deliberate: a full page cannot know it is the last one without looking
    // further, and one wasted round trip is a far smaller cost than telling a
    // reader there is nothing more when there is.
    const all = sortCouldJoin([row('2026-11-01', 'a'), row('2026-11-02', 'b')]);
    const first = pageCouldJoin(all, null, 2);
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor, 'a full page still offers a cursor').not.toBeNull();
    expect(pageCouldJoin(all, first.nextCursor, 2).items, 'which answers empty').toEqual([]);
  });
});

describe('the order the cursor depends on', () => {
  it('puts two threads on one day in a defined order', () => {
    // THE BUG THIS PREVENTS. Sorting by date alone leaves these three in
    // whatever order they arrived, so the row that ends a page could differ
    // between requests and the cursor would skip or repeat one.
    const sorted = sortCouldJoin([
      row('2026-11-01', 'c'),
      row('2026-11-01', 'a'),
      row('2026-11-01', 'b'),
    ]);
    expect(sorted.map((r) => r.thread_id)).toEqual(['a', 'b', 'c']);
    // And the same input in a different arrival order sorts the same way.
    const other = sortCouldJoin([
      row('2026-11-01', 'b'),
      row('2026-11-01', 'c'),
      row('2026-11-01', 'a'),
    ]);
    expect(other.map((r) => r.thread_id)).toEqual(['a', 'b', 'c']);
  });

  it('puts undated rows last, not first', () => {
    // A date of null must not sort as "earliest". A list of what is coming up
    // that opened with the things that have no date would bury the next
    // thing the member could actually attend.
    const sorted = sortCouldJoin([row(null, 'x'), row('2026-11-01', 'a')]);
    expect(sorted.map((r) => r.thread_id)).toEqual(['a', 'x']);
  });
});

describe('a cursor that no longer matches anything', () => {
  it('answers an empty page rather than an error', () => {
    // The list changed under the reader: the thread that ended their page
    // was filled or withdrawn. That is somebody else's edit, and turning it
    // into this reader's error would be the wrong place to put the blame.
    const all = sortCouldJoin([row('2026-11-01', 'a')]);
    expect(pageCouldJoin(all, '9999|zzzzzz', 10)).toEqual({ items: [], nextCursor: null });
  });

  it('still returns the rows AFTER a cursor whose own row has gone', () => {
    // The useful half: a vanished cursor row must not cost the reader the
    // rest of the list, only the row that vanished.
    const all = sortCouldJoin([row('2026-11-01', 'a'), row('2026-11-03', 'c')]);
    const gone = couldJoinCursor(row('2026-11-02', 'b'));
    expect(pageCouldJoin(all, gone, 10).items.map((r) => r.thread_id)).toEqual(['c']);
  });
});
