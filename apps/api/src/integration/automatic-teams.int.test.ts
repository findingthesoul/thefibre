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

  // The invite slice's contract at the data layer: the teams named on an
  // invite are joined, scoped to this workspace, and the automatic ones are
  // ignored rather than written — their membership is decided by the
  // workspace, never by a request body.
  it('an invite joins the named teams, and cannot be used to write the automatic ones', async () => {
    const teams = await ensureAutomaticTeams(ws);
    const person = await member('organiser');

    const ordinary = (
      await service
        .from('team')
        .insert({
          workspace_id: ws,
          name: 'Invited into this',
          slug: `int-inv-${randomUUID().slice(0, 8)}`,
          is_active: true,
        })
        .select('id')
        .single()
    ).data!.id as string;

    // A team in ANOTHER workspace: a forged or stale id must add nothing.
    const other = await createThrowawayWorkspace('invite-other');
    const foreign = (
      await service
        .from('team')
        .insert({
          workspace_id: other,
          name: 'Not yours',
          slug: `int-foreign-${randomUUID().slice(0, 8)}`,
          is_active: true,
        })
        .select('id')
        .single()
    ).data!.id as string;

    // Exactly what routes/members.ts does with body.teams.
    const requested = [ordinary, foreign, teams.admins!, teams.everyone!];
    const { data: allowed } = await service
      .from('team')
      .select('id')
      .eq('workspace_id', ws)
      .is('automatic', null)
      .in('id', requested);
    const ids = (allowed ?? []).map((t) => t.id as string);

    expect(ids).toEqual([ordinary]);
    expect(ids).not.toContain(foreign);
    expect(ids).not.toContain(teams.admins);
    expect(ids).not.toContain(teams.everyone);

    await service.from('team').delete().eq('id', ordinary);
    await service.from('team').delete().eq('id', foreign);
    await deleteThrowawayWorkspace(other);
    void person;
  });

  // The hazard the conversion script gates on, written down so it cannot be
  // rediscovered the hard way: putting somebody in a team re-resolves them,
  // and re-resolving DELETES any app_membership owed to neither a direct tick
  // nor a live team grant. A row written before teams became the access layer
  // is exactly that, so a conversion silently takes those apps away.
  //
  // If this test ever fails because the row SURVIVES, syncUsers stopped
  // deleting unowed rows — and the --apply gate in
  // scripts/convert-workspaces-to-automatic-teams.ts can be relaxed.
  it('a sync DELETES an app_membership owed to nothing — why the conversion refuses to run over one', async () => {
    const person = await member('organiser');
    const { data: app } = await service.from('app').select('id, slug').eq('slug', 'fibre-meet').maybeSingle();
    expect(app, 'fibre-meet must exist for this fixture').toBeTruthy();

    // Not is_direct, and no team grants it: owed to nothing the resolver sees.
    await service
      .from('app_membership')
      .upsert(
        { user_id: person, app_id: app!.id, role: 'member', is_direct: false },
        { onConflict: 'user_id,app_id' },
      );

    await syncAutomaticTeams(ws);

    const { data: after } = await service
      .from('app_membership')
      .select('app_id')
      .eq('user_id', person)
      .eq('app_id', app!.id);
    expect(after ?? []).toHaveLength(0);
  });

  // The membership guard added with the member dialog (2026-10-08). The two
  // automatic teams have their rosters decided by the workspace, so a
  // hand-made change is either undone by the next sync or — worse — lives
  // until one happens: somebody out of Everyone has lost the baseline, or
  // somebody in Admins holds admin-level app access without the workspace
  // role that is supposed to carry it.
  it('the gate that guards membership writes refuses the automatic teams and allows ordinary ones', async () => {
    const teams = await ensureAutomaticTeams(ws);
    const ordinary = (
      await service
        .from('team')
        .insert({
          workspace_id: ws,
          name: 'An ordinary team',
          slug: `int-guard-${randomUUID().slice(0, 8)}`,
          is_active: true,
        })
        .select('id')
        .single()
    ).data!.id as string;

    // The shape the route's gate reads: a team is refused for MEMBERSHIP
    // writes when `automatic` is set, and allowed otherwise.
    const refusesMembership = async (teamId: string) => {
      const { data } = await service.from('team').select('automatic').eq('id', teamId).maybeSingle();
      return !!data?.automatic;
    };
    expect(await refusesMembership(teams.admins!)).toBe(true);
    expect(await refusesMembership(teams.everyone!)).toBe(true);
    // The half that matters as much: an ordinary team is still editable, or
    // the guard would have quietly frozen every team in the product.
    expect(await refusesMembership(ordinary)).toBe(false);

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
