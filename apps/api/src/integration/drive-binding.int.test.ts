// A Drive folder belongs to ONE community (Drive folders, slice 1,
// 2026-10-17). One service account per stack reads every community's shared
// folders, so the binding — who proved control of which folder — is what
// keeps community A from connecting community B's folder. Against staging.
//
// Pinned:
//   · a folder bound to one workspace cannot be bound to another (23505);
//   · the id must look like a Drive id;
//   · a user who verified one can be hard-deleted (verified_by emptied);
//   · a workspace that has a binding can be hard-deleted, and it goes;
//   · an AUTHENTICATED Members member reads its own workspace's binding and
//     not another's, and cannot write one.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { anonKey, createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, url, type FixtureUser } from './staging.js';

let a = '';
let b = '';
let member: FixtureUser | undefined;
const folder = () => `fixFolder_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
const bind = (ws: string, id: string, by: string | null = null) =>
  service.from('membership_drive_binding').insert({ drive_folder_id: id, workspace_id: ws, verified_by: by });

beforeAll(async () => {
  a = await createThrowawayWorkspace('drive-bind-a');
  b = await createThrowawayWorkspace('drive-bind-b');
  member = await createFixtureUser(a, 'drive-bind-member');
  const app = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  await service.from('workspace_member').insert({ workspace_id: a, user_id: member.userId, workspace_role: 'admin' });
  await service.from('workspace_app').upsert({ workspace_id: a, app_id: app }, { onConflict: 'workspace_id,app_id' });
  await service.from('app_membership').upsert({ user_id: member.userId, app_id: app, role: 'admin' }, { onConflict: 'user_id,app_id' });
}, 120_000);

afterAll(async () => {
  if (member) {
    await service.from('app_membership').delete().eq('user_id', member.userId);
    await service.from('workspace_member').delete().eq('user_id', member.userId);
    await deleteFixtureUser(member);
  }
  if (a) expect(await deleteThrowawayWorkspace(a)).toBe(true);
  if (b) expect(await deleteThrowawayWorkspace(b)).toBe(true);
}, 120_000);

describe('one folder, one community', () => {
  it('a folder bound to A cannot be bound to B', async () => {
    const f = folder();
    expect((await bind(a, f)).error).toBeNull();
    expect((await bind(b, f)).error?.code).toBe('23505');
  });

  it('the id must look like a Drive id', async () => {
    expect((await bind(a, 'short')).error?.code).toBe('23514');
    expect((await bind(a, 'has spaces in it at all')).error?.code).toBe('23514');
  });
});

describe('deleting', () => {
  it('a user who verified a binding is hard-deleted; the binding stays, verified_by emptied', async () => {
    const u = await createFixtureUser(a, 'drive-bind-verifier');
    const f = folder();
    expect((await bind(a, f, u.userId)).error).toBeNull();
    await deleteFixtureUser(u);
    expect((await service.from('user').select('id').eq('id', u.userId)).data).toEqual([]);
    const { data } = await service.from('membership_drive_binding').select('verified_by').eq('drive_folder_id', f).single();
    expect(data).toEqual({ verified_by: null });
  });

  it('a workspace with a binding is hard-deleted, and the binding goes with it', async () => {
    const doomed = await createThrowawayWorkspace('drive-bind-doomed');
    const f = folder();
    expect((await bind(doomed, f)).error).toBeNull();
    expect(await deleteThrowawayWorkspace(doomed)).toBe(true);
    expect((await service.from('membership_drive_binding').select('drive_folder_id').eq('drive_folder_id', f)).data).toEqual([]);
  });
});

describe('who reads it', () => {
  it('an authenticated Members member of A reads A’s bindings, not B’s, and cannot write', async () => {
    const fa = folder();
    const fb = folder();
    await bind(a, fa);
    await bind(b, fb);
    const db = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${member!.accessToken}` } } });
    const { data, error } = await db.from('membership_drive_binding').select('drive_folder_id, workspace_id');
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.drive_folder_id);
    expect(ids).toContain(fa);
    expect(ids).not.toContain(fb);
    const w = await db.from('membership_drive_binding').insert({ drive_folder_id: folder(), workspace_id: a });
    expect(w.error).not.toBeNull();
  });
});
