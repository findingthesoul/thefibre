// Merging two organisations, attacked from another workspace.
//
// The organisation twin of persons-merge-tenancy.int.test.ts, and it exists
// because the hole that test was written for is reproducible here by copying
// three lines. merge_organisation / unmerge_organisation / the conflicts
// function all run as the service role and assert only that the two
// organisations share *a* workspace — never the caller's. So a route that
// checks "is the caller an admin?" and then hands the body's UUIDs to the RPC
// lets an admin of workspace A merge any two organisations of workspace B by
// id, read the values the two disagree about, and put back any of B's merges.
//
// That is precisely what was found in the person routes on 2026-09-25. The
// guard (bothOrgsInWorkspace) and this test were both written before the
// organisation routes existed, so the shape could not ship without them.
//
// Same harness as persons-merge-tenancy: the routes run IN PROCESS behind the
// real appContext middleware with real minted sessions, so the JWT, the
// hook-stamped claims and the route code are the production ones. Both halves
// are asserted — the refusal AND that the legitimate admin can still merge,
// compare and undo inside their own workspace, because a guard that refuses
// everything would pass a one-sided test.
//
// Staging only, throwaway workspaces, every row cleaned by its own id.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let wsA: string;
let wsB: string;
/** Admin of A — the attacker, and also the legitimate admin. */
let adminA: FixtureUser;
const orgs: string[] = [];

