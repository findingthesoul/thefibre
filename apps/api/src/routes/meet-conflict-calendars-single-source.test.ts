// Both availability paths must ask the SAME question about calendars.
//
// They did not. The slot list honoured the meeting type's own choice of
// conflict calendars; the availability check had its own query, its own role
// list, and no access to that choice at all — the field was missing from the
// type the check's meeting type was declared as, so it could not have
// honoured it. The result was a time offered on the booking page and refused
// a second later, reported as "That time just went. Please pick another."
//
// Reading the two functions side by side is how it was found, and that is
// exactly what nobody does. So this file reads them instead.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const source = readFileSync(join(here, 'meet.ts'), 'utf8');

describe('conflict calendars have one source in the meet routes', () => {
  it('no availability query picks calendars by role on its own', () => {
    // A role filter naming conflict_check is the signature of a second
    // implementation: it means somebody has decided, in a query, which
    // calendars conflict. That decision belongs to
    // lib/meet/conflict-calendars.ts, which is given every row and filters in
    // memory. (`['primary','write_target']` filters are a DIFFERENT question —
    // where to WRITE the event — and are left alone.)
    const offenders = source
      .split('\n')
      .map((line, i) => ({ n: i + 1, line: line.trim() }))
      .filter((l) => /\.in\(\s*'role'/.test(l.line) && l.line.includes('conflict_check'));
    expect(
      offenders.map((o) => `meet.ts:${o.n}  ${o.line}`),
      'this query decides for itself which calendars conflict; call conflictCalendarsByHost instead, or the slot list and the availability check will drift apart again',
    ).toEqual([]);
  });

  it('the resolver is used by both paths, and is the only route-level fetch', () => {
    const calls = source.match(/conflictCalendarsByHost\(/g) ?? [];
    // Three: the declaration, the slot list, the per-host args builder.
    expect(
      calls.length,
      'expected the resolver to be declared once and called by both availability paths',
    ).toBe(3);
    // Named in the two functions that answer "is this time free".
    for (const fn of ['async function hostFreeSlots(', 'async function buildPerHostArgs(']) {
      const start = source.indexOf(fn);
      expect(start, `${fn} exists`).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, `${fn} must get its calendars from the resolver`).toContain(
        'conflictCalendarsByHost(',
      );
    }
  });

  it('the meeting type the check is given can carry the calendar choice', () => {
    // The original defect in one line: MeetingTypeForArgs had no
    // conflict_calendar_ids, so the check could not have honoured it even if
    // somebody had thought to.
    const start = source.indexOf('type MeetingTypeForArgs');
    expect(start).toBeGreaterThan(-1);
    const decl = source.slice(start, source.indexOf('};', start));
    expect(decl).toContain('conflict_calendar_ids');
  });

  it('every meeting-type select feeding the check fetches the field', () => {
    // A select is a string TypeScript never reads: the type above can declare
    // the field while the query quietly omits it, and then the override is
    // undefined at runtime and the check falls back to every calendar — the
    // original bug, wearing a correct type.
    const selects = [...source.matchAll(/buildPerHostArgs\(\s*([^,]+),\s*(\w+)/g)].map((m) => m[2]);
    expect(selects.length, 'callers of buildPerHostArgs').toBeGreaterThanOrEqual(3);
    // Each caller passes a meeting type it selected earlier in the file; the
    // field must appear in as many meeting-type selects as there are callers.
    const mtSelects = [...source.matchAll(/'id,[^']*duration_minutes[^']*'/g)].map((m) => m[0]);
    const withField = mtSelects.filter((sel) => sel.includes('conflict_calendar_ids'));
    expect(
      withField.length,
      `only ${withField.length} of ${mtSelects.length} meeting-type selects fetch conflict_calendar_ids`,
    ).toBeGreaterThanOrEqual(5);
  });
});
