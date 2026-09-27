// The residue guard, run against throwaway checkouts.
//
// Three cases, and the middle one is the reason this file exists: the guard
// runs INSIDE `pnpm verify`, which `release.sh` calls after stamping and
// before committing, so a guard that cannot tell a live release from residue
// would refuse every release in the repo. The first version of it read
// `git show :<file>` — the INDEX — which for an unstaged stamp is HEAD, so it
// compared the released version against itself and would have done exactly
// that, while still catching the residue for the wrong reason. Both paths are
// asserted here so the distinction cannot quietly rot.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'check-version-residue.mjs');
const made = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** A repo whose `origin/staging` carries `released`, committed and clean. */
function repo(released) {
  const dir = mkdtempSync(join(tmpdir(), 'vr-'));
  made.push(dir);
  const origin = join(dir, 'origin');
  const work = join(dir, 'work');
  mkdirSync(origin);
  git(origin, 'init', '-q', '--bare', '--initial-branch=staging');
  mkdirSync(work);
  git(work, 'init', '-q', '--initial-branch=staging');
  git(work, 'config', 'user.email', 't@t');
  git(work, 'config', 'user.name', 't');
  mkdirSync(join(work, 'apps/web/lib'), { recursive: true });
  writeFileSync(join(work, 'package.json'), `${JSON.stringify({ version: released }, null, 2)}\n`);
  writeFileSync(join(work, 'apps/web/lib/version.ts'), `export const VERSION = '${released}';\n`);
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'released');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'staging');
  return work;
}

/** Restamp the manifests in the working tree WITHOUT staging them — which is
 *  the state both an abandoned release and a live one leave behind. */
function stamp(work, version) {
  writeFileSync(join(work, 'package.json'), `${JSON.stringify({ version }, null, 2)}\n`);
  writeFileSync(join(work, 'apps/web/lib/version.ts'), `export const VERSION = '${version}';\n`);
}

const run = (cwd) => {
  try {
    return { ok: true, out: execFileSync('node', [SCRIPT], { cwd, encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

describe('check-version-residue', () => {
  it('passes on a clean tree', () => {
    const r = run(repo('1.77.0'));
    expect(r.ok, r.out).toBe(true);
    expect(r.out).toContain('none (released 1.77.0');
  });

  it('passes mid-release, when the uncommitted stamp is higher', () => {
    const work = repo('1.77.0');
    stamp(work, '1.78.0');
    const r = run(work);
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses an uncommitted stamp below what shipped', () => {
    // The real thing: v1.60.0 was amended, the 1.60.1 stamp stayed in the
    // shared checkout, and seventeen releases later it was still there.
    const work = repo('1.77.0');
    stamp(work, '1.60.1');
    const r = run(work);
    expect(r.ok).toBe(false);
    expect(r.out).toContain('not newer than what shipped');
    expect(r.out).toContain('package.json — 1.77.0 → 1.60.1');
    expect(r.out).toContain('apps/web/lib/version.ts — 1.77.0 → 1.60.1');
  });

  it('refuses a stamp EQUAL to what shipped', () => {
    // Re-releasing a number that already exists is the collision
    // `release-guard.sh` exists to stop; catching it here too costs nothing.
    // Local HEAD sits below the released number so there is a real diff to
    // judge — which is also what a checkout that fell behind looks like.
    const work = repo('1.77.0');
    stamp(work, '1.70.0');
    git(work, 'commit', '-qam', 'an older base');
    stamp(work, '1.77.0');
    const r = run(work);
    expect(r.ok).toBe(false);
    expect(r.out).toContain('not newer than what shipped');
  });

  it('ignores a manifest edited for something other than its version', () => {
    const work = repo('1.77.0');
    writeFileSync(
      join(work, 'package.json'),
      `${JSON.stringify({ version: '1.77.0', scripts: { new: 'thing' } }, null, 2)}\n`,
    );
    const r = run(work);
    expect(r.ok, r.out).toBe(true);
  });

  it('skips rather than fails when there is no origin ref', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vr-'));
    made.push(dir);
    git(dir, 'init', '-q', '--initial-branch=staging');
    git(dir, 'config', 'user.email', 't@t');
    git(dir, 'config', 'user.name', 't');
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ version: '1.0.0' }, null, 2)}\n`);
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'x');
    const r = run(dir);
    expect(r.ok, r.out).toBe(true);
    expect(r.out).toContain('skipped');
  });
});
