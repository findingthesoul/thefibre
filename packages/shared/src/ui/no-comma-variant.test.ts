import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `[&_ul,&_ol]:pl-5` generated no rule at all, so three surfaces rendered
// bullet lists with their markers outside the text column for as long as the
// class had existed — while the class sat visibly in the markup and the
// EDITOR, which spells the same thing as two variants, looked right.
//
// Fixing the three copies does not stop the fourth. The shape is what fails,
// so the whole source tree is read for it: any arbitrary Tailwind variant
// with a comma inside the brackets.
//
// This is a search, not a list of files to check — a list would quietly stop
// covering the app somebody adds next week.

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const SKIP = new Set(['node_modules', '.next', 'dist', '.git', '.claude', 'coverage', 'test-results']);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) sources(full, found);
    else if (/\.(tsx|ts|css)$/.test(entry)) found.push(full);
  }
  return found;
}

describe('no Tailwind arbitrary variant hides a comma', () => {
  it('finds none anywhere in the source tree', () => {
    const offenders: string[] = [];
    for (const file of sources(`${root}apps`).concat(sources(`${root}packages`))) {
      // This file names the bad pattern in order to look for it.
      if (file.endsWith('no-comma-variant.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const [i, line] of text.split('\n').entries()) {
        // A class inside a comment is prose, not a class — and the comments
        // that explain this bug necessarily quote it.
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        // `[&_ul,&_ol]:` and friends — bracketed selector list before a colon.
        if (/\[&[^\]\s]*,[^\]\s]*\]:/.test(code)) {
          offenders.push(`${file.slice(root.length)}:${i + 1}`);
        }
      }
    }
    // Print what was MATCHED, not what was expected: a guard whose failure
    // message says "expected 0" tells the next person nothing about where.
    expect(offenders).toEqual([]);
  });
});
