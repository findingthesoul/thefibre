// role_change — every role change is recorded, by the database itself, and
// named when it came through the API's attributed writes. Against staging.
//
// The promises (migration 20261016111516):
//   · a raw write (service role, no RPC) is still recorded — 'unattributed';
//   · the same value written again records nothing;
//   · the RPCs record who and why: member_add, member_role_write,
//     app_role_set, member_remove;
//   · role_change is append-only: no update, no delete;
//   · a whole workspace can still be deleted (its history goes with it).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let ws = '';
let actor = '';
let subject = '';
let appId = '';
const tag = randomUUID().slice(0, 6);

const rowsFor = async () =>
  ((await service
    .from('role_change')
    .select('kind, old_value, new_value, changed_by, source, app_id')
    .eq('subject_user_id', subject)
    .order('created_at', { ascending: true })).data ?? []) as {
    kind: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string | null;
    source: string;
    app_id: string | null;
  }[];

beforeAll(async () => {
  ws = await createThrowawayWorkspace('rolechg');
  actor = (await service.from('user').insert({ workspace_id: ws, email: `rc-actor-${tag}@example.com` }).select('id').single()).data!.id as string;
  subject = (await service.from('user').insert({ workspace_id: ws, email: `rc-subject-${tag}@example.com` }).select('id').single()).data!.id as string;
  appId = (await service.from('app').select('id').eq('slug', 'fibre-flow').single()).data!.id as string;
}, 120_000);

afterAll(async () => {
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('the floor: raw writes are recorded, unattributed', () => {
  it('added, role changed, relationship changed — one row each, nothing for an unchanged value', async () => {
    expect((await service.from('workspace_member').insert({ workspace_id: ws, user_id: subject, workspace_role: 'organiser' })).error).toBeNull();
    await service.from('workspace_member').update({ workspace_role: 'admin' }).eq('workspace_id', ws).eq('user_id', subject);
    await service.from('workspace_member').update({ relationship_type: 'external' }).eq('workspace_id', ws).eq('user_id', subject);
    await service.from('workspace_member').update({ workspace_role: 'admin' }).eq('workspace_id', ws).eq('user_id', subject);
    expect(await rowsFor()).toEqual([
      { kind: 'member_added', old_value: null, new_value: 'organiser', changed_by: null, source: 'unattributed', app_id: null },
      { kind: 'workspace_role', old_value: 'organiser', new_value: 'admin', changed_by: null, source: 'unattributed', app_id: null },
      { kind: 'relationship', old_value: 'internal', new_value: 'external', changed_by: null, source: 'unattributed', app_id: null },
    ]);
  });

  it('an app role given raw is recorded too', async () => {
    expect((await service.from('app_membership').insert({ user_id: subject, app_id: appId, role: 'member' })).error).toBeNull();
    const last = (await rowsFor()).at(-1);
    expect(last).toEqual({ kind: 'app_role', old_value: null, new_value: 'member', changed_by: null, source: 'unattributed', app_id: appId });
  });
});

describe('the RPCs name who did it', () => {
  it('member_role_write: a role change attributed to the actor, with its source', async () => {
    const r = await service.rpc('member_role_write', {
      p_workspace: ws, p_user: subject, p_role: 'organiser', p_relationship: null,
      p_set_member_status: false, p_member_status: null, p_actor: actor, p_source: 'members',
    });
    expect(r.error).toBeNull();
    expect(r.data).toBe(1);
    expect((await rowsFor()).at(-1)).toEqual({ kind: 'workspace_role', old_value: 'admin', new_value: 'organiser', changed_by: actor, source: 'members', app_id: null });
  });

  it('app_role_set: attributed', async () => {
    const r = await service.rpc('app_role_set', { p_user: subject, p_app: appId, p_role: 'admin', p_is_direct: true, p_actor: actor, p_source: 'members' });
    expect(r.error).toBeNull();
    expect((await rowsFor()).at(-1)).toMatchObject({ kind: 'app_role', old_value: 'member', new_value: 'admin', changed_by: actor, source: 'members' });
  });

  it('member_remove: the membership and the app grant, both attributed', async () => {
    const before = (await rowsFor()).length;
    const r = await service.rpc('member_remove', { p_workspace: ws, p_user: subject, p_actor: actor, p_source: 'members' });
    expect(r.error).toBeNull();
    const added = (await rowsFor()).slice(before);
    expect(added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'member_removed', old_value: 'organiser', changed_by: actor, source: 'members' }),
        expect.objectContaining({ kind: 'app_role', old_value: 'admin', new_value: null, changed_by: actor, source: 'members' }),
      ]),
    );
    expect(added).toHaveLength(2);
  });

  it('member_add: attributed; added again without upsert changes and records nothing', async () => {
    const a = await service.rpc('member_add', { p_workspace: ws, p_user: subject, p_role: 'organiser', p_relationship: 'internal', p_upsert: false, p_actor: actor, p_source: 'invite' });
    expect(a.error).toBeNull();
    expect(a.data).toBe(true);
    expect((await rowsFor()).at(-1)).toMatchObject({ kind: 'member_added', new_value: 'organiser', changed_by: actor, source: 'invite' });
    const before = (await rowsFor()).length;
    const b = await service.rpc('member_add', { p_workspace: ws, p_user: subject, p_role: 'admin', p_relationship: 'internal', p_upsert: false, p_actor: actor, p_source: 'invite' });
    expect(b.data).toBe(false);
    expect((await rowsFor()).length).toBe(before);
  });
});

describe('append-only', () => {
  it('an update and a delete are refused', async () => {
    const { data } = await service.from('role_change').select('id').eq('subject_user_id', subject).limit(1).single();
    const u = await service.from('role_change').update({ source: 'tampered' }).eq('id', data!.id);
    expect(u.error?.message).toMatch(/append-only/);
    const d = await service.from('role_change').delete().eq('id', data!.id);
    expect(d.error?.message).toMatch(/append-only/);
  });
});

// The platform flag (super_admin rows, no workspace) is NOT exercised here:
// with no workspace to cascade from, every run would leave two permanent rows
// on staging. It was checked once by hand after the v2 triggers landed
// (throwaway user rc-sa-c92e5e@example.com, 2026-10-16).

// Hard deletes (a user, a workspace) have their own file,
// role-change-deletes.int.test.ts, run first: they are what broke v1.
