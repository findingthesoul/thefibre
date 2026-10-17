// Contact points and the duplicate queue, asked for from another workspace.
//
// F2 (security plan): routes/persons.ts moved from hand-written workspace
// filters onto the tenant accessor. These pin the behaviour the conversion
// must keep: an admin of A cannot write B's person's addresses, cannot attach
// one of B's organisations to their own person, and does not see B's pairs —
// and the legitimate save inside A still works. Same in-process harness as
// persons-merge-tenancy.int.test.ts. Nothing here writes an activity row, so
// the throwaway workspaces stay deletable.

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
let adminA: FixtureUser;
const people: string[] = [];
const orgs: string[] = [];

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

async function person(ws: string, first: string, email: string | null = null) {
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: first, last_name: 'Points', email })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  people.push(data!.id as string);
  return data!.id as string;
}

async function org(ws: string, name: string) {
  const { data, error } = await service
    .from('organisation')
    .insert({ workspace_id: ws, name })
    .select('id')
    .single();
  if (error) throw new Error(`organisation fixture: ${error.message}`);
  orgs.push(data!.id as string);
  return data!.id as string;
}

async function pointsOf(personId: string) {
  const { data, error } = await service
    .from('person_contact_point')
    .select('kind, value, workspace_id, org_id')
    .eq('person_id', personId)
    .order('value');
  if (error) throw new Error(`contact point read: ${error.message}`);
  return data ?? [];
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { personsRoutes } = await import('../routes/persons.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/persons', personsRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('points-tenancy-a');
  wsB = await createThrowawayWorkspace('points-tenancy-b');
  adminA = await createFixtureUser(wsA, 'points-tenancy-admin-a');
  const { error } = await service
    .from('workspace_member')
    .upsert({ workspace_id: wsA, user_id: adminA.userId, workspace_role: 'admin' });
  if (error) throw new Error(`workspace_member fixture: ${error.message}`);
});

afterAll(async () => {
  if (people.length) {
    await service.from('hygiene_finding').delete().in('workspace_id', [wsA, wsB]);
    await service.from('person_contact_point').delete().in('person_id', people);
    await service.from('person').delete().in('id', people);
  }
  if (orgs.length) await service.from('organisation').delete().in('id', orgs);
  if (adminA) await deleteFixtureUser(adminA);
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
});

describe('PUT /persons/:id/contact-points', () => {
  it("refuses another workspace's person, and leaves their addresses alone", async () => {
    const theirs = await person(wsB, 'Victim', 'victim.points@example.org');
    const before = await pointsOf(theirs);

    const r = await call(adminA, 'PUT', `/${theirs}/contact-points`, {
      items: [{ kind: 'email', value: 'planted.points@example.org', is_primary: true }],
    });
    expect(r.status).toBe(404);
    expect(await pointsOf(theirs)).toEqual(before);
  });

  it("refuses to attach another workspace's organisation to an address", async () => {
    const mine = await person(wsA, 'Mine-org');
    const theirOrg = await org(wsB, 'Points Tenancy B Org');

    const r = await call(adminA, 'PUT', `/${mine}/contact-points`, {
      // Only a work address carries an organisation (cleanContactPoints).
      items: [{ kind: 'email', value: 'mine.org@example.org', label: 'work', is_primary: true, org_id: theirOrg }],
    });
    expect(r.status).toBe(400);
    expect(await pointsOf(mine)).toEqual([]);
  });

  it('saves, replaces and removes inside the admin’s own workspace', async () => {
    const mine = await person(wsA, 'Mine', 'first.points@example.org');

    const saved = await call(adminA, 'PUT', `/${mine}/contact-points`, {
      items: [
        { kind: 'email', value: 'first.points@example.org', is_primary: true },
        { kind: 'email', value: 'second.points@example.org', is_primary: false },
      ],
    });
    expect(saved.status).toBe(200);
    let points = await pointsOf(mine);
    expect(points.map((p) => p.value)).toEqual(['first.points@example.org', 'second.points@example.org']);
    expect(points.every((p) => p.workspace_id === wsA)).toBe(true);

    const trimmed = await call(adminA, 'PUT', `/${mine}/contact-points`, {
      items: [{ kind: 'email', value: 'second.points@example.org', is_primary: true }],
    });
    expect(trimmed.status).toBe(200);
    points = await pointsOf(mine);
    expect(points.map((p) => p.value)).toEqual(['second.points@example.org']);

    const { data: row } = await service.from('person').select('email').eq('id', mine).single();
    expect(row!.email).toBe('second.points@example.org');
  });
});

describe('the duplicate queue', () => {
  it("refuses to answer a pair of another workspace's persons", async () => {
    const a = await person(wsB, 'Twin');
    const b = await person(wsB, 'Twin');
    const r = await call(adminA, 'POST', '/duplicates/distinct', { a_id: a, b_id: b });
    expect(r.status).toBe(404);
    const { count } = await service
      .from('hygiene_finding')
      .select('id', { count: 'exact', head: true })
      .in('subject_id', [a, b]);
    expect(count).toBe(0);
  });

  it("never proposes another workspace's persons, and does propose its own", async () => {
    const own = [await person(wsA, 'Doppel'), await person(wsA, 'Doppel')];
    const foreign = [await person(wsB, 'Doppel'), await person(wsB, 'Doppel')];

    const r = await call(adminA, 'GET', '/duplicates?threshold=0.3');
    expect(r.status).toBe(200);
    const { items } = (await r.json()) as { items: { a: { id: string; first_name?: string }; b: { id: string } }[] };
    const seen = new Set(items.flatMap((p) => [p.a.id, p.b.id]));
    expect(foreign.some((id) => seen.has(id))).toBe(false);
    // Non-empty on purpose: an empty queue would pass the line above too.
    expect(own.every((id) => seen.has(id))).toBe(true);
    // The cards carry the person's own fields — the scoped reads returned them.
    const card = items.flatMap((p) => [p.a, p.b]).find((x) => x.id === own[0]);
    expect(card?.first_name).toBe('Doppel');
  });
});
