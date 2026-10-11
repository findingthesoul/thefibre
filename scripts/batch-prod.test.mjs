// `batch-prod` clearances: what they authorise, and what they must not.
//
// This kind was added so ONE clearance can cover a whole production sitting —
// the migration push, the promote and the API deploy — instead of the
// controller granting `prod`, waiting for the promote to land, then granting
// `api-prod`. That second wait was half the reason Sjoerd was pressing Run
// four times.
//
// Widening what a clearance authorises is the kind of change that is easy to
// get subtly too wide, so the REFUSALS are asserted at least as carefully as
// the acceptances: a `batch-prod` clearance must not let anything land on
// staging, and an ordinary `release` clearance must not reach production.
//
// runway.sh is run for real against a throwaway clearance file in a sandbox
// git repo. Nothing here touches the shared runway state.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A sandbox repo with runway.sh, a remote, and a clearance we control. */
function sandbox({ kind, sha, said = 'go ahead', minutes = 90 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'batch-prod-'));
  mkdirSync(join(dir, 'scripts'));
  cpSync(join(REPO, 'scripts/runway.sh'), join(dir, 'scripts/runway.sh'));
  chmodSync(join(dir, 'scripts/runway.sh'), 0o755);

  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  writeFileSync(join(dir, 'x'), 'x\n');
  git('add', '.');
  git('commit', '-qm', 'one');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
  // Both refs exist and point at HEAD, so a base check can pass.
  git('update-ref', 'refs/remotes/origin/main', head);
  git('update-ref', 'refs/remotes/origin/staging', head);
  // `git fetch -q origin` must succeed without a network: point origin at
  // ourselves. Without this the check dies for an unrelated reason and the
  // test would "pass" against a script that never reached its own logic.
  git('remote', 'add', 'origin', dir);

  // Exactly where runway.sh keeps it: <git-common-dir>/runway/clearance.
  // Guessing this wrong is what made the first run report "no clearance" for
  // every case — which would have looked like the refusals working.
  const gitDir = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: dir })
    .toString()
    .trim();
  const runwayDir = join(dir, gitDir, 'runway');
  mkdirSync(runwayDir, { recursive: true });
  const clearance = join(runwayDir, 'clearance');
  if (kind) {
    writeFileSync(
      clearance,
      [
        'session=tester',
        `kind=${kind}`,
        `sha=${sha ?? head}`,
        `base=${head}`,
        'by=controller',
        `expires=${Math.floor(Date.now() / 1000) + minutes * 60}`,
        `said=${said}`,
      ].join('\n') + '\n',
    );
  }
  return { dir, head };
}

function check(dir, kind, session = 'tester') {
  return spawnSync('./scripts/runway.sh', ['check', '--kind', kind], {
    cwd: dir,
    env: { ...process.env, RUNWAY_SESSION: session, RUNWAY_BYPASS: '' },
    encoding: 'utf8',
  });
}

describe('a batch-prod clearance', () => {
  it('satisfies the promote and the API deploy — the two it exists for', () => {
    const { dir } = sandbox({ kind: 'batch-prod' });
    for (const kind of ['prod', 'api-prod']) {
      const r = check(dir, kind);
      expect(r.status, `${kind} should be allowed: ${r.stderr}`).toBe(0);
    }
  });

  it('satisfies a check for its own kind', () => {
    const { dir } = sandbox({ kind: 'batch-prod' });
    expect(check(dir, 'batch-prod').status).toBe(0);
  });

  it('does NOT let anything land on staging', () => {
    // The widening must stop at production. A batch-prod clearance standing
    // for an hour and a half must not become a licence to push releases.
    const { dir } = sandbox({ kind: 'batch-prod' });
    for (const kind of ['release', 'docs', 'api-staging']) {
      const r = check(dir, kind);
      expect(r.status, `${kind} should be refused`).not.toBe(0);
      expect(r.stderr).toMatch(/clearance is for batch-prod, not/);
    }
  });

  it('is refused for a session that does not hold it', () => {
    const { dir } = sandbox({ kind: 'batch-prod' });
    const r = check(dir, 'prod', 'somebody-else');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/held by tester/);
  });
});

