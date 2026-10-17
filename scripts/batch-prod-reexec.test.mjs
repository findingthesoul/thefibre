// batch-prod.sh runs from a COPY of itself: a change to the file on disk in
// the middle of a sitting (its own fast-forward pulls a new version in) does
// not reach the run in flight. With a negative control, so the test is seen
// to fail where the protection is missing.
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = resolve(import.meta.dirname, '..');

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'batch-prod-reexec-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(join(REPO, 'scripts/batch-prod.sh'), join(dir, 'scripts/batch-prod.sh'));
  cpSync(join(REPO, 'scripts/lib'), join(dir, 'scripts/lib'), { recursive: true });
  return dir;
}

/** Start batch-prod.sh with no arguments (it ends at its usage line), hold it
 *  at the test seam, replace the file on disk, then let it go on. */
async function runWhileTheFileChanges(extraEnv) {
  const dir = sandbox();
  const hold = join(dir, 'hold');
  const child = spawn('bash', ['scripts/batch-prod.sh'], {
    cwd: dir,
    env: { ...process.env, BATCH_PROD_TEST_HOLD: hold, ...extraEnv(dir) },
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  for (let i = 0; i < 100 && !existsSync(`${hold}.ready`); i++) await new Promise((r) => setTimeout(r, 50));
  expect(existsSync(`${hold}.ready`), 'the run reached the hold').toBe(true);
  // What a fast-forward does to the file: new bytes, same path.
  writeFileSync(join(dir, 'scripts/batch-prod.sh'), '#!/usr/bin/env bash\necho TAMPERED\nexit 99\n');
  writeFileSync(hold, '');
  const code = await new Promise((r) => child.on('exit', r));
  return { code, out };
}

describe('batch-prod.sh runs from a copy of itself', () => {
  it('a file changed on disk mid-run does not reach the run in flight', async () => {
    const r = await runWhileTheFileChanges(() => ({}));
    expect(r.out).not.toContain('TAMPERED');
    expect(r.out).toContain('usage:');
    expect(r.code).toBe(2);
  });

  it('negative control: without the copy, the same change derails the run', async () => {
    // BATCH_PROD_SELF set from outside = "already the copy": it runs the
    // file on disk directly, as every sitting did before 2026-10-17.
    const r = await runWhileTheFileChanges((dir) => ({ BATCH_PROD_SELF: join(dir, 'scripts/batch-prod.sh') }));
    expect(r.out).not.toContain('usage:');
    expect(r.code).not.toBe(2);
  });
});
