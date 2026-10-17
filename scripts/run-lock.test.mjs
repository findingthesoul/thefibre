// scripts/lib/run-lock.sh, driven the way the scripts use it: real bash
// processes in a throwaway git repository (the lock lives in its git dir).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const LIB = resolve(import.meta.dirname, 'lib/run-lock.sh');
const repo = mkdtempSync(join(tmpdir(), 'run-lock-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, 'scripts/lib'), { recursive: true });
copyFileSync(LIB, join(repo, 'scripts/lib/run-lock.sh'));

/** A script that takes the lock, says so, and holds it for `seconds`. */
function script(name, body) {
  const p = join(repo, 'scripts', name);
  writeFileSync(p, `#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "$0")/.."\n. scripts/lib/run-lock.sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}
const holder = script('holder.sh', 'run_lock_acquire demo || exit 75\necho HELD\nsleep "${1:-5}"');
const second = script('second.sh', 'run_lock_acquire demo || exit $?\necho GOT');
const lockDir = join(repo, '.git/runway/locks/demo');

const run = (file, env = {}) => spawnSync(file, [], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...env } });
function startHolder(seconds = 5) {
  const child = spawn(holder, [String(seconds)], { cwd: repo, env: process.env });
  return new Promise((ok) => child.stdout.on('data', (d) => String(d).includes('HELD') && ok(child)));
}
const procs = [];
afterAll(() => procs.forEach((p) => p.kill('SIGKILL')));

describe('run-lock', () => {
  it('a second run is REFUSED while the first holds the lock, naming its pid and terminal', async () => {
    const h = await startHolder(5);
    procs.push(h);
    const r = run(second);
    expect(r.status).toBe(75);
    expect(r.stdout).not.toContain('GOT');
    expect(r.stderr).toContain('REFUSED: demo is already running');
    expect(r.stderr).toContain(`pid     : ${h.pid}`);
    expect(r.stderr).toMatch(/terminal: /);
    expect(r.stderr).toContain('Nothing ran here.');
    h.kill('SIGTERM');
    await new Promise((ok) => h.on('exit', ok));
  });

  it('the lock is gone once its holder exits', async () => {
    const h = await startHolder(0);
    await new Promise((ok) => h.on('exit', ok));
    expect(existsSync(lockDir)).toBe(false);
    expect(run(second).stdout).toContain('GOT');
  });

  it('a lock left by a holder that died without cleaning up is stale, and taken over', async () => {
    const h = await startHolder(30);
    h.kill('SIGKILL'); // no trap runs: the lock stays behind
    await new Promise((ok) => h.on('exit', ok));
    expect(existsSync(lockDir)).toBe(true);
    const r = run(second);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('no longer running — taking it over');
    expect(r.stdout).toContain('GOT');
  });

  it("a child carrying the holder's token goes through (batch-prod.sh → deploy-api.sh)", async () => {
    const parent = script('parent.sh', 'run_lock_acquire demo || exit 75\n"$(dirname "$0")/second.sh"');
    const r = run(parent);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('GOT');
    expect(existsSync(lockDir)).toBe(false); // released by the parent, once
  });
});