describe('the sitting as a SEQUENCE, not three separate checks', () => {
  // The defect this exists for, and why the first ten tests could not see it:
  // they each called `check` once. promote.sh calls `check --kind prod` and
  // then, four lines later, `runway.sh land`. Under a batch-prod clearance
  // that land was accepted — right holder, cleared sha now on the ref — and
  // deleted the clearance. deploy-api.sh then asked for api-prod, found
  // nothing, and refused. Main promoted, API not deployed, runway free: the
  // exact half-cutover batch-prod.sh was written to prevent.
  //
  // Only running the steps IN ORDER shows it.
  function land(dir, session = 'tester', final = false) {
    return spawnSync('./scripts/runway.sh', ['land'], {
      cwd: dir,
      env: {
        ...process.env,
        RUNWAY_SESSION: session,
        RUNWAY_BYPASS: '',
        ...(final ? { RUNWAY_BATCH_FINAL: '1' } : {}),
      },
      encoding: 'utf8',
    });
  }
  const held = (dir) =>
    spawnSync('./scripts/runway.sh', ['clearance'], { cwd: dir, encoding: 'utf8' }).status === 0;

  it('survives promote.sh landing in the middle of it', () => {
    const { dir } = sandbox({ kind: 'batch-prod' });

    expect(check(dir, 'prod').status, 'the promote should be cleared').toBe(0);
    const l = land(dir);
    expect(l.stdout + l.stderr).toMatch(/still held/);
    expect(held(dir), 'the clearance must survive promote.sh land').toBe(true);

    // The step that used to be refused.
    expect(check(dir, 'api-prod').status, 'the API deploy should still be cleared').toBe(0);
    const l2 = land(dir);
    expect(l2.stdout + l2.stderr).toMatch(/still held/);
    expect(held(dir), 'and survive deploy-api.sh land too').toBe(true);
  });

  it('is released by the batch, at the end, and only then', () => {
    const { dir } = sandbox({ kind: 'batch-prod' });
    land(dir);
    expect(held(dir)).toBe(true);
    land(dir, 'tester', true);
    expect(held(dir), 'RUNWAY_BATCH_FINAL=1 should free it').toBe(false);
  });

  it('does not change how an ordinary release lands', () => {
    // The guard must not make every clearance sticky: a release that lands
    // and does not free the runway blocks everybody.
    const { dir } = sandbox({ kind: 'release' });
    land(dir);
    expect(held(dir), 'a release clearance should still be freed by land').toBe(false);
  });
});

describe('the other direction', () => {
  it('a release clearance still cannot reach production', () => {
    // The pre-existing rule, asserted here because the change that let
    // batch-prod satisfy `prod` is exactly the shape that could have let
    // everything satisfy everything.
    const { dir } = sandbox({ kind: 'release' });
    for (const kind of ['prod', 'api-prod']) {
      const r = check(dir, kind);
      expect(r.status, `${kind} should be refused`).not.toBe(0);
      expect(r.stderr).toMatch(/clearance is for release, not/);
    }
  });

  it('an api-prod clearance does not cover the promote', () => {
    const { dir } = sandbox({ kind: 'api-prod' });
    const r = check(dir, 'prod');
    expect(r.status).not.toBe(0);
  });
});

describe('how long a sitting gets', () => {
  // 90 minutes, defaulted in runway.sh rather than left to the controller to
  // remember on the --minutes flag. A sitting is a database push, a promote
  // and a Fly deploy; 45 is the window for a single landing. The script also
  // refuses to START the promote under 30 minutes, but a short grant would
  // simply move the refusal earlier and waste the sitting.
  //
  // This test exists because the first version of the change had no test and
  // a mutation removing the default passed everything.
  function grantAndRead(kind, extra = []) {
    const { dir, head } = sandbox({});
    const req = spawnSync(
      './scripts/runway.sh',
      ['request', '--kind', kind, '--sha', head, '--what', 'w', '--verified', 'v', '--unverified', 'u'],
      { cwd: dir, env: { ...process.env, RUNWAY_SESSION: 'tester' }, encoding: 'utf8' },
    );
    if (req.status !== 0) throw new Error(`request failed: ${req.stderr}`);
    const said = kind.includes('prod') ? ['--sjoerd-said', 'go'] : [];
    const cl = spawnSync(
      './scripts/runway.sh',
      ['clear', 'tester', '--by', 'controller', ...said, ...extra],
      { cwd: dir, encoding: 'utf8' },
    );
    if (cl.status !== 0) throw new Error(`clear failed: ${cl.stderr}`);
    const out = spawnSync('./scripts/runway.sh', ['clearance'], { cwd: dir, encoding: 'utf8' });
    return Number(out.stdout.match(/minutes_left=(\d+)/)?.[1]);
  }

  it('gives batch-prod 90 minutes without anybody asking', () => {
    const left = grantAndRead('batch-prod');
    // 89 because a second or two has passed since the grant.
    expect(left).toBeGreaterThanOrEqual(85);
    expect(left).toBeLessThanOrEqual(90);
  });

  it('leaves every other kind on the usual window', () => {
    // api-staging rather than release: a release grant also checks that the
    // commit changes something against origin/staging, which a one-commit
    // sandbox cannot satisfy. The window is what is under test, not the
    // release preflight.
    const left = grantAndRead('api-staging');
    expect(left).toBeLessThan(60);
  });

  it('still lets the controller say otherwise', () => {
    const left = grantAndRead('batch-prod', ['--minutes', '20']);
    expect(left).toBeLessThanOrEqual(20);
  });
});

