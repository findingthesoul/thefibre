// The guard against iOS zooming into a field and never zooming out.
//
// Sjoerd has now reported this twice from his phone — 2026-09-17 ("when I
// start to use the text field, the screen zooms in. It does not zoom out
// again") and 2026-09-21 ("my iOS zooms in; it does not restore, which makes
// the interface disfunctional. We solved this earlier no?"). It had been
// solved: the fix sat on a branch that was never released. Second cause:
// every field the shared components render is 16px on a phone, but a
// hand-rolled `<input className="… text-sm">` next to them is not, and those
// keep being written.
//
// Safari zooms the page into any input, textarea or select whose text is
// under 16px, and it never zooms back. So the rule is a size, not a viewport
// `maximum-scale` — that one switches pinch zoom off on Android for everyone.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FIELD_TEXT,
  FIELD_BOX,
  FIELD_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_INPUT_CLASS_INLINE,
} from './fields.js';

const ROOT = resolve(import.meta.dirname, '../../../..');

/** What this file scans. The other apps carry the same hand-rolled fields and
 *  the same bug — 86 of them on 2026-09-21, listed in docs/build-plan.md. They
 *  are a separate job; adding them here would fail the release for work nobody
 *  has done yet. Connections is where the phone is actually being used, and
 *  packages/shared is what every app renders. */
const SCANNED = ['apps/connections', 'packages/shared/src'];

/** A size below 16px, written by hand on the element itself. */
const SMALL = /\btext-(sm|xs|\[1[0-5]px\])\b/;
/** …unless 16px is also there, which is what FIELD_TEXT expands to. */
const BIG = /\btext-base\b|\btext-\[1[6-9]px\]\b/;
/** Controls Safari does not zoom into: nothing is typed in them. */
const NO_TYPING =
  /type=("|'|\{')(checkbox|radio|range|color|file|submit|button|hidden|image|reset)/;

/** The opening tag of every input/textarea/select in `src`, with its
 *  attributes. Walking brace depth rather than matching to the first `>`
 *  because `onChange={(e) => …}` contains one. */
function controls(src: string): { tag: string; line: number }[] {
  const out: { tag: string; line: number }[] = [];
  for (const m of src.matchAll(/<(input|textarea|select)\b/g)) {
    const start = m.index!;
    let i = start + m[0].length;
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
      i++;
    }
    out.push({ tag: src.slice(start, i + 1), line: src.slice(0, start).split('\n').length });
  }
  return out;
}

describe('fields on a phone', () => {
  it('renders every shared field at 16px below `sm`', () => {
    expect(FIELD_TEXT).toBe('text-base sm:text-sm');
    for (const c of [FIELD_BOX, FIELD_CLASS, FIELD_INPUT_CLASS]) {
      expect(c).toContain('text-base');
      expect(c).toContain('sm:text-sm');
    }
  });

  it('has no hand-rolled field under 16px on a phone', () => {
    const files = execFileSync(
      'git',
      ['ls-files', '--', ...SCANNED.map((d) => `${d}/**/*.tsx`)],
      { cwd: ROOT, encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
    // A guard that scans nothing passes for the wrong reason.
    expect(files.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const f of files) {
      for (const { tag, line } of controls(readFileSync(resolve(ROOT, f), 'utf8'))) {
        if (NO_TYPING.test(tag)) continue;
        if (SMALL.test(tag) && !BIG.test(tag)) offenders.push(`${f}:${line}`);
      }
    }
    // Import FIELD_TEXT from @thefibre/shared/ui/fields and interpolate it
    // where the `text-sm` is, or use FIELD_INPUT_CLASS for the whole box.
    expect(offenders).toEqual([]);
  });
});

// FIELD_INPUT_CLASS_INLINE is built by string surgery —
// `FIELD_INPUT_CLASS.replace('w-full ', '')` — and that only works because
// SURFACE happens to begin `'w-full rounded-md …'`, so the substring carries
// its trailing space. Move `w-full` to the end of SURFACE, or change the
// spacing, and the replace becomes a no-op that throws nothing: every inline
// field in all nine apps silently goes full width, and the caller's own
// `w-20` loses to it on stylesheet order. Nobody would see it except as a
// field that looks wrong on one screen.
//
// Found 2026-09-23 while the thread session was fixing exactly that symptom
// in its own template editor. Neither side errors, so this is the
// two-sides-must-agree shape: the only thing that catches it is a test that
// the surgery actually cut.
describe('the inline field variant', () => {
  it('is the full-width class with the width taken off', () => {
    // The premise. If this fails, SURFACE no longer sets the width and the
    // whole INLINE/FULL distinction needs rethinking rather than repairing.
    expect(FIELD_INPUT_CLASS).toMatch(/\bw-full\b/);

    // The surgery fired at all.
    expect(FIELD_INPUT_CLASS_INLINE).not.toBe(FIELD_INPUT_CLASS);
    // …and cut the whole token, not part of one.
    expect(FIELD_INPUT_CLASS_INLINE).not.toMatch(/\bw-full\b/);
    // …and left no double space or ragged edge behind.
    expect(FIELD_INPUT_CLASS_INLINE).toBe(FIELD_INPUT_CLASS_INLINE.trim());
    expect(FIELD_INPUT_CLASS_INLINE).not.toMatch(/ {2}/);

    // Everything else survived: same classes, minus exactly w-full.
    expect(FIELD_INPUT_CLASS_INLINE.split(' ').filter(Boolean)).toEqual(
      FIELD_INPUT_CLASS.split(' ').filter((c) => c && c !== 'w-full'),
    );
  });
});
