// release.sh checks the commit it pushes, not the files beside it.
//
// 2026-10-04, commit 4fab772a: release.sh printed "Released 1.99.2 to
// STAGING" and pushed a commit titled "wip:" whose package.json said 1.99.1
// and whose changelog heading was still [NEXT]. Nothing was bypassed. The
// script pushes HEAD, and read every version surface from the WORKING TREE —
// where next-version.mjs had stamped them and nobody had committed. Its
// subject check fired only on a subject naming a WRONG version, never on one
// naming none. The next session's stamp then numbered itself above an entry
// that never got a number.
//
// The real script runs here in a throwaway repo with a bare origin; the
// runway, the release guard and `pnpm verify` are stand-ins. What is asserted
// is whether origin/staging moved.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// LONG on purpose. The real changelog is 22,000 lines, and the first version
// of the HEAD-reading checks piped `git show` into `grep -q`: on a file this
// size grep closes the pipe early, git dies of SIGPIPE, and under pipefail
// the check fails for a heading that is on line 9. A ten-line fixture could
// not show that, and the script refused its own first release.
const HISTORY = Array.from({ length: 4000 }, (_, i) => `## [0.${i}.0] — an old release\n\n${'Words about it. '.repeat(12)}\n`).join('\n');
const changelog = (heading) => `# Changelog\n\n## [Unreleased]\n\n## [${heading}] — the new thing\n\nWords.\n\n## [1.0.0] — the old thing\n\nWords.\n\n${HISTORY}`;
const pkg = (v) => `${JSON.stringify({ name: 'x', version: v }, null, 2)}\n`;
const versionTs = (v) => `export const VERSION = '${v}';\n`;

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'release-'));
  const origin = mkdtempSync(join(tmpdir(), 'release-origin-'));
  for (const d of ['scripts', 'bin', 'apps/web/lib', 'packages/shared']) mkdirSync(join(dir, d), { recursive: true });
  cpSync(join(REPO, 'scripts/release.sh'), join(dir, 'scripts/release.sh'));
  const stub = (path, body) => {
    writeFileSync(join(dir, path), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(dir, path), 0o755);
  };
  stub('scripts/runway.sh', 'exit 0');
  stub('scripts/release-guard.sh', 'exit 0');
  stub('bin/pnpm', 'exit 0');
  chmodSync(join(dir, 'scripts/release.sh'), 0o755);

  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
  const write = (v, heading = v) => {
    writeFileSync(join(dir, 'package.json'), pkg(v));
    writeFileSync(join(dir, 'apps/web/package.json'), pkg(v));
    writeFileSync(join(dir, 'packages/shared/package.json'), pkg(v));
    writeFileSync(join(dir, 'apps/web/lib/version.ts'), versionTs(v));
    writeFileSync(join(dir, 'CHANGELOG.md'), changelog(heading));
  };
  execFileSync('git', ['init', '-q', '--bare', origin]);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, '.gitignore'), 'bin/\n');
  write('1.0.0');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] — the old thing\n\nWords.\n');
  git('add', '.');
  git('commit', '-q', '-m', 'v1.0.0 — the old thing');
  git('remote', 'add', 'origin', origin);
  git('push', '-q', 'origin', 'HEAD:refs/heads/staging');
  git('push', '-q', 'origin', 'HEAD:refs/heads/main');
  git('fetch', '-q', 'origin');

  const release = (...args) => {
    const r = spawnSync('bash', ['scripts/release.sh', ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, RUNWAY_SESSION: 'test' },
    });
    const staging = execFileSync('git', ['--git-dir', origin, 'rev-parse', 'refs/heads/staging'], { encoding: 'utf8' }).trim();
    return { code: r.status, out: `${r.stdout}\n${r.stderr}`, staging, head: git('rev-parse', 'HEAD').trim() };
  };
  return { dir, git, write, release };
}

describe('release.sh', () => {
  it('releases a commit that is stamped, committed and named (a guard on the harness)', () => {
    const s = sandbox();
    writeFileSync(join(s.dir, 'feature.txt'), 'x\n');
    s.write('1.0.1');
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'v1.0.1 — the new thing');
    const r = s.release();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('Released 1.0.1 to STAGING');
    expect(r.staging).toBe(r.head);
  });

  it('REFUSES the shape of 4fab772a: stamps on disk, not in the commit, subject "wip:"', () => {
    const s = sandbox();
    // The work, committed unstamped, with its changelog entry still [NEXT]…
    writeFileSync(join(s.dir, 'feature.txt'), 'x\n');
    writeFileSync(join(s.dir, 'CHANGELOG.md'), changelog('NEXT'));
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'wip: the organiser page was built for a one-line bio');
    const before = s.release().staging;
    // …then next-version.mjs stamps the working tree and nobody commits it.
    s.write('1.0.1');
    const r = s.release();
    expect(r.code, r.out).not.toBe(0);
    expect(r.out).toContain('REFUSED');
    expect(r.out).toContain('NOT in the commit');
    expect(r.out).not.toContain('Released');
    expect(r.staging, 'origin/staging must not have moved').toBe(before);
  });

  it('refuses stamps that are committed under a subject naming no version', () => {
    const s = sandbox();
    s.write('1.0.1');
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'wip: almost a release');
    const before = s.git('rev-parse', 'origin/staging').trim();
    const r = s.release();
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('names no version');
    expect(r.staging).toBe(before);
  });

  it('refuses a subject naming a different version from the one the commit carries', () => {
    const s = sandbox();
    s.write('1.0.2');
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'v1.0.1 — renumbered by a lost race');
    const r = s.release();
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('the commit subject says v1.0.1, this release is 1.0.2');
  });

  it('refuses a [NEXT] entry left above the numbered one', () => {
    const s = sandbox();
    s.write('1.0.1');
    writeFileSync(
      join(s.dir, 'CHANGELOG.md'),
      '# Changelog\n\n## [Unreleased]\n\n## [NEXT] — somebody else, never numbered\n\nWords.\n\n## [1.0.1] — the new thing\n\nWords.\n\n## [1.0.0] — old\n',
    );
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'v1.0.1 — the new thing');
    const r = s.release();
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('the top CHANGELOG entry in HEAD is not [1.0.1]');
  });

  it('refuses when one package.json was left behind', () => {
    const s = sandbox();
    s.write('1.0.1');
    writeFileSync(join(s.dir, 'packages/shared/package.json'), pkg('1.0.0'));
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'v1.0.1 — the new thing');
    const r = s.release();
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('packages/shared/package.json is at 1.0.0 in HEAD, not 1.0.1');
  });

  it('reads the version from HEAD, not from the file on disk', () => {
    const s = sandbox();
    s.write('1.0.1');
    s.git('add', '.');
    s.git('commit', '-q', '-m', 'v1.0.1 — the new thing');
    // Somebody's uncommitted edit to a file that is NOT a version surface is
    // not this release's business (the shared-checkout rule)…
    writeFileSync(join(s.dir, 'feature.txt'), 'a peer is mid-edit\n');
    const r = s.release();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('Released 1.0.1 to STAGING');
  });
});
