// A search that FAILED must not answer like a search that found nothing.
//
// The two are the same screen and the opposite meaning, and next to an "add
// what you typed" row the difference is somebody creating a person who
// already exists. `SearchSelect` has handled a rejected search properly since
// 2026-09-23 — it keeps the last good results, says it could not look, and
// withholds the create row — but only if the search actually REJECTS.
//
// `entries/page.tsx` swallowed it, with a comment that stated the bug as its
// own justification: "an empty list reads as 'nothing matched', which is the
// same shape of answer". Found by the stress-test session's silent-empty
// sweep, one of thirteen across the repo, and it reached production because
// every happy-path check passes.
//
// This guards the SEARCH functions only. Elsewhere an empty list on failure
// is often right — `loadMyTeams` returning none means no team picker, which
// is the correct screen for the many workspaces that have no teams; and the
// offline queue answering "nothing pending" when storage is unreadable has
// nothing it could show instead. Those are judgements, not omissions, so a
// blanket rule would be wrong and would get switched off.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

/** Every tracked source file in the app. */
function sources(): string[] {
  return execFileSync('git', ['ls-files', '--', '*.ts', '*.tsx'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
}

/** Comments out. Both fixes here SAY "return []" in prose explaining why they
 *  no longer do it, and the first version of this guard flagged both of them
 *  for their own explanations — the instrument matching the words rather than
 *  the code, which is the mistake this file exists to catch in others. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** The body of each `async function search…` / `const search… =`, to its
 *  closing brace, by brace depth. Crude but adequate: these are small
 *  functions and the alternative is a parser for one rule. */
function searchBodies(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  src = code(src);
  for (const m of src.matchAll(/(?:async function|const)\s+(search[A-Z]\w*)\b/g)) {
    const start = src.indexOf('{', m.index! + m[0].length);
    if (start === -1) continue;
    let depth = 0;
    let i = start;
    for (; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push({ name: m[1]!, body: src.slice(start, i + 1) });
  }
  return out;
}

describe('a search never swallows its own failure', () => {
  it('finds the search functions it is guarding', () => {
    // A guard that scans nothing passes for the wrong reason.
    const found = sources().flatMap((f) =>
      searchBodies(readFileSync(resolve(ROOT, f), 'utf8')).map((s) => `${f}:${s.name}`),
    );
    expect(found.length, 'no search functions found — has the naming changed?').toBeGreaterThan(2);
  });

  it('has no `catch` that returns an empty array', () => {
    const offenders: string[] = [];
    for (const f of sources()) {
      for (const { name, body } of searchBodies(readFileSync(resolve(ROOT, f), 'utf8'))) {
        // Look only INSIDE catch blocks: `if (q.length < 2) return []` is a
        // real answer and must stay.
        for (const c of body.matchAll(/catch[^{]*\{([\s\S]*?)\}/g)) {
          if (/return\s*\[\s*\]/.test(c[1]!)) offenders.push(`${f}:${name}`);
        }
      }
    }
    // If this fails: throw instead. SearchSelect already shows "could not
    // look" and withholds the create row — that is the whole point of it.
    expect(offenders).toEqual([]);
  });
});