describe('granting one', () => {
  it('needs Sjoerd’s own words, like every production kind', () => {
    const { dir, head } = sandbox({});
    const r = spawnSync(
      './scripts/runway.sh',
      ['clear', 'tester', '--by', 'controller'],
      { cwd: dir, env: { ...process.env }, encoding: 'utf8' },
    );
    // No queued request here, so it fails early — what matters is that the
    // requirement lives in runway.sh and not in batch-prod.sh, which the
    // source assertion below checks directly.
    expect(r.status).not.toBe(0);
    const src = execFileSync('cat', [join(REPO, 'scripts/runway.sh')]).toString();
    expect(src).toMatch(/prod\|api-prod\|batch-prod\)\n\s*\[ -n "\$said" \]/);
  });

  it('is a known kind', () => {
    const src = execFileSync('cat', [join(REPO, 'scripts/runway.sh')]).toString();
    expect(src).toMatch(/release\|docs\|api-staging\|api-prod\|prod\|batch-prod/);
  });
});

describe('the migration-gap check', () => {
  // It read the WHOLE `supabase migration list` table and grepped it for each
  // local version. That table is `Local | Remote | Time`, so every version
  // matched its own LOCAL column and the check passed for a migration missing
  // remotely — the vacuous shape, answering "is this migration known here",
  // which is never in doubt. Only the second column is evidence.
  //
  // Driven through `--remote-migrations`, the parser's own entry point, with
  // a stub standing in for the Supabase CLI: a live database cannot be asked
  // for a local-only row, and that row is the entire case.
  const LISTING = [
    '  ',
    '   Local          | Remote         | Time (UTC)          ',
    '  ----------------|----------------|---------------------',
    '   20260512100000 | 20260512100000 | 2026-05-12 10:00:00 ',
    '   20261011230252 |                |                     ',
  ].join('\n');

  function remoteVersions(listing) {
    const dir = mkdtempSync(join(tmpdir(), 'mig-list-'));
    const stub = join(dir, 'fake-list');
    writeFileSync(stub, `#!/usr/bin/env bash\ncat <<'LISTING_EOF'\n${listing}\nLISTING_EOF\n`);
    chmodSync(stub, 0o755);
    const r = spawnSync('./scripts/batch-prod.sh', ['--remote-migrations'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, BATCH_PROD_LIST_CMD: stub },
    });
    if (r.status !== 0) throw new Error(`parser exited ${r.status}: ${r.stderr}`);
    return r.stdout.trim().split('\n').filter(Boolean);
  }

  it('reports only what the REMOTE column shows', () => {
    const got = remoteVersions(LISTING);

    // Named explicitly rather than only checked for absence — an empty result
    // would satisfy "the local-only one is missing" and prove nothing.
    expect(got).toEqual(['20260512100000']);
    // The local-only row. This is the assertion the old grep could never
    // fail, because that version appears in its own Local column.
    expect(got).not.toContain('20261011230252');
  });

  it('is not fooled by the header or the rule', () => {
    const got = remoteVersions(LISTING);
    expect(got.every((v) => /^\d{14}$/.test(v))).toBe(true);
  });

  it('reports nothing when the remote history is empty', () => {
    const empty = [
      '   Local          | Remote         | Time (UTC)          ',
      '  ----------------|----------------|---------------------',
      '   20260512100000 |                |                     ',
    ].join('\n');
    expect(remoteVersions(empty)).toEqual([]);
  });
});

