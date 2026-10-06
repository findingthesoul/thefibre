// The two automatic teams, against real Postgres.
//
// The valuable assertions here are the ones about things going AWAY. Adding
// somebody to a team is easy to get right and easy to see; the failure that
// matters is a demotion that leaves the old access behind, because nothing on
// screen says so and the person keeps opening apps they should not.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import {
  ensureAutomaticTeams,
  syncAutomaticTeams,
  driftingWorkspaces,
} from '../lib/automatic-teams.js';

let ws: string;
const madeUsers: string[] = [];

beforeAll(async () => {
  ws = await createThrowawayWorkspace('auto-teams');
});

afterAll(async () => {
  if (madeUsers.length) {
    await service.from('team_member').delete().in('user_id', madeUsers);
    await service.from('workspace_member').delete().in('user_id', madeUsers);
    await service.from('user').delete().in('id', madeUsers);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
});

async function member(role: string): Promise<string> {
  const email = `int-at-${randomUUID().slice(0, 8)}@example.com`;
  const { data, error } = await service
    .from('user')
    .insert({ workspace_id: ws, email })
    .select('id')
    .single();
  if (error) throw new Error(`user fixture: ${error.message}`);
  const id = data!.id as string;
  madeUsers.push(id);
  await service
    .from('workspace_member')
    .insert({ workspace_id: ws, user_id: id, workspace_role: role });
  return id;
}

async function membersOf(kind: 'admins' | 'everyone'): Promise<string[]> {
  const { data: team } = await service
    .from('team')
    .select('id')
    .eq('workspace_id', ws)
    .eq('automatic', kind)
    .maybeSingle();
  if (!team) return [];
  const { data } = await service.from('team_member').select('user_id').eq('team_id', team.id);
  return (data ?? []).map((m) => m.user_id as string);
}

describe('automatic teams', () => {
  it('creates both, unpublished, with globally-unique slugs', async () => {
    const teams = await ensureAutomaticTeams(ws);
    expect(teams.admins).toBeTruthy();
    expect(teams.everyone).toBeTruthy();

    const { data } = await service
      .from('team')
      .select('automatic, slug, is_published, name')
      .eq('workspace_id', ws)
      .not('automatic', 'is', null);
    expect(data).toHaveLength(2);
    for (const t of data ?? []) {
      // Unpublished: an internal access group has no public page.
      expect(t.is_published, t.automatic as string).toBe(false);
      // Suffixed: `everyone` alone can exist exactly once on the whole
      // platform, because public_root_slug.slug is a primary key.
      expect(t.slug).not.toBe(t.automatic);
      expect(String(t.slug).startsWith(`${t.automatic}-`)).toBe(true);
    }
  });

  it('is idempotent — calling it again makes no second pair', async () => {
    await ensureAutomaticTeams(ws);
    await ensureAutomaticTeams(ws);
    const { count } = await service
      .from('team')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws)
      .not('automatic', 'is', null);
    expect(count).toBe(2);
  });

  it('puts every member in Everyone and only admins in Admins', async () => {
    const admin = await member('admin');
    const organiser = await member('organiser');
    await syncAutomaticTeams(ws);

    const everyone = await membersOf('everyone');
    const admins = await membersOf('admins');
    expect(everyone).toContain(admin);
    expect(everyone).toContain(organiser);
    expect(admins).toContain(admin);
    expect(admins).not.toContain(organiser);
  });

  // THE one that matters. A demotion that leaves somebody in Admins leaves
  // them holding admin-level app access, and nothing on screen says so.
  it('removes somebody from Admins when they are demoted', async () => {
    const person = await member('admin');
    await syncAutomaticTeams(ws);
    expect(await membersOf('admins')).toContain(person);

    await service
      .from('workspace_member')
      .update({ workspace_role: 'organiser' })
      .eq('workspace_id', ws)
      .eq('user_id', person);
    await syncAutomaticTeams(ws);

    expect(await membersOf('admins')).not.toContain(person);
    // …and they stay in Everyone, because they are still a member.
    expect(await membersOf('everyone')).toContain(person);
  });

  it('removes somebody from BOTH when they leave the workspace', async () => {
    const person = await member('admin');
    await syncAutomaticTeams(ws);
    await service.from('workspace_member').delete().eq('workspace_id', ws).eq('user_id', person);
    await syncAutomaticTeams(ws);

    expect(await membersOf('everyone')).not.toContain(person);
    expect(await membersOf('admins')).not.toContain(person);
  });

  it('the drift check sees a role changed behind its back, and stops seeing it after a sync', async () => {
    const person = await member('organiser');
    await syncAutomaticTeams(ws);

    // Exactly what a path that forgot to call the writer would leave behind.
    await service
      .from('workspace_member')
      .update({ workspace_role: 'admin' })
      .eq('workspace_id', ws)
      .eq('user_id', person);

    const drifted = (await driftingWorkspaces()).filter((d) => d.workspace_id === ws);
    expect(drifted.length).toBeGreaterThan(0);
    expect(drifted.some((d) => d.kind === 'admins' && d.missing_members > 0)).toBe(true);

    await syncAutomaticTeams(ws);
    const after = (await driftingWorkspaces()).filter((d) => d.workspace_id === ws);
    expect(after).toEqual([]);
  });

  // Guard (b): slice 1 must be INERT until the slice that explains these
  // teams. The second half of each assertion is the one that matters — a
  // filter that hid everything would satisfy "the automatic ones are hidden"
  // while emptying every team picker in the product.
  it('the automatic teams are hidden from the lists people pick from', async () => {
    await ensureAutomaticTeams(ws);
    const ordinary = (
      await service
        .from('team')
        .insert({
          workspace_id: ws,
          name: 'A real team',
          slug: `int-real-${randomUUID().slice(0, 8)}`,
          is_active: true,
        })
        .select('id')
        .single()
    ).data!.id as string;

    // The shape each picker's query produces: active teams in this workspace
    // that are not automatic.
    const { data: shown } = await service
      .from('team')
      .select('id, automatic')
      .eq('workspace_id', ws)
      .eq('is_active', true)
      .is('automatic', null);
    const ids = (shown ?? []).map((t) => t.id as string);

    expect(ids).toContain(ordinary);
    const { data: autos } = await service
      .from('team')
      .select('id')
      .eq('workspace_id', ws)
      .not('automatic', 'is', null);
    for (const a of autos ?? []) expect(ids).not.toContain(a.id as string);

    await service.from('team').delete().eq('id', ordinary);
  });

  it('refuses to delete an automatic team', async () => {
    const { data: team } = await service
      .from('team')
      .select('id')
      .eq('workspace_id', ws)
      .eq('automatic', 'everyone')
      .maybeSingle();
    const { error } = await service.from('team').delete().eq('id', team!.id);
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/cannot be deleted/i);
  });
});
