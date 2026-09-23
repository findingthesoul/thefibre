// The version allocator, run for real against throwaway checkouts.
//
// Tested through the filesystem rather than by importing pieces, because the
// thing that has to be right is what it does to sixteen files — and the two
// failures worth catching are both about state: renumbering a heading that is
// already released, and losing the author's title while re-stamping after a
// lost race.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'next-version.mjs');
const made = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** A repo with an origin, a released CHANGELOG on `staging`, and the version
 *  surfaces the script stamps. */
function repo(releasedVersion, topEntry) {
  const dir = mkdtempSync(join(tmpdir(), 'nv-'));
  made.push(dir);
  const origin = join(dir, 'origin');
  const work = join(dir, 'work');
  mkdirSync(origin);
  git(origin, 'init', '-q', '--bare', '--initial-branch=staging');

  mkdirSync(work);
  git(work, 'init', '-q', '--initial-branch=staging');
  git(work, 'config', 'user.email', 't@t');
  git(work, 'config', 'user.name', 't');
  for (const p of ['apps/web/lib', 'apps/api', 'packages/shared']) {
    mkdirSync(join(work, p), { recursive: true });
  }
  const manifest = (v) => `${JSON.stringify({ version: v }, null, 2)}\n`;
  writeFileSync(join(work, 'package.json'), manifest(releasedVersion));
  writeFileSync(join(work, 'apps/api/package.json'), manifest(releasedVersion));
  writeFileSync(join(work, 'packages/shared/package.json'), manifest(releasedVersion));
  writeFileSync(
    join(work, 'apps/web/lib/version.ts'),
    `export const VERSION = '${releasedVersion}';\n`,
  );
  writeFileSync(
    join(work, 'CHANGELOG.md'),
    `# Changelog\n\n## [Unreleased]\n\n## [${releasedVersion}] — 2026-01-01 — released already\n\nbody\n`,
  );
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'released state');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'staging');

  if (topEntry) {
    const log = readFileSync(join(work, 'CHANGELOG.md'), 'utf8');
    writeFileSync(
      join(work, 'CHANGELOG.md'),
      log.replace('## [Unreleased]\n', `## [Unreleased]\n\n${topEntry}\n`),
    );
  }
  return work;
}

const run = (cwd, ...args) => {
  try {
    return {
      ok: true,
      out: execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' }),
    };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

describe('next-version', () => {
  it('reads the last release from origin and stamps every surface', () => {
    const work = repo('1.24.0', '## [NEXT] — a thing happened');
    const r = run(work, 'minor');
    expect(r.ok, r.out).toBe(true);
    expect(r.out).toContain('1.24.0 (origin/staging) → 1.25.0');

    for (const f of ['package.json', 'apps/api/package.json', 'packages/shared/package.json']) {
      expect(JSON.parse(readFileSync(join(work, f), 'utf8')).version, f).toBe('1.25.0');
    }
    expect(readFileSync(join(work, 'apps/web/lib/version.ts'), 'utf8')).toContain("'1.25.0'");
    // The author's title survives; only number and date are the script's.
    expect(readFileSync(join(work, 'CHANGELOG.md'), 'utf8')).toMatch(
      /## \[1\.25\.0\] — \d{4}-\d{2}-\d{2} — a thing happened/,
    );
  });

  it('bumps patch and major on request', () => {
    expect(run(repo('1.24.3', '## [NEXT]'), 'patch').out).toContain('→ 1.24.4');
    expect(run(repo('1.24.3', '## [NEXT]'), 'major').out).toContain('→ 2.0.0');
  });

  it('re-stamps after a lost race without touching the entry', () => {
    // The whole point: somebody released while you were preparing, so your
    // 1.25.0 is refused and everything has to become 1.26.0.
    //
    // The other session is a SECOND CLONE pushing to the same origin, which
    // is how the race really happens. An earlier version of this test moved
    // origin by stashing in the same tree — which conflicted, and was the
    // very `git stash` pattern this repo forbids for being shared state.
    const work = repo('1.24.0', '## [NEXT] — my work');
    run(work, 'minor');

    const origin = join(work, '..', 'origin');
    const peer = join(work, '..', 'peer');
    execFileSync('git', ['clone', '-q', origin, peer]);
    git(peer, 'config', 'user.email', 'p@p');
    git(peer, 'config', 'user.name', 'p');
    const theirs = readFileSync(join(peer, 'CHANGELOG.md'), 'utf8');
    writeFileSync(
      join(peer, 'CHANGELOG.md'),
      theirs.replace('## [Unreleased]\n', '## [Unreleased]\n\n## [1.25.0] — 2026-01-02 — somebody else\n'),
    );
    git(peer, 'add', 'CHANGELOG.md');
    git(peer, 'commit', '-qm', 'their release');
    git(peer, 'push', '-q', 'origin', 'staging');

    const r = run(work, 'minor');
    expect(r.ok, r.out).toBe(true);
    expect(r.out).toContain('→ 1.26.0');
    const after = readFileSync(join(work, 'CHANGELOG.md'), 'utf8');
    // The author's own words survive the renumbering — the thing that made
    // losing a race expensive was rewriting them by hand every time.
    expect(after).toMatch(/## \[1\.26\.0\] — \d{4}-\d{2}-\d{2} — my work/);
    expect(JSON.parse(readFileSync(join(work, 'package.json'), 'utf8')).version).toBe('1.26.0');
  });

  it('refuses when the top entry is already released', () => {
    // No new entry written: the top heading IS the released one. Renumbering
    // it would silently relabel somebody's shipped release.
    const r = run(repo('1.24.0', null), 'minor');
    expect(r.ok).toBe(false);
    expect(r.out).toContain('already released');
  });

  it('refuses an unknown bump kind rather than guessing', () => {
    const r = run(repo('1.24.0', '## [NEXT]'), 'sideways');
    expect(r.ok).toBe(false);
    expect(r.out).toContain('usage');
  });
});
