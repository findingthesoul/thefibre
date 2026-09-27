// The event types Meet OFFERS and the event types the API ACCEPTS must be the
// same set. Each list is correct on its own, which is exactly why they drift:
// nothing fails until somebody picks the new one and gets a 400 at save.
//
// This has already happened twice with the same four-value list. `one_off` and
// `poll` shipped on 2026-05-17 with tables, columns and UI, and the database's
// CHECK constraint was never widened — so every one was refused for four
// months (fixed 2026-09-25). The "+ New" menu's target page carried a third
// copy of the same four and silently opened a one-on-one form instead of a
// poll (fixed alongside this test).
//
// The UI's list is read as SOURCE TEXT rather than imported: it is a .tsx
// module in another app with React in its import graph, and the thing worth
// asserting is the literal list a person edits. Same approach as
// packages/mcp's test against the middleware's allow-list.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PICKER = resolve(HERE, '../../../meet/components/event-type-picker.tsx');
const ROUTES = resolve(HERE, './meet.ts');

/** The `value:` of every entry in Meet's EVENT_TYPES array. */
function offered(): string[] {
  const src = readFileSync(PICKER, 'utf8');
  const block = src.slice(src.indexOf('export const EVENT_TYPES'));
  return [...block.matchAll(/^\s*value: '([a-z_]+)'/gm)].map((m) => m[1]);
}

/** The values in the API's `event_type` zod enum. */
function accepted(): string[] {
  const src = readFileSync(ROUTES, 'utf8');
  const m = src.match(/\.enum\(\[([^\]]*'one_on_one'[^\]]*)\]\)/);
  if (!m) throw new Error('could not find the event_type enum in routes/meet.ts');
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

describe('Meet event types', () => {
  it('finds both lists at all', () => {
    // A regex that quietly matches nothing would make every other assertion
    // here pass by comparing two empty sets.
    expect(offered().length).toBeGreaterThanOrEqual(6);
    expect(accepted().length).toBeGreaterThanOrEqual(6);
  });

  it('offers exactly what the API accepts', () => {
    expect([...offered()].sort()).toEqual([...accepted()].sort());
  });

  it('still includes the two that were unreachable until 2026-09-25', () => {
    for (const v of ['one_off', 'poll']) {
      expect(offered()).toContain(v);
      expect(accepted()).toContain(v);
    }
  });
});