async function call(user: FixtureUser, method: string, path: string, body?: unknown) {
  return app.request(`/api/v1/organisations${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function org(ws: string, name: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from('organisation')
    .insert({ workspace_id: ws, name, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`organisation fixture: ${error.message}`);
  orgs.push(data!.id as string);
  return data!.id as string;
}

async function deletedAt(id: string): Promise<string | null> {
  const { data, error } = await service
    .from('organisation')
    .select('deleted_at')
    .eq('id', id)
    .single();
  if (error) throw new Error(`organisation read: ${error.message}`);
  return (data!.deleted_at as string | null) ?? null;
}

async function cityOf(id: string): Promise<string | null> {
  const { data, error } = await service.from('organisation').select('city').eq('id', id).single();
  if (error) throw new Error(`organisation read: ${error.message}`);
  return (data!.city as string | null) ?? null;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { organisationsRoutes } = await import('../routes/organisations.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/organisations', organisationsRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('orgmerge-tenancy-a');
  wsB = await createThrowawayWorkspace('orgmerge-tenancy-b');
  adminA = await createFixtureUser(wsA, 'orgmerge-tenancy-admin-a');
  const { error } = await service
    .from('workspace_member')
    .upsert({ workspace_id: wsA, user_id: adminA.userId, workspace_role: 'admin' });
  if (error) throw new Error(`workspace_member fixture: ${error.message}`);
}, 120_000);

afterAll(async () => {
  // Each cleanup is awaited independently: a sequential chain means one throw
  // skips every later one and leaves fixtures behind on staging, which is how
  // fifteen workspaces were left there on 2026-10-09.
  const problems: string[] = [];
  const step = async (what: string, run: () => Promise<{ error: unknown } | void>) => {
    try {
      const r = await run();
      if (r && 'error' in r && r.error) problems.push(`${what}: ${String((r.error as Error).message)}`);
    } catch (e) {
      problems.push(`${what}: ${(e as Error).message}`);
    }
  };
  if (orgs.length) {
    // The audit rows reference the organisations by FK; clear them first.
    await step('organisation_merge', () =>
      service.from('organisation_merge').delete().in('workspace_id', [wsA, wsB]),
    );
    await step('organisation_distinct', () =>
      service.from('organisation_distinct').delete().in('workspace_id', [wsA, wsB]),
    );
    await step('organisation', () => service.from('organisation').delete().in('id', orgs));
  }
  await step('fixture user', async () => {
    if (adminA) await deleteFixtureUser(adminA);
  });
  await step('workspace A', async () => {
    if (wsA) await deleteThrowawayWorkspace(wsA);
  });
  await step('workspace B', async () => {
    if (wsB) await deleteThrowawayWorkspace(wsB);
  });
  if (problems.length) console.error('[fixtures] left behind:\n  ' + problems.join('\n  '));
}, 120_000);

describe('POST /organisations/merge across workspaces', () => {
  it('refuses two organisations of another workspace, and leaves them untouched', async () => {
    const keep = await org(wsB, 'Victim Keep BV');
    const lose = await org(wsB, 'Victim Lose BV', { city: 'Utrecht' });

    const r = await call(adminA, 'POST', '/merge', { keep_id: keep, merge_id: lose });
    expect(r.status).toBe(404);

    // The RPC never ran: nobody was soft-deleted, nothing was copied across,
    // and no audit row exists.
    expect(await deletedAt(lose)).toBeNull();
    expect(await cityOf(keep)).toBeNull();
    const { count } = await service
      .from('organisation_merge')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsB);
    expect(count).toBe(0);
  });

  it('refuses a pair that straddles the two workspaces', async () => {
    const mine = await org(wsA, 'Straddle A BV');
    const theirs = await org(wsB, 'Straddle B BV');
    const r = await call(adminA, 'POST', '/merge', { keep_id: mine, merge_id: theirs });
    expect(r.status).toBe(404);
    expect(await deletedAt(theirs)).toBeNull();
  });

  it('refuses a choices-carrying merge of another workspace’s pair', async () => {
    // The choices are the reason this guard matters more than it did before
    // 20261011213516: without it, an outsider could not merely merge B's
    // organisations but dictate which of the two values survived each field.
    const keep = await org(wsB, 'Choice Keep BV', { city: 'Rotterdam' });
    const lose = await org(wsB, 'Choice Lose BV', { city: 'Groningen' });

    const r = await call(adminA, 'POST', '/merge', {
      keep_id: keep,
      merge_id: lose,
      choices: { city: 'merge' },
    });
    expect(r.status).toBe(404);
    expect(await cityOf(keep)).toBe('Rotterdam');
    expect(await deletedAt(lose)).toBeNull();
  });

  it('still merges — with choices — and undoes, inside the admin’s own workspace', async () => {
    const keep = await org(wsA, 'Own Keep BV', { city: 'Amsterdam' });
    const lose = await org(wsA, 'Own Lose BV', { city: 'Den Haag' });

    const merged = await call(adminA, 'POST', '/merge', {
      keep_id: keep,
      merge_id: lose,
      choices: { city: 'merge' },
    });
    expect(merged.status).toBe(201);
    const { merge_id } = (await merged.json()) as { merge_id: string };
    expect(merge_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await deletedAt(lose)).not.toBeNull();
    // The decision was obeyed: the merged record's city won over an answer.
    expect(await cityOf(keep)).toBe('Den Haag');

    const undone = await call(adminA, 'POST', `/merges/${merge_id}/undo`);
    expect(undone.status).toBe(200);
    expect(await deletedAt(lose)).toBeNull();
    // And the undo put the overwritten value back.
    expect(await cityOf(keep)).toBe('Amsterdam');
  });
});

describe('GET /organisations/merge-conflicts across workspaces', () => {
  it('refuses to compare two organisations of another workspace', async () => {
    const keep = await org(wsB, 'Compare Keep BV', { city: 'Leiden' });
    const lose = await org(wsB, 'Compare Lose BV', { city: 'Delft' });

    const r = await call(adminA, 'GET', `/merge-conflicts?keep=${keep}&merge=${lose}`);
    expect(r.status).toBe(404);
    // Specifically: B's values did not travel. A 404 carrying the comparison
    // in its body would be a leak with a tidy status code.
    expect(await r.text()).not.toContain('Delft');
  });

  it('compares a pair of the admin’s own workspace', async () => {
    const keep = await org(wsA, 'Mine Keep BV', { city: 'Haarlem' });
    const lose = await org(wsA, 'Mine Lose BV', { city: 'Zwolle' });

    const r = await call(adminA, 'GET', `/merge-conflicts?keep=${keep}&merge=${lose}`);
    expect(r.status).toBe(200);
    const { conflicts } = (await r.json()) as {
      conflicts: { name: string; keep_value: unknown; merge_value: unknown }[];
    };
    const city = conflicts.find((c) => c.name === 'city');
    expect(city).toBeDefined();
    expect(city!.keep_value).toBe('Haarlem');
    expect(city!.merge_value).toBe('Zwolle');
  });
});

describe('POST /organisations/merges/:id/undo across workspaces', () => {
  it("refuses to put back another workspace's merge", async () => {
    const keep = await org(wsB, 'Undo Keep BV');
    const lose = await org(wsB, 'Undo Lose BV');
    // B's merge, made the way B's own admin would (service role stands in).
    const { data: mergeId, error } = await service.rpc('merge_organisation', {
      p_keep: keep,
      p_merge: lose,
      p_actor: null,
    });
    if (error) throw new Error(`merge_organisation fixture: ${error.message}`);
    expect(await deletedAt(lose)).not.toBeNull();

    const r = await call(adminA, 'POST', `/merges/${mergeId as string}/undo`);
    expect(r.status).toBe(404);
    // Still merged: the RPC did not run.
    expect(await deletedAt(lose)).not.toBeNull();
  });
});

describe('GET /organisations/duplicates', () => {
  it('proposes only the caller’s own workspace, never the other’s', async () => {
    // The fifth route has no id in its request at all, so bothOrgsInWorkspace
    // cannot be its guard: what keeps it honest is passing ctx.workspaceId to
    // the candidates function and filtering the second read on it too. This
    // is the test that would catch somebody "simplifying" either away.
    //
    // A shared domain is the strongest rule the candidates function has
    // (score 1.0, reason 'same domain'), so each pair is certain to be
    // proposed inside its own workspace. There is no unique constraint on
    // organisation.domain, so two rows may share one.
    const mineA = await org(wsA, 'Dup Mine One BV', { domain: 'dup-mine.example' });
    const mineB = await org(wsA, 'Dup Mine Two BV', { domain: 'dup-mine.example' });
    const theirsA = await org(wsB, 'Dup Theirs One BV', { domain: 'dup-theirs.example' });
    const theirsB = await org(wsB, 'Dup Theirs Two BV', { domain: 'dup-theirs.example' });

    const r = await call(adminA, 'GET', '/duplicates');
    expect(r.status).toBe(200);
    const body = await r.text();
    const { items } = JSON.parse(body) as {
      items: { reason: string; a: { id: string }; b: { id: string } }[];
    };

    // Asserted by naming what SHOULD be there first: an empty list would
    // satisfy "B's ids are absent" and prove nothing at all.
    const ids = items.flatMap((i) => [i.a.id, i.b.id]);
    expect(ids).toContain(mineA);
    expect(ids).toContain(mineB);
    const mine = items.find(
      (i) => (i.a.id === mineA && i.b.id === mineB) || (i.a.id === mineB && i.b.id === mineA),
    );
    expect(mine).toBeDefined();
    expect(mine!.reason).toBe('same domain');

    // And B's pair is nowhere — not in the ids, and not in the raw body
    // either, which also catches a name or domain leaking through a field
    // somebody adds to the payload later.
    expect(ids).not.toContain(theirsA);
    expect(ids).not.toContain(theirsB);
    expect(body).not.toContain('dup-theirs.example');
    expect(body).not.toContain('Dup Theirs');
  });
});

describe('POST /organisations/duplicates/distinct', () => {
  it('refuses a pair of another workspace, and writes nothing', async () => {
    const a = await org(wsB, 'Distinct Theirs One BV', { domain: 'distinct-theirs.example' });
    const b = await org(wsB, 'Distinct Theirs Two BV', { domain: 'distinct-theirs.example' });

    const r = await call(adminA, 'POST', '/duplicates/distinct', { a_id: a, b_id: b });
    expect(r.status).toBe(404);

    // Nothing planted, in EITHER workspace: the row's workspace_id comes from
    // the caller, so a missing guard would leave A holding a dismissal that
    // names two of B's organisations.
    const { count } = await service
      .from('organisation_distinct')
      .select('a_id', { count: 'exact', head: true })
      .in('workspace_id', [wsA, wsB]);
    expect(count).toBe(0);
  });

  it('refuses a pair that straddles the two workspaces', async () => {
    const mine = await org(wsA, 'Distinct Straddle A BV');
    const theirs = await org(wsB, 'Distinct Straddle B BV');
    const r = await call(adminA, 'POST', '/duplicates/distinct', { a_id: mine, b_id: theirs });
    expect(r.status).toBe(404);
    const { count } = await service
      .from('organisation_distinct')
      .select('a_id', { count: 'exact', head: true })
      .in('workspace_id', [wsA, wsB]);
    expect(count).toBe(0);
  });

  it('remembers the answer, and the pair stops being proposed', async () => {
    const one = await org(wsA, 'Distinct Mine One BV', { domain: 'distinct-mine.example' });
    const two = await org(wsA, 'Distinct Mine Two BV', { domain: 'distinct-mine.example' });

    // Proposed first — otherwise "no longer proposed" proves nothing, which
    // is exactly how a vacuous version of this test would read.
    const before = await call(adminA, 'GET', '/duplicates');
    expect(before.status).toBe(200);
    const pairKey = (i: { a: { id: string }; b: { id: string } }) =>
      [i.a.id, i.b.id].sort().join('|');
    const want = [one, two].sort().join('|');
    const { items: proposed } = (await before.json()) as {
      items: { a: { id: string }; b: { id: string } }[];
    };
    expect(proposed.map(pairKey)).toContain(want);

    const r = await call(adminA, 'POST', '/duplicates/distinct', { a_id: two, b_id: one });
    expect(r.status).toBe(200);

    // Stored in the order the table's CHECK requires, whichever way round it
    // was sent — and it was sent the other way round on purpose.
    const [lo, hi] = [one, two].sort();
    const { data: row } = await service
      .from('organisation_distinct')
      .select('a_id, b_id')
      .eq('workspace_id', wsA)
      .eq('a_id', lo)
      .eq('b_id', hi)
      .maybeSingle();
    expect(row).not.toBeNull();

    const after = await call(adminA, 'GET', '/duplicates');
    const { items: still } = (await after.json()) as {
      items: { a: { id: string }; b: { id: string } }[];
    };
    expect(still.map(pairKey)).not.toContain(want);

    // Saying it twice is not an error — the queue is a page somebody may
    // double-click.
    const again = await call(adminA, 'POST', '/duplicates/distinct', { a_id: one, b_id: two });
    expect(again.status).toBe(200);
  });
});

describe('the admin gate', () => {
  it('refuses an organiser of the caller’s own workspace on all six routes', async () => {
    // Not a tenancy question but the same routes' other gate: an organiser
    // may not merge even inside their own workspace, because a merge rewrites
    // memberships, billing and a verified domain.
    const organiser = await createFixtureUser(wsA, 'orgmerge-tenancy-organiser');
    try {
      const { error } = await service
        .from('workspace_member')
        .upsert({ workspace_id: wsA, user_id: organiser.userId, workspace_role: 'organiser' });
      if (error) throw new Error(`workspace_member fixture: ${error.message}`);

      const keep = await org(wsA, 'Gate Keep BV', { city: 'Breda' });
      const lose = await org(wsA, 'Gate Lose BV', { city: 'Tilburg' });

      // A real merge of A's own pair, so the undo case has a live id to be
      // refused for a reason that is the GATE and not a missing row.
      const made = await call(adminA, 'POST', '/merge', { keep_id: keep, merge_id: lose });
      expect(made.status).toBe(201);
      const { merge_id } = (await made.json()) as { merge_id: string };

      expect((await call(organiser, 'GET', '/duplicates')).status).toBe(403);
      expect(
        (await call(organiser, 'GET', `/merge-conflicts?keep=${keep}&merge=${lose}`)).status,
      ).toBe(403);
      expect((await call(organiser, 'GET', '/merges')).status).toBe(403);
      const distinct = await call(organiser, 'POST', '/duplicates/distinct', {
        a_id: keep,
        b_id: lose,
      });
      expect(distinct.status).toBe(403);
      // Refused, not merely answered: no dismissal was written.
      const { count: planted } = await service
        .from('organisation_distinct')
        .select('a_id', { count: 'exact', head: true })
        .eq('workspace_id', wsA)
        .in('a_id', [keep, lose]);
      expect(planted).toBe(0);

      const undo = await call(organiser, 'POST', `/merges/${merge_id}/undo`);
      expect(undo.status).toBe(403);
      // Refused, not merely answered: still merged.
      expect(await deletedAt(lose)).not.toBeNull();

      // And a fresh pair for the merge gate, since the first is now merged.
      const k2 = await org(wsA, 'Gate Keep Two BV');
      const l2 = await org(wsA, 'Gate Lose Two BV');
      const merge = await call(organiser, 'POST', '/merge', { keep_id: k2, merge_id: l2 });
      expect(merge.status).toBe(403);
      expect(await deletedAt(l2)).toBeNull();

      // Put A's own merge back, so this test leaves nothing merged behind.
      expect((await call(adminA, 'POST', `/merges/${merge_id}/undo`)).status).toBe(200);
    } finally {
      await deleteFixtureUser(organiser);
    }
  }, 120_000);
});
