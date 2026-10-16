// role_change and HARD DELETES — the case that broke v1 (2026-10-16: the
// logging triggers wrote a row pointing at a user being deleted, and every
// user hard-delete on staging failed with 23503 until the triggers were
// dropped). Against staging; run before anything else that touches roles.
//
//   · a user with a membership and an app grant, who is also the ACTOR on
//     another member's change, hard-deletes cleanly: nothing new is written
//     about them, the rows about them keep existing with subject NULL, and
//     the row they made keeps existing with changed_by NULL (the referential
//     SET NULL gets past the append-only guard);
//   · a whole workspace with members, grants and history hard-deletes
//     cleanly, its history going with it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

const tag = randomUUID().slice(0, 6);
let ws = '';
let appId = '';

const newUser = async (workspace: string, name: string) =>
  (await service.from('user').insert({ workspace_id: workspace, email: `rcd-${name}-${tag}@example.com` }).select('id').single()).data!.id as string;

beforeAll(async () => {
  ws = await createThrowawayWorkspace('rcdel');
  appId = (await service.from('app').select('id').eq('slug', 'fibre-flow').single()).data!.id as string;
}, 120_000);

afterAll(async () => {
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('a hard-deleted user', () => {
  it('who is a subject AND an actor goes cleanly; the history stays with its pointers nulled; nothing new is written', async () => {
    const gone = await newUser(ws, 'gone');
    const other = await newUser(ws, 'other');
    expect((await service.from('workspace_member').insert({ workspace_id: ws, user_id: gone, workspace_role: 'organiser' })).error).toBeNull();
    expect((await service.from('app_membership').insert({ user_id: gone, app_id: appId, role: 'member' })).error).toBeNull();
    expect((await service.from('workspace_member').insert({ workspace_id: ws, user_id: other, workspace_role: 'organiser' })).error).toBeNull();
    // `gone` acts on `other`.
    const acted = await service.rpc('member_role_write', {
      p_workspace: ws, p_user: other, p_role: 'admin', p_relationship: null,
      p_set_member_status: false, p_member_status: null, p_actor: gone, p_source: 'members',
    });
    expect(acted.error).toBeNull();

    const aboutGone = ((await service.from('role_change').select('id').eq('subject_user_id', gone)).data ?? []).map((r) => r.id as string);
    const byGone = ((await service.from('role_change').select('id').eq('changed_by', gone)).data ?? []).map((r) => r.id as string);
    expect(aboutGone).toHaveLength(2); // member_added + app_role
    expect(byGone).toHaveLength(1); // other: organiser → admin
    const total = async () => (await service.from('role_change').select('id', { count: 'exact', head: true }).eq('workspace_id', ws)).count ?? 0;
    const before = await total();

    const del = await service.from('user').delete().eq('id', gone);
    expect(del.error).toBeNull();

    expect(await total()).toBe(before);
    const kept = (await service.from('role_change').select('id, subject_user_id, changed_by').in('id', [...aboutGone, ...byGone])).data ?? [];
    expect(kept).toHaveLength(3);
    for (const r of kept.filter((k) => aboutGone.includes(k.id as string))) expect(r.subject_user_id).toBeNull();
    for (const r of kept.filter((k) => byGone.includes(k.id as string))) expect(r.changed_by).toBeNull();
  });
});

describe('a hard-deleted workspace', () => {
  it('with members, grants and history deletes cleanly, its history with it', async () => {
    const ws2 = await createThrowawayWorkspace('rcdel2');
    const a = await newUser(ws2, 'a');
    const b = await newUser(ws2, 'b');
    expect((await service.from('workspace_member').insert({ workspace_id: ws2, user_id: a, workspace_role: 'organiser' })).error).toBeNull();
    expect((await service.from('workspace_member').insert({ workspace_id: ws2, user_id: b, workspace_role: 'admin' })).error).toBeNull();
    expect((await service.from('app_membership').insert({ user_id: a, app_id: appId, role: 'member' })).error).toBeNull();
    await service.from('workspace_member').update({ workspace_role: 'admin' }).eq('workspace_id', ws2).eq('user_id', a);
    const rows = (await service.from('role_change').select('id', { count: 'exact', head: true }).eq('workspace_id', ws2)).count ?? 0;
    expect(rows).toBeGreaterThanOrEqual(4);

    expect(await deleteThrowawayWorkspace(ws2)).toBe(true);
    expect((await service.from('workspace').select('id').eq('id', ws2).maybeSingle()).data).toBeNull();
    expect((await service.from('role_change').select('id', { count: 'exact', head: true }).eq('workspace_id', ws2)).count).toBe(0);
  });
});
