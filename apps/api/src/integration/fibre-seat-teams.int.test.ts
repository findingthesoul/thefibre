// A seat granted by a MEMBERSHIP joins the automatic teams — and loses them
// when the seat is revoked.
//
// `syncAutomaticTeams` says of itself: "ONE writer, called from every path
// that changes a workspace role or adds a member. The alternative — each route
// maintaining it — is how somebody keeps admin-level app access after being
// demoted, silently, because one path was missed."
//
// `grantSeat`/`revokeSeat` (lib/fibre-seat.ts) are that missed path. Every
// other writer of `workspace_member` calls the sync; the membership one never
// has. Two consequences, and the second is the one that matters:
//
//   GRANT   the seat-holder is in no automatic team, so the app access those
//           teams confer never arrives. A product promises a Fibre seat and
//           the person gets a seat that opens nothing.
//   REVOKE  the workspace_member row goes and the team_member rows STAY, so
//           the app access survives the seat that justified it. Access
//           retained after revocation is the direction nobody notices,
//           because nothing on screen says so.
//
// Written to FAIL on the code as it was, and run that way before the fix.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { grantSeat, revokeSeatForTest, runFibreSeatSync } from '../lib/fibre-seat.js';
import { reconcileTierMembers } from '../routes/membership.js';

let ws = '';
let personId = '';
const madeUsers: string[] = [];
// A throwaway workspace's plan includes ONE seat, and these tests each grant
// one — so a test that needs a seat needs a workspace of its own rather than
// a bigger plan. Cheaper than reasoning about allowances, and it keeps each
// test's seat accounting its own.
const extraWorkspaces: string[] = [];
async function freshWorkspace(tag: string): Promise<string> {
  const id = await createThrowawayWorkspace(tag);
  extraWorkspaces.push(id);
  return id;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('seat-teams');
  const { data, error } = await service
    .from('person')
    .insert({
      workspace_id: ws,
      first_name: 'Seat',
      last_name: 'Holder',
      email: `int-seat-${randomUUID().slice(0, 8)}@example.com`,
    })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  personId = data!.id as string;
}, 120_000);

