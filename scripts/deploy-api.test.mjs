// deploy-api.sh: every way a deploy can SUCCEED ends by freeing the runway.
//
// Until 2026-10-01 two of the probe branches printed their line and ran
// `exit 0` — above the `./scripts/runway.sh land` at the bottom of the file.
// A deploy probed by a script, or by `status:`, succeeded and left its
// clearance standing; the runway then read BUSY until the clearance lapsed,
// with nothing wrong and nothing to see. It happened on a production deploy
// and on a staging one the same day before anybody connected the two.
//
// The script cannot be run for real in a test (it deploys), so it is run
// with `fly`, `git`, `curl` and the runway replaced by stubs on PATH, in a
// throwaway copy of the repo's scripts. What is asserted is the one thing
// that matters: for each success path, was `runway.sh land` called or not.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(join(REPO, 'scripts/deploy-api.sh'), 'utf8');

/** A sandbox: a real git repo at a known commit, with stubs for everything
 *  the script would otherwise do to the world. */
function sandbox({ machines = 1 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-api-'));
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'apps/api/src'), { recursive: true });
  cpSync(join(REPO, 'scripts/deploy-api.sh'), join(dir, 'scripts/deploy-api.sh'));
  writeFileSync(join(dir, 'apps/api/src/server.ts'), '// fixture\n');
  writeFileSync(join(dir, 'fly.staging.toml'), "app = 'thefibre-api-staging'\n");

  // The runway: clearance checks pass, and `land` leaves a mark.
  writeFileSync(
    join(dir, 'scripts/runway.sh'),
    `#!/usr/bin/env bash\necho "runway $*" >> "${dir}/calls.log"\nexit 0\n`,
  );
  const stub = (name, body) => {
    writeFileSync(join(dir, 'bin', name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(dir, 'bin', name), 0o755);
  };
  const list = JSON.stringify(Array.from({ length: machines }, (_, i) => ({ id: `m${i}`, state: 'started' })));
  stub(
    'fly',
    `echo "fly $*" >> "${dir}/calls.log"
case "$1" in
  machines) echo '${list}' ;;
  releases) echo '[{"Version":7}]' ;;
esac
exit 0`,
  );
  // The URL probes: every URL answers 200 with a body that says "ok".
  stub(
    'curl',
    `out=""; fmt=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2 ;; -w) fmt="$2"; shift 2 ;; *) shift ;; esac; done
[ -n "$out" ] && [ "$out" != "/dev/null" ] && printf '{"ok":true}' > "$out"
[ -n "$fmt" ] && printf '200'
exit 0`,
  );
  chmodSync(join(dir, 'scripts/runway.sh'), 0o755);
  chmodSync(join(dir, 'scripts/deploy-api.sh'), 0o755);

  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  writeFileSync(join(dir, '.gitignore'), 'calls.log\nbin/\nprobe-*.mjs\n');
  git('add', '.');
  git('commit', '-q', '-m', 'fixture');
  // The script fetches `origin` and deploys `origin/staging`: give it a real
  // (bare, local) origin whose staging branch is this commit.
  const origin = mkdtempSync(join(tmpdir(), 'deploy-api-origin-'));
  execFileSync('git', ['init', '-q', '--bare', origin], { stdio: 'pipe' });
  git('remote', 'add', 'origin', origin);
  git('push', '-q', 'origin', 'HEAD:refs/heads/staging');
  git('fetch', '-q', 'origin');

  writeFileSync(join(dir, 'probe-pass.mjs'), 'process.exit(0);\n');
  writeFileSync(join(dir, 'probe-fail.mjs'), 'process.exit(1);\n');

  const run = (...args) => {
    writeFileSync(join(dir, 'calls.log'), '');
    const r = spawnSync('bash', ['scripts/deploy-api.sh', ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, RUNWAY_SESSION: 'test' },
    });
    const calls = readFileSync(join(dir, 'calls.log'), 'utf8');
    return {
      code: r.status,
      out: `${r.stdout}\n${r.stderr}`,
      deployed: /^fly deploy/m.test(calls),
      landed: /^runway land/m.test(calls),
    };
  };
  return { dir, run };
}

describe('deploy-api.sh frees the runway on every success path', () => {
  const { dir, run } = sandbox();

  it('the sandbox really runs the script to its end (a guard on the harness)', () => {
    const r = run('staging', '--no-visible-change');
    expect(r.out).toContain('deployed');
    expect(r.code, r.out).toBe(0);
    expect(r.deployed).toBe(true);
  });

  const paths = [
    ['--no-visible-change', ['--no-visible-change']],
    ['--behind-auth', ['--behind-auth', 'an email body changed']],
    ['a SCRIPT probe (the path that used to exit early)', ['--probe', join(dir, 'probe-pass.mjs')]],
    ['a status: probe (the other early exit)', ['--probe', 'https://example.test/health | status:200']],
    ['a body probe', ['--probe', 'https://example.test/health | ok']],
  ];
  for (const [name, args] of paths) {
    it(`${name}: deploys, and lands`, () => {
      const r = run('staging', ...args);
      expect(r.code, r.out).toBe(0);
      expect(r.deployed, r.out).toBe(true);
      expect(r.landed, `runway.sh land was not called\n${r.out}`).toBe(true);
    });

    it(`${name} with --dry-run: deploys nothing, and deliberately does NOT land`, () => {
      const r = run('staging', ...args, '--dry-run');
      expect(r.code, r.out).toBe(0);
      expect(r.deployed).toBe(false);
      expect(r.landed).toBe(false);
    });
  }

  it('a FAILING probe exits non-zero and does not land: the clearance stays for the fix', () => {
    const r = run('staging', '--probe', join(dir, 'probe-fail.mjs'));
    expect(r.code).not.toBe(0);
    expect(r.deployed).toBe(true);
    expect(r.landed).toBe(false);
  });
});

describe('deploy-api.sh says how many machines are serving', () => {
  it('one machine: a line, no warning', () => {
    const { run } = sandbox({ machines: 1 });
    const r = run('staging', '--no-visible-change');
    expect(r.out).toContain('machines serving thefibre-api-staging: 1');
    expect(r.out).not.toContain('WARNING');
  });

  it('two machines: warns loudly, and still lands (the deploy has happened)', () => {
    const { run } = sandbox({ machines: 2 });
    const r = run('staging', '--no-visible-change');
    expect(r.out).toContain('machines serving thefibre-api-staging: 2');
    expect(r.out).toContain('WARNING: thefibre-api-staging is running 2 machines, not 1.');
    expect(r.code).toBe(0);
    expect(r.landed).toBe(true);
  });
});

describe('the source', () => {
  it('has no success exit above the landing', () => {
    const landing = SOURCE.lastIndexOf('./scripts/runway.sh land');
    expect(landing).toBeGreaterThan(0);
    const before = SOURCE.slice(0, landing)
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'));
    expect(before.filter((l) => /\bexit 0\b/.test(l))).toEqual([]);
  });
});
