// The routes that change a role now say WHO did it (role_change), and still
// answer exactly as before. In process, against staging, through the real
// routes with a real admin session.
//
//   · Members → PATCH a role: same response; one 'workspace_role' row,
//     changed_by = the admin, source 'members';
//   · Members → PATCH apps: the app role attributed the same way;
//   · Meet → internal team PATCH: same response (the row as it now stands),
//     member_status still saved; attributed, source 'meet-team';
//   · Members → remove: the membership and the grant go, both attributed.
// (Inviting is covered by member-invite-role.int.test.ts against the
// deployed API; the first admin by workspace-first-admin.int.test.ts.)

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
let ws = '';
let admin: FixtureUser;
let target: FixtureUser;

const call = (path: string, method: string, body: unknown, appId = 'fibre-platform') =>
  app.request(`/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${admin.accessToken}`, 'X-App-ID': appId, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const latest = async (kind: string) =>
  (await service
    .from('role_change')
    .select('kind, old_value, new_value, changed_by, source')
    .eq('subject_user_id', target.userId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()).data;

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { membersRoutes } = await import('../routes/members.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/members', membersRoutes);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('rcroutes');
  admin = await createFixtureUser(ws, 'rc-admin');
  target = await createFixtureUser(ws, 'rc-target');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'super_admin', relationship_type: 'internal' }, { onConflict: 'user_id,workspace_id' });
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: target.userId, workspace_role: 'organiser', relationship_type: 'internal' }, { onConflict: 'user_id,workspace_id' });
  for (const slug of ['fibre-platform', 'fibre-meet']) {
    const appId = (await service.from('app').select('id').eq('slug', slug).single()).data!.id as string;
    await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
    await service.from('app_membership').upsert({ user_id: admin.userId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  }
}, 180_000);

afterAll(async () => {
  for (const u of [admin, target]) if (u) await deleteFixtureUser(u);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('Members', () => {
  it('PATCH a role: answered as before, and recorded as the admin’s doing', async () => {
    const r = await call(`/members/${target.userId}`, 'PATCH', { workspace_role: 'admin' });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await service.from('workspace_member').select('workspace_role').eq('workspace_id', ws).eq('user_id', target.userId).single()).data!.workspace_role).toBe('admin');
    expect(await latest('workspace_role')).toEqual({ kind: 'workspace_role', old_value: 'organiser', new_value: 'admin', changed_by: admin.userId, source: 'members' });
  });

  it('PATCH apps: the app role recorded as the admin’s doing', async () => {
    const r = await call(`/members/${target.userId}`, 'PATCH', { apps: [{ slug: 'fibre-meet', role: 'member' }] });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await latest('app_role')).toMatchObject({ new_value: 'member', changed_by: admin.userId, source: 'members' });
  });
});

describe('Meet → internal team', () => {
  it('PATCH: the row as it now stands, member_status saved, recorded as the admin’s doing', async () => {
    const r = await call(`/meet/internal-team/${target.userId}`, 'PATCH', { workspace_role: 'organiser', member_status: 'On leave' }, 'fibre-meet');
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ user_id: target.userId, workspace_id: ws, workspace_role: 'organiser', member_status: 'On leave' });
    expect(await latest('workspace_role')).toEqual({ kind: 'workspace_role', old_value: 'admin', new_value: 'organiser', changed_by: admin.userId, source: 'meet-team' });
  });
});

describe('Members → role history', () => {
  it('an admin reads it, newest first, with who did it by name', async () => {
    const r = await call(`/members/${target.userId}/role-history`, 'GET', undefined);
    expect(r.status, await r.clone().text()).toBe(200);
    const items = ((await r.json()) as { items: { kind: string; changed_by: string | null; source: string; new_value: string | null }[] }).items;
    expect(items[0]).toMatchObject({ kind: 'workspace_role', new_value: 'organiser', source: 'meet-team' });
    expect(items[0]!.changed_by).toBeTruthy();
    expect(items.some((i) => i.kind === 'app_role' && i.source === 'members')).toBe(true);
  });

  it('a non-admin is refused', async () => {
    const r = await app.request(`/api/v1/members/${admin.userId}/role-history`, {
      headers: { Authorization: `Bearer ${target.accessToken}`, 'X-App-ID': 'fibre-platform' },
    });
    expect(r.status).toBe(403);
  });

  it('somebody who is not in this workspace is not found', async () => {
    const r = await call(`/members/00000000-0000-4000-8000-000000000000/role-history`, 'GET', undefined);
    expect(r.status).toBe(404);
  });
});

describe('Members → remove', () => {
  it('the membership and the grant go, both recorded as the admin’s doing', async () => {
    const r = await call(`/members/${target.userId}`, 'DELETE', {});
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect((await service.from('workspace_member').select('user_id').eq('workspace_id', ws).eq('user_id', target.userId)).data).toEqual([]);
    expect(await latest('member_removed')).toMatchObject({ old_value: 'organiser', changed_by: admin.userId, source: 'members' });
    const grantGone = (await service.from('role_change').select('new_value, changed_by, source').eq('subject_user_id', target.userId).eq('kind', 'app_role').is('new_value', null)).data;
    expect(grantGone).toEqual([expect.objectContaining({ changed_by: admin.userId, source: 'members' })]);
  });
});