describe('a dry run, all the way through', () => {
  // The rehearsal, as a test rather than a one-off. It cannot be run against
  // the real repo for a plain reason: the script refuses a sha that is not
  // origin/staging, and the script itself is not on staging until it lands —
  // so the first version of it can never rehearse itself. A sandbox where
  // origin/staging is ours removes that circularity, and keeps the rehearsal
  // repeatable for the next change to this script.
  //
  // Everything the dry run would touch is absent by design: it runs no
  // supabase, no fly, no push. The only stub is the gate's lookup, because
  // the gate's two OUTCOMES are the point.

  function fullSandbox({ flagged, pendingFlag = 'true', lookupFails = false } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'batch-walk-'));
    const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });

    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'supabase/migrations'), { recursive: true });
    mkdirSync(join(dir, 'apps/api/src/lib'), { recursive: true });
    mkdirSync(join(dir, 'apps/api/scripts'), { recursive: true });

    for (const f of ['batch-prod.sh', 'runway.sh']) {
      cpSync(join(REPO, 'scripts', f), join(dir, 'scripts', f));
      chmodSync(join(dir, 'scripts', f), 0o755);
    }
    writeFileSync(join(dir, 'supabase/migrations/20260101000000_one.sql'), '-- one\n');
    writeFileSync(
      join(dir, 'apps/api/src/lib/zoom-pending.ts'),
      `export const ZOOM_MARKETPLACE_PENDING = ${pendingFlag};\n`,
    );
    // The gate's lookup, stubbed: the real one needs a database and this test
    // is about what the gate DOES with the answer.
    writeFileSync(
      join(dir, 'apps/api/scripts/zoom-flagged-workspaces.mjs'),
      lookupFails
        ? `console.log('error=cannot read apps/api/.env: ENOENT');\n`
        : flagged
          ? `console.log('name=Zoom review (zoom-review)');\n`
          : '',
    );

    git('init', '-q', '-b', 'staging');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    git('add', '.');
    git('commit', '-qm', 'sandbox');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
    git('branch', '-f', 'main', head);
    git('remote', 'add', 'origin', dir);
    git('fetch', '-q', 'origin');
    return { dir, head };
  }

  /** A dry run with the environment PINNED.
   *
   *  FIBRE_ENV_FILE is inherited by anything run under `pnpm verify`, which
   *  exports it — so a test that lets it through measures whatever the
   *  release happened to set, and the gate named that file instead of
   *  "production". Same class as the shared-runway flakiness above: a test
   *  that reads ambient state passes until somebody's environment differs. */
  function dryRun(dir, sha, env = {}) {
    return spawnSync('./scripts/batch-prod.sh', [sha, '--dry-run'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, RUNWAY_SESSION: '', FIBRE_ENV_FILE: '.env', ...env },
    });
  }

  it('refuses a REAL run with no clearance, and says how to get one', () => {
    // In a SANDBOX, not the real repo. The first version of this ran
    // batch-prod.sh here in the checkout, where it read the SHARED runway
    // clearance — so it passed only while the runway happened to be free and
    // failed during every release, including the one trying to ship it. A
    // gate that fails randomly is worse than no gate.
    const { dir, head } = fullSandbox({ flagged: true });
    const r = spawnSync('./scripts/batch-prod.sh', [head], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, RUNWAY_SESSION: '' },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/BATCH STOPPED at clearance/);
    expect(r.stderr).toMatch(/--kind batch-prod --sjoerd-said/);
    // The promise that matters on a failure: say how far it got.
    expect(r.stderr).toMatch(/Nothing after this step ran/);
  });

  it('lets a DRY RUN past step 0 without one, and says what it would need', () => {
    // A live batch-prod clearance is real production authority for as long as
    // it is held, whatever flag the script was invoked with. So a rehearsal
    // must not require one — otherwise rehearsing means getting production
    // authority granted for a sha nobody has approved.
    const { dir, head } = fullSandbox({ flagged: true });
    const r = dryRun(dir, head);
    expect(r.stdout).toMatch(/would need: a batch-prod clearance for/);
    expect(r.stdout).toMatch(/held now\s*: none/);
    expect(r.stderr).not.toMatch(/BATCH STOPPED at clearance/);
  });

  it('walks every read-only step and says what it did not prove', () => {
    const { dir, head } = fullSandbox({ flagged: true });
    const r = dryRun(dir, head);

    expect(r.status, r.stderr).toBe(0);
    // Each step, in order — not just the happy ending.
    expect(r.stdout).toMatch(/would need: a batch-prod clearance/);
    expect(r.stdout).toMatch(/origin\/staging == \w{8}, tree clean/);
    expect(r.stdout).toMatch(/would run: \.\/scripts\/db-push-prod\.sh --yes/);
    expect(r.stdout).toMatch(/flagged: Zoom review/);
    expect(r.stdout).toMatch(/min left on the clearance/);
    expect(r.stdout).toMatch(/would run: MIGRATIONS_ON_PROD=yes/);
    expect(r.stdout).toMatch(/would deploy the API/);
    expect(r.stdout).toMatch(/DRY RUN OK/);
    // And the honesty at the end: a dry run must not read as a rehearsal of
    // the steps it skipped.
    expect(r.stdout).toMatch(/NOT REHEARSED by a dry run/);
  });

  it('stops at the gate when no workspace is exempt, and says what to do', () => {
    const { dir, head } = fullSandbox({ flagged: false });
    const r = dryRun(dir, head);

    expect(r.status).not.toBe(0);
    expect(r.stdout).toMatch(/NO WORKSPACE on production carries zoom_notice_hidden/);
    expect(r.stderr).toMatch(/BATCH STOPPED at preflight gates/);
    // The three things the message must carry: where it stopped, that the
    // stop is safe, and the exact command to fix it.
    // A dry run wrote nothing, and the message must say THAT rather than
    // the real-sitting sentence. A safety message that misstates what
    // happened teaches people to skim it.
    expect(r.stderr).toMatch(/Nothing was written anywhere — this was a dry run/);
    expect(r.stderr).not.toMatch(/The database IS updated/);
    expect(r.stderr).toMatch(/zoom-notice-optout\.mjs/);
    expect(r.stderr).toMatch(/re-run this same command/);
    // It must NOT have reached the promote.
    expect(r.stdout).not.toMatch(/MIGRATIONS_ON_PROD/);
  });

  it('says the same true thing when the exemption cannot be CHECKED', () => {
    // The branch the first version of the truthful-message fix missed. STATE
    // was defined inside the second stop branch, so this one still carried
    // the real-sitting sentence verbatim — two copies of a sentence, one of
    // them fixed, which is the ordinary way a correction half-lands.
    //
    // "Nobody looked" must also never read as "the flag is missing": they
    // send a person to do completely different things.
    // The stub goes in BEFORE the sandbox commits: writing it afterwards
    // leaves the tree dirty and the script stops at Checkout instead, which
    // is what the first version of this test measured.
    const { dir, head } = fullSandbox({ lookupFails: true });
    const r = dryRun(dir, head);

    expect(r.status).not.toBe(0);
    expect(r.stdout).toMatch(/COULD NOT CHECK the exemption/);
    expect(r.stderr).toMatch(/could not be CHECKED/);
    expect(r.stderr).toMatch(/This is not "the flag is missing" — it is "nobody looked"/);
    // The same truthfulness as the other branch.
    expect(r.stderr).toMatch(/Nothing was written anywhere — this was a dry run/);
    expect(r.stderr).not.toMatch(/The database IS updated/);
  });

  it('names the stack it looked at, so a rehearsal cannot read as production', () => {
    // The gate used to say "on production" whatever it had just queried. A
    // staging dry run therefore reported a production fact, which is the kind
    // of small untruth that makes somebody trust the next one.
    const { dir, head } = fullSandbox({ flagged: false });
    const prod = dryRun(dir, head);
    expect(prod.stdout).toMatch(/NO WORKSPACE on production carries/);

    const staging = dryRun(dir, head, { FIBRE_ENV_FILE: '.env.staging' });
    expect(staging.stdout).toMatch(/NO WORKSPACE on the stack in \.env\.staging carries/);
    // NOT a blanket "production must not appear": the database step really
    // does mean production even here, because db-push-prod.sh is pinned to
    // the production project ref and FIBRE_ENV_FILE steers only the gate.
    // The script says so rather than leaving it to be inferred.
    expect(staging.stdout).toMatch(/only THIS GATE reads the stack in \.env\.staging/);
    expect(staging.stdout).toMatch(/always mean production/);
  });

  it('retires the gate on its own when the flag goes false', () => {
    // The gate reads the constant from the source at this sha, so turning the
    // flag off cannot leave it stuck on — and an unexempt workspace stops
    // mattering at the same moment.
    const { dir, head } = fullSandbox({ flagged: false, pendingFlag: 'false' });
    const r = dryRun(dir, head);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/gate retired, delete it/);
  });
});

describe('batch-prod.sh itself', () => {
  it('wants a sha', () => {
    const r = spawnSync('./scripts/batch-prod.sh', [], { cwd: REPO, encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage/);
  });
});
