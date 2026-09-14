// The standing guard for SECURITY DEFINER functions (build-plan item of
// 2026-09-13, shipped 2026-09-14).
//
// Every function written since May was "locked" the wrong way by careful
// authors — `revoke ... from public` leaves Supabase's separate grants to
// `anon` and `authenticated` in place (handbook §11.3b). A rule in a
// handbook did not stop them and will not stop the next one; a failing test
// will. So: every SECURITY DEFINER function in supabase/migrations, probed as
// anon and as a real signed-in session, against an explicit reviewed
// allowlist of the ones open on purpose.
//
// No body ever runs: the probe passes a malformed uuid, and Postgres refuses
// (42501) or fails the cast (22P02) before execution. Functions without a
// uuid parameter are the claim readers (STABLE, side-effect free) or trigger
// functions (not reachable over REST at all).
//
// A refusal test needs a success twin (§11.3a): the allowlisted helpers are
// asserted OPEN to authenticated, so a future grant-happy migration that
// closes them by accident — blanking the app — fails here too.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ANON_ALLOWED,
  AUTHENTICATED_ALLOWED,
  collectDefinerFunctions,
  probeAll,
} from '../../scripts/lib/definer-probe.mjs';
import {
  anonKey,
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  url,
  type FixtureUser,
} from './staging.js';

type Row = Awaited<ReturnType<typeof probeAll>>[number];

const fns = collectDefinerFunctions();

let ws: string;
let user: FixtureUser;
let asAnon: Row[];
let asUser: Row[];

beforeAll(async () => {
  ws = await createThrowawayWorkspace('definer');
  user = await createFixtureUser(ws, 'definer');
  asAnon = await probeAll({ url, apikey: anonKey }, fns);
  asUser = await probeAll({ url, apikey: anonKey, bearer: user.accessToken }, fns);
}, 120_000);

afterAll(async () => {
  await deleteFixtureUser(user);
  await deleteThrowawayWorkspace(ws);
});

const openTo = (rows: Row[]) => rows.filter((r) => r.verdict === 'open').map((r) => r.fn.name);

describe('SECURITY DEFINER functions', () => {
  it('the migrations declare some — the parser is not silently empty', () => {
    expect(fns.length).toBeGreaterThan(20);
    expect(fns.map((f) => f.name)).toContain('resolve_sso_identity');
  });

  it('none is executable by anon beyond the reviewed allowlist', () => {
    const leaks = openTo(asAnon).filter((n) => !ANON_ALLOWED.has(n));
    expect(leaks, `open to anon: ${leaks.join(', ')}`).toEqual([]);
  });

  it('none is executable by a signed-in user beyond the RLS helpers', () => {
    const leaks = openTo(asUser).filter((n) => !AUTHENTICATED_ALLOWED.has(n));
    expect(leaks, `open to authenticated: ${leaks.join(', ')}`).toEqual([]);
  });

  it('the RLS helpers ARE executable by a signed-in user (the success twin)', () => {
    const open = new Set(openTo(asUser));
    const reachable = fns.filter((f) => AUTHENTICATED_ALLOWED.has(f.name)).map((f) => f.name);
    const closed = reachable.filter((n) => !open.has(n));
    expect(closed, `RLS helpers closed to authenticated — policies would fail: ${closed.join(', ')}`)
      .toEqual([]);
  });

  it('the allowlists name only functions that exist', () => {
    const known = new Set(fns.map((f) => f.name));
    const stale = [...ANON_ALLOWED, ...AUTHENTICATED_ALLOWED].filter((n) => !known.has(n));
    expect(stale, `allowlisted but no migration defines them as definer: ${stale.join(', ')}`)
      .toEqual([]);
  });
});
