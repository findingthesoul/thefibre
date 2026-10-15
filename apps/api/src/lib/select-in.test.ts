// The two ceilings select-in.ts exists for, exercised against a fake that
// behaves like PostgREST at them: a page is never longer than PAGE_SIZE, and
// the fake records every `.in()` list it was handed, so a list too long for
// a URL is caught here rather than by a proxy on the day a community grows.

import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, PAGE_SIZE, selectAll, selectIn } from './select-in.js';

type Row = { id: string };

/** A table of `n` rows per key that pages like PostgREST: `range` is
 *  inclusive and the server caps at PAGE_SIZE whatever is asked for. */
function fakeTable(perKey: number) {
  const seen: string[][] = [];
  const build = (chunk: string[]) => {
    seen.push(chunk);
    const all: Row[] = chunk.flatMap((k) => Array.from({ length: perKey }, (_, i) => ({ id: `${k}:${i}` })));
    return {
      range: (from: number, to: number) =>
        Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + PAGE_SIZE)), error: null }),
    };
  };
  return { build, seen };
}

const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`);

describe('selectAll', () => {
  it('reads past the 1,000-row cap instead of stopping at it', async () => {
    const { build } = fakeTable(2_500);
    const out = await selectAll('t', () => build(['only']));
    expect(out).toHaveLength(2_500);
    expect(new Set(out.map((r) => r.id)).size).toBe(2_500);
  });

  it('stops on a short page — exactly 1,000 rows costs one extra empty read, not a loop', async () => {
    const { build } = fakeTable(PAGE_SIZE);
    expect(await selectAll('t', () => build(['only']))).toHaveLength(PAGE_SIZE);
  });

  it('throws on an error rather than returning what it had so far', async () => {
    let call = 0;
    const build = () => ({
      range: () =>
        Promise.resolve(
          call++ === 0
            ? { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: String(i) })), error: null }
            : { data: null, error: { message: 'boom' } },
        ),
    });
    await expect(selectAll('directory list: persons', build)).rejects.toThrow(
      'directory list: persons: boom',
    );
  });
});

describe('selectIn', () => {
  it('never hands PostgREST an in-list longer than a chunk, and loses nobody', async () => {
    const { build, seen } = fakeTable(1);
    const out = await selectIn('t', keys(1_234), build);
    expect(out).toHaveLength(1_234);
    expect(Math.max(...seen.map((c) => c.length))).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(seen.flat().sort()).toEqual(keys(1_234).sort());
  });

  it('reads a repeated value once', async () => {
    const { build, seen } = fakeTable(1);
    const out = await selectIn('t', ['a', 'a', 'b'], build);
    expect(out).toHaveLength(2);
    expect(seen.flat()).toEqual(['a', 'b']);
  });

  it('asks nothing for an empty list', async () => {
    const { build, seen } = fakeTable(1);
    expect(await selectIn('t', [], build)).toEqual([]);
    expect(seen).toHaveLength(0);
  });
});
