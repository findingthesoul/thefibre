// Merging two people, attacked from another workspace.
//
// Found 2026-09-25 by the stress round's review of 20260925053333: POST
// /persons/merge and POST /persons/merges/:id/undo checked that the CALLER
// was an admin of their own workspace and then handed the body's UUIDs to
// merge_person / unmerge_person as the service role. merge_person only
// asserts the two persons share *a* workspace — not the caller's — so an
// admin of workspace A could merge (and, since the fill migration, copy the
// personal data between) any two persons of workspace B by id, and put back
// any of B's merges. /duplicates/distinct had the check; these two did not.
//
// Same harness as thread-tenancy.int.test.ts: the routes run IN PROCESS
// behind the real appContext middleware with real minted sessions, so the
// JWT, the hook-stamped claims and the route code are the production ones.
// Both halves are asserted — the refusal AND that the legitimate admin can
// still merge and undo inside their own workspace. Staging only, throwaway
// workspaces, every row cleaned by its own id.

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
const people: string[] = [];

async function call(user: FixtureUser, method: string, path: string, body?: unknown) {
  return app.request(`/api/v1/persons${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function person(ws: string, first: string) {
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: first, last_name: 'Tenancy', email: null })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  people.push(data!.id as string);
  return data!.id as string;
}

async function deletedAt(id: string): Promise<string | null> {
  const { data, error } = await service.from('person').select('deleted_at').eq('id', id).single();
  if (error) throw new Error(`person read: ${error.message}`);
  return (data!.deleted_at as string | null) ?? null;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { personsRoutes } = await import('../routes/persons.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/persons', personsRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('merge-tenancy-a');
  wsB = await createThrowawayWorkspace('merge-tenancy-b');
  adminA = await createFixtureUser(wsA, 'merge-tenancy-admin-a');
  const { error } = await service
    .from('workspace_member')
    .upsert({ workspace_id: wsA, user_id: adminA.userId, workspace_role: 'admin' });
  if (error) throw new Error(`workspace_member fixture: ${error.message}`);
});

afterAll(async () => {
  if (people.length) {
    await service.from('activity').delete().in('person_id', people);
    await service.from('person_merge').delete().in('workspace_id', [wsA, wsB]);
    await service.from('hygiene_finding').delete().in('workspace_id', [wsA, wsB]);
    await service.from('person').delete().in('id', people);
  }
  if (adminA) await deleteFixtureUser(adminA);
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
});

describe('POST /persons/merge across workspaces', () => {
  it("refuses two persons of another workspace, and leaves them untouched", async () => {
    const keep = await person(wsB, 'Victim-keep');
    const lose = await person(wsB, 'Victim-lose');

    const r = await call(adminA, 'POST', '/merge', { keep_id: keep, merge_id: lose });
    expect(r.status).toBe(404);

    // The RPC never ran: nobody was soft-deleted and no audit row exists.
    expect(await deletedAt(lose)).toBeNull();
    const { count } = await service
      .from('person_merge')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsB);
    expect(count).toBe(0);
  });

  it('refuses a pair that straddles the two workspaces', async () => {
    const mine = await person(wsA, 'Straddle-a');
    const theirs = await person(wsB, 'Straddle-b');
    const r = await call(adminA, 'POST', '/merge', { keep_id: mine, merge_id: theirs });
    expect(r.status).toBe(404);
    expect(await deletedAt(theirs)).toBeNull();
  });

  it('still merges, and undoes, inside the admin’s own workspace', async () => {
    const keep = await person(wsA, 'Own-keep');
    const lose = await person(wsA, 'Own-lose');

    const merged = await call(adminA, 'POST', '/merge', { keep_id: keep, merge_id: lose });
    expect(merged.status).toBe(201);
    const { merge_id } = (await merged.json()) as { merge_id: string };
    expect(merge_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await deletedAt(lose)).not.toBeNull();

    const undone = await call(adminA, 'POST', `/merges/${merge_id}/undo`);
    expect(undone.status).toBe(200);
    expect(await deletedAt(lose)).toBeNull();
  });
});

describe('POST /persons/merges/:id/undo across workspaces', () => {
  it("refuses to put back another workspace's merge", async () => {
    const keep = await person(wsB, 'Undo-keep');
    const lose = await person(wsB, 'Undo-lose');
    // B's merge, made the way B's own admin would (service role stands in).
    const { data: mergeId, error } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: lose,
      p_actor: null,
    });
    if (error) throw new Error(`merge_person fixture: ${error.message}`);
    expect(await deletedAt(lose)).not.toBeNull();

    const r = await call(adminA, 'POST', `/merges/${mergeId as string}/undo`);
    expect(r.status).toBe(404);
    // Still merged: the RPC did not run.
    expect(await deletedAt(lose)).not.toBeNull();
  });
});