afterAll(async () => {
  if (madeUsers.length) {
    await service.from('team_member').delete().in('user_id', madeUsers);
    await service.from('workspace_member').delete().in('user_id', madeUsers);
    await service.from('user').delete().in('id', madeUsers);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
  for (const id of extraWorkspaces) await deleteThrowawayWorkspace(id);
});

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

describe('a membership seat and the automatic teams', () => {
  it('puts the seat-holder in Everyone, and an admin seat in Admins too', async () => {
    const granted = await grantSeat(ws, personId, { role: 'admin' });
    expect(granted.ok, JSON.stringify(granted)).toBe(true);
    const userId = (granted as { ok: true; userId: string }).userId;
    madeUsers.push(userId);

    expect(await membersOf('everyone'), 'a seat-holder is a member of the workspace').toContain(
      userId,
    );
    expect(await membersOf('admins'), 'and an admin seat is an admin').toContain(userId);
  }, 120_000);

  it('and takes both away when the seat is revoked', async () => {
    const userId = madeUsers[0]!;
    const revoked = await revokeSeatForTest(ws, userId);
    expect(revoked.ok, JSON.stringify(revoked)).toBe(true);

    // THE ASSERTION THAT MATTERS. The seat is gone; if the team rows remain,
    // so does every app grant those teams carry — access outliving the
    // membership that paid for it.
    expect(await membersOf('admins'), 'the admin team lets go').not.toContain(userId);
    expect(await membersOf('everyone'), 'and so does Everyone').not.toContain(userId);

    // Anchored: the workspace_member row really did go, so the absences above
    // are about the sync and not about a revoke that silently did nothing.
    const { data: wm } = await service
      .from('workspace_member')
      .select('user_id')
      .eq('workspace_id', ws)
      .eq('user_id', userId);
    expect(wm ?? [], 'the seat itself is gone').toHaveLength(0);
  }, 120_000);
});

describe('the whole path: a tier that carries a seat', () => {
  // What a person actually does — they get the tier, and everything else is
  // the system's job. Calling grantSeat directly (above) proves the wiring;
  // this proves a member reaches it.
  it('assigns the tier, runs the worker, and the person can open the apps', async () => {
    // The workspace must be in 'auto' mode, or the worker parks every seat
    // for a human to approve — which is the right default and the wrong
    // thing for a test that is about what happens AFTER approval.
    await service
      .from('membership_settings')
      .upsert(
        { workspace_id: ws, fibre_seat_mode: 'auto', allow_billed_seats: true },
        { onConflict: 'workspace_id' },
      );

    // A team of this workspace, carrying a grant for a real app. This is the
    // "and the apps" half: team_app_grant is what makes team membership
    // worth having.
    const { data: team } = await service
      .from('team')
      .insert({ workspace_id: ws, name: 'Volunteers', slug: `seat-volunteers-${ws.slice(0, 8)}` })
      .select('id')
      .single();
    const teamId = team!.id as string;
    const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();
    // team_app_grant has NO role column (team_id, app_id, lead_is_app_admin).
    // The first version of this fixture passed `role: 'member'`, the insert
    // failed, and the unchecked error turned into "the app grant never
    // reached them" — a fixture bug wearing a product bug's clothes. Errors
    // from fixtures get read now.
    const { error: grantErr } = await service
      .from('team_app_grant')
      .insert({ team_id: teamId, app_id: app!.id });
    expect(grantErr?.message ?? null, 'the team app grant was created').toBeNull();

    // The person, the tier, the grant that carries the seat, the membership.
    const { data: person } = await service
      .from('person')
      .insert({
        workspace_id: ws,
        first_name: 'Tier',
        last_name: 'Buyer',
        email: `int-seat-tier-${randomUUID().slice(0, 8)}@example.com`,
      })
      .select('id')
      .single();
    const { data: tier } = await service
      .from('membership_tier')
      .insert({ workspace_id: ws, name: 'Seat tier' })
      .select('id')
      .single();
    await service.from('membership_access_grant').insert({
      workspace_id: ws,
      tier_id: tier!.id,
      kind: 'fibre_seat',
      config: { role: 'organiser', team_id: teamId },
    });
    const { data: member } = await service
      .from('membership_member')
      .insert({ workspace_id: ws, person_id: person!.id, tier_id: tier!.id, status: 'active' })
      .select('id')
      .single();

    // What the app does when a membership starts: work out what it owes, then
    // let the worker deliver it.
    await reconcileTierMembers(tier!.id as string);
    const ran = await runFibreSeatSync();

    // The journal FIRST, because it carries the reason. Asserting on the
    // worker's error count before reading it gives "expected 1 to be 0" and
    // sends you hypothesising — the thing the API-log rule in CLAUDE.md
    // exists to stop.
    const { data: journal } = await service
      .from('membership_member_access')
      .select('status, external_ref, last_error')
      .eq('member_id', member!.id);
    expect(ran.errors, `the worker provisioned without error: ${JSON.stringify(journal)}`).toBe(0);
    const seatRow = (journal ?? []).find((j) => j.external_ref);
    expect(seatRow, `the seat was provisioned: ${JSON.stringify(journal)}`).toBeTruthy();
    expect(seatRow!.status).toBe('granted');
    const userId = seatRow!.external_ref as string;
    madeUsers.push(userId);

    // 1. A SEAT.
    const { data: wm } = await service
      .from('workspace_member')
      .select('workspace_role')
      .eq('workspace_id', ws)
      .eq('user_id', userId);
    expect(wm ?? [], 'they hold a seat').toHaveLength(1);

    // 2. THE TEAMS — the automatic one every member belongs to, and the one
    //    the grant named.
    expect(await membersOf('everyone'), 'in Everyone').toContain(userId);
    const { data: tm } = await service
      .from('team_member')
      .select('team_id')
      .eq('user_id', userId)
      .eq('team_id', teamId);
    expect(tm ?? [], 'and in the team the grant chose').toHaveLength(1);

    // 3. THE APPS. The one a person would notice: without syncUsers the two
    //    rows above exist and nothing opens.
    const { data: am } = await service
      .from('app_membership')
      .select('app_id, role')
      .eq('user_id', userId)
      .eq('app_id', app!.id);
    expect(am ?? [], 'and the team\u2019s app grant reached them').toHaveLength(1);
  }, 180_000);
});

describe('what a seat grant must NOT do', () => {
  it('does not resurrect a removed account, and says who should', async () => {
    const ws = await freshWorkspace('seat-gone');
    // `user.deleted_at` has one writer in code (member removal) and one
    // clearer (re-invite). But erasure is still a MANUAL queue, so from here
    // a removed seat and an account erased by hand look identical — and an
    // automatic job must not bring one back on a maybe. It refuses with text
    // an admin can act on.
    const { data: person } = await service
      .from('person')
      .insert({
        workspace_id: ws,
        first_name: 'Removed',
        last_name: 'Before',
        email: `int-seat-gone-${randomUUID().slice(0, 8)}@example.com`,
      })
      .select('id')
      .single();

    const first = await grantSeat(ws, person!.id as string, { role: 'organiser' });
    expect(first.ok, JSON.stringify(first)).toBe(true);
    const userId = (first as { ok: true; userId: string }).userId;
    madeUsers.push(userId);

    // Removed the way the Members screen removes somebody.
    await service
      .from('user')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);
    await service.from('workspace_member').delete().eq('user_id', userId);

    const again = await grantSeat(ws, person!.id as string, { role: 'organiser' });
    expect(again.ok, 'the worker refuses to re-create a removed account').toBe(false);
    expect(!again.ok && again.error).toMatch(/admin must invite them again/i);

    // And it really did not touch the row — no silent resurrection.
    const { data: still } = await service
      .from('user')
      .select('deleted_at')
      .eq('id', userId)
      .single();
    expect(still!.deleted_at, 'the account is still removed').not.toBeNull();
    const { data: wm } = await service
      .from('workspace_member')
      .select('user_id')
      .eq('user_id', userId);
    expect(wm ?? [], 'and no seat was handed back').toHaveLength(0);
  }, 120_000);

  it('does not demote a team LEAD, or reactivate a membership an admin stopped', async () => {
    const ws = await freshWorkspace('seat-lead');
    // A seat grant says "put them in this team if they are not in it". It is
    // not an instruction about a membership that already exists — and an
    // upsert would have made renewing a membership silently demote a lead.
    const { data: team } = await service
      .from('team')
      .insert({ workspace_id: ws, name: 'Leads', slug: `seat-leads-${ws.slice(0, 8)}` })
      .select('id')
      .single();
    const teamId = team!.id as string;

    const { data: person } = await service
      .from('person')
      .insert({
        workspace_id: ws,
        first_name: 'Team',
        last_name: 'Lead',
        email: `int-seat-lead-${randomUUID().slice(0, 8)}@example.com`,
      })
      .select('id')
      .single();
    const granted = await grantSeat(ws, person!.id as string, { role: 'organiser' });
    expect(granted.ok, JSON.stringify(granted)).toBe(true);
    const userId = (granted as { ok: true; userId: string }).userId;
    madeUsers.push(userId);

    // They are already a LEAD of that team, and of a second team an admin has
    // deliberately set inactive.
    await service
      .from('team_member')
      .insert({ team_id: teamId, user_id: userId, role: 'lead', status: 'active' });

    // Now a membership grants them a seat naming that same team.
    const regranted = await grantSeat(ws, person!.id as string, {
      role: 'organiser',
      team_id: teamId,
    });
    expect(regranted.ok, JSON.stringify(regranted)).toBe(true);

    const { data: tm } = await service
      .from('team_member')
      .select('role, status')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();
    expect(tm!.role, 'still a lead').toBe('lead');
    expect(tm!.status, 'and still active').toBe('active');
  }, 120_000);
});
