// The contact profile's reads, driven as a real session.
//
// On 2026-10-01 every read on these routes that used to coalesce a failure
// into "none" (`data ?? []`) was made to throw instead: contact points,
// organisations, the per-app tabs, Meet bookings, the duplicate-review cards.
// That is the right rule (testing-approach §1.9) and it has one risk — a read
// that was ALREADY failing quietly for an ordinary session now takes the
// whole profile down with a 500 instead of hiding one tab.
//
// So this walks each route with a minted staging session, the routes running
// in process behind the real appContext (the harness of
// persons-merge-tenancy.int.test.ts). A service-role probe had already shown
// every select parses on both stacks; what only a session can show is that
// `authenticated` may run them. Throwaway workspace, rows cleaned by id.

import { randomUUID } from 'node:crypto';
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
let ws: string;
let admin: FixtureUser;
let personId: string;
const email = `int-reads-${randomUUID().slice(0, 8)}@example.com`;

async function call(method: string, path: string, body?: unknown) {
  return app.request(`/api/v1/persons${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${admin.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { personsRoutes } = await import('../routes/persons.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/persons', personsRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('persons-reads');
  admin = await createFixtureUser(ws, 'persons-reads-admin');
  const { error: mErr } = await service
    .from('workspace_member')
    .upsert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  if (mErr) throw new Error(`workspace_member fixture: ${mErr.message}`);

  const { data, error } = await service
    .from('person')
    // Linked to the admin's own account, so the profile's seat and
    // app-membership reads (which only run for a person WITH an account)
    // are exercised too.
    .insert({ workspace_id: ws, first_name: 'Reads', last_name: 'Fixture', email, user_id: admin.userId })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  personId = data!.id as string;
});

afterAll(async () => {
  if (personId) {
    await service.from('person_contact_point').delete().eq('person_id', personId);
    await service.from('person').delete().eq('id', personId);
  }
  if (admin) await deleteFixtureUser(admin);
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('the contact profile reads, as a session', () => {
  it('GET /:id answers with the person and their contact points', async () => {
    const r = await call('GET', `/${personId}`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { id: string; contact_points: { kind: string; value: string }[] };
    expect(body.id).toBe(personId);
    // The primary email is mirrored into the points table by trigger; an
    // empty list here would be the silent failure this file is about.
    expect(body.contact_points.map((p) => p.value)).toContain(email);
  });

  it('PUT /:id/contact-points adds, and REMOVES what is no longer in the list', async () => {
    const second = `int-reads-second-${randomUUID().slice(0, 8)}@example.com`;
    const add = await call('PUT', `/${personId}/contact-points`, {
      items: [
        { kind: 'email', value: email, is_primary: true },
        { kind: 'email', value: second, label: 'private' },
      ],
    });
    expect(add.status).toBe(200);
    const added = (await add.json()) as { items: { value: string }[] };
    expect(added.items.map((p) => p.value).sort()).toEqual([email, second].sort());

    // The removal is decided by a read of what exists. That read failing used
    // to mean "nothing to remove" and a 200.
    const remove = await call('PUT', `/${personId}/contact-points`, {
      items: [{ kind: 'email', value: email, is_primary: true }],
    });
    expect(remove.status).toBe(200);
    const left = (await remove.json()) as { items: { value: string }[] };
    expect(left.items.map((p) => p.value)).toEqual([email]);

    const { data, error } = await service.from('person_contact_point').select('value').eq('person_id', personId);
    expect(error).toBeNull();
    expect((data ?? []).map((p) => p.value)).toEqual([email]);
  });

  it('GET /:id/memberships answers, including the seat of a person who has an account', async () => {
    const r = await call('GET', `/${personId}/memberships`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      org_memberships: unknown[];
      workspace_member: { workspace_id: string; workspace_role: string } | null;
      app_memberships: unknown[];
      has_account: boolean;
    };
    expect(body.org_memberships).toEqual([]);
    expect(body.has_account).toBe(true);
    expect(body.workspace_member?.workspace_id).toBe(ws);
    expect(body.workspace_member?.workspace_role).toBe('admin');
    expect(Array.isArray(body.app_memberships)).toBe(true);
  });

  it('GET /:id/apps answers with a list — all nine reads behind it ran', async () => {
    const r = await call('GET', `/${personId}/apps`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { apps: string[] };
    expect(Array.isArray(body.apps)).toBe(true);
  });

  it('GET /:id/meet answers with two real empty lists', async () => {
    const r = await call('GET', `/${personId}/meet`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { profile: unknown; upcoming_bookings: unknown[]; past_bookings: unknown[] };
    expect(body.profile).toBeNull();
    expect(body.upcoming_bookings).toEqual([]);
    expect(body.past_bookings).toEqual([]);
  });

  it('GET /duplicates answers for an admin', async () => {
    const r = await call('GET', '/duplicates');
    expect(r.status).toBe(200);
    const body = (await r.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });
});
