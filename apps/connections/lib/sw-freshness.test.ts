// A precached file that changed after the service worker did is already stale
// on somebody's phone.
//
// Sjoerd, 2026-09-23: *"the icon of connect (if I download it for my mobile)
// is the old one."* It was. The icons were redrawn for the Connect rename on
// 2026-09-22; `sw.js` had not been touched since 2026-09-13. A browser only
// reinstalls a worker whose OWN bytes changed, so every phone with the app
// installed kept serving the pre-rename icon out of `connections-shell-v2`.
//
// Nothing could tell you: production served the new file (byte-identical to
// the repo — checked), the repo was right, the typecheck was green, and the
// home screen was wrong. The only place the mismatch existed was between two
// commit dates.
//
// This is the same shape as the rest of this codebase's silent failures — two
// things that must agree, each correct alone — with time as the axis rather
// than a string or a column name.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const SW = 'public/sw.js';

/** When a path was last committed, as a unix timestamp. */
function lastCommitted(path: string): number {
  const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', path], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  return out ? Number(out) : 0;
}

describe('the service worker is not older than what it precaches', () => {
  it('lists files that exist', () => {
    const src = readFileSync(resolve(ROOT, SW), 'utf8');
    const line = src.match(/const PRECACHE = \[(.*?)\]/s);
    expect(line, 'PRECACHE not found — this test reads it out of the source').toBeTruthy();
    const files = [...line![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    // A guard that reads an empty list passes for the wrong reason.
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(lastCommitted(`public${f}`), `${f} is precached but not in the repo`).toBeGreaterThan(0);
    }
  });

  it('was committed no earlier than every file in PRECACHE', () => {
    const src = readFileSync(resolve(ROOT, SW), 'utf8');
    const files = [...src.match(/const PRECACHE = \[(.*?)\]/s)![1]!.matchAll(/'([^']+)'/g)].map(
      (m) => m[1]!,
    );
    // An UNCOMMITTED edit to sw.js means it is being changed right now, so it
    // is newer than anything in history. Without this the guard fires while
    // you are in the middle of fixing exactly what it asks for — which is how
    // a check becomes noise and then gets deleted.
    const editing = execFileSync('git', ['status', '--porcelain', '--', SW], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    if (editing) return;

    const swAt = lastCommitted(SW);
    expect(swAt, 'sw.js has no commit — run this in a git checkout').toBeGreaterThan(0);

    const stale = files.filter((f) => lastCommitted(`public${f}`) > swAt);
    // If this fails: bump VERSION in public/sw.js and say why in the comment
    // above it. The bump is the whole fix — it is what makes a browser
    // reinstall the worker and re-fetch what it precaches.
    expect(stale, 'precached files changed after sw.js; VERSION needs a bump').toEqual([]);
  });
});
