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
    const revoked = await revokeSeatForTest(ws, userId, 'admin');
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

  it('never lowers a role or changes the relationship of somebody already in the workspace', async () => {
    // soul.com, 2026-10-14: all five members of the TEAM also hold a seat
    // through a membership. The grant was an upsert of (organiser, external),
    // so it set a super_admin to organiser and an internal member to external.
    const ws = await freshWorkspace('seat-senior');
    const mk = async (tag: string) => {
      const email = `int-seat-${tag}-${randomUUID().slice(0, 8)}@example.com`;
      const { data: p } = await service.from('person').insert({ workspace_id: ws, first_name: 'Seat', last_name: tag, email }).select('id').single();
      const { data: u } = await service.from('user').insert({ workspace_id: ws, person_id: p!.id, email, primary_auth_method: 'google', email_verified: true }).select('id').single();
      madeUsers.push(u!.id as string);
      return { personId: p!.id as string, userId: u!.id as string };
    };
    const read = async (userId: string) =>
      (await service.from('workspace_member').select('workspace_role, relationship_type').eq('workspace_id', ws).eq('user_id', userId).single()).data;

    // A founder: super_admin, internal. Granted an ADMIN seat — still lower.
    const founder = await mk('founder');
    await service.from('workspace_member').insert({ workspace_id: ws, user_id: founder.userId, workspace_role: 'super_admin', relationship_type: 'internal' });
    const g1 = await grantSeat(ws, founder.personId, { role: 'admin' });
    expect(g1.ok, JSON.stringify(g1)).toBe(true);
    expect(await read(founder.userId)).toEqual({ workspace_role: 'super_admin', relationship_type: 'internal' });

    // A team organiser, internal, granted an ADMIN seat: the role rises to the
    // seat's floor; the relationship is left alone.
    const staff = await mk('staff');
    await service.from('workspace_member').insert({ workspace_id: ws, user_id: staff.userId, workspace_role: 'organiser', relationship_type: 'internal' });
    const g2 = await grantSeat(ws, staff.personId, { role: 'admin' });
    expect(g2.ok, JSON.stringify(g2)).toBe(true);
    expect(await read(staff.userId)).toEqual({ workspace_role: 'admin', relationship_type: 'internal' });

    // And a NEW member still gets the seat's row, as before.
    const fresh = await mk('fresh');
    const g3 = await grantSeat(ws, fresh.personId, { role: 'organiser' });
    expect(g3.ok, JSON.stringify(g3)).toBe(true);
    expect(await read(fresh.userId)).toEqual({ workspace_role: 'organiser', relationship_type: 'external' });
  }, 120_000);

  it('a lapsed seat leaves the team: internal and senior rows are kept, and re-grant works', async () => {
    // soul.com, 2026-10-14: the team hold memberships with a seat, and their
    // journal rows already carry external_ref. A lapse deleted the workspace
    // row and soft-deleted the account, founder included — and re-granting
    // then refused as "removed before".
    const ws = await freshWorkspace('seat-lapse');
    const mk = async (tag: string) => {
      const email = `int-seat-${tag}-${randomUUID().slice(0, 8)}@example.com`;
      const { data: p } = await service.from('person').insert({ workspace_id: ws, first_name: 'Lapse', last_name: tag, email }).select('id').single();
      const { data: u } = await service.from('user').insert({ workspace_id: ws, person_id: p!.id, email, primary_auth_method: 'google', email_verified: true }).select('id').single();
      madeUsers.push(u!.id as string);
      return { personId: p!.id as string, userId: u!.id as string };
    };
    const state = async (userId: string) => ({
      wm: (await service.from('workspace_member').select('workspace_role, relationship_type').eq('workspace_id', ws).eq('user_id', userId).maybeSingle()).data,
      deleted: (await service.from('user').select('deleted_at').eq('id', userId).single()).data!.deleted_at,
    });

    // A team member, internal organiser, with a seat.
    const staff = await mk('staff');
    await service.from('workspace_member').insert({ workspace_id: ws, user_id: staff.userId, workspace_role: 'organiser', relationship_type: 'internal' });
    expect((await grantSeat(ws, staff.personId, { role: 'organiser' })).ok).toBe(true);
    const r1 = await revokeSeatForTest(ws, staff.userId, 'organiser');
    expect(r1.ok && r1.kept, JSON.stringify(r1)).toMatch(/internal/);
    expect(await state(staff.userId)).toEqual({ wm: { workspace_role: 'organiser', relationship_type: 'internal' }, deleted: null });
    // ... and their next membership re-grants cleanly.
    const again = await grantSeat(ws, staff.personId, { role: 'organiser' });
    expect(again.ok, JSON.stringify(again)).toBe(true);

    // A super_admin, even one marked external, is kept.
    const founder = await mk('founder');
    await service.from('workspace_member').insert({ workspace_id: ws, user_id: founder.userId, workspace_role: 'super_admin', relationship_type: 'external' });
    const r2 = await revokeSeatForTest(ws, founder.userId, 'organiser');
    expect(r2.ok && r2.kept, JSON.stringify(r2)).toMatch(/above/);
    expect(await state(founder.userId)).toEqual({ wm: { workspace_role: 'super_admin', relationship_type: 'external' }, deleted: null });

    // A pure seat member — the row the seat made — is removed as before.
    const buyer = await mk('buyer');
    expect((await grantSeat(ws, buyer.personId, { role: 'organiser' })).ok).toBe(true);
    const r3 = await revokeSeatForTest(ws, buyer.userId, 'organiser');
    expect(r3, JSON.stringify(r3)).toEqual({ ok: true });
    const after = await state(buyer.userId);
    expect(after.wm).toBeNull();
    expect(after.deleted, 'the seat closes: the account row is soft-deleted').not.toBeNull();
  }, 120_000);

  it('a seat two grants hold closes only when the LAST of them is revoked', async () => {
    const ws = await freshWorkspace('seat-two');
    const email = `int-seat-two-${randomUUID().slice(0, 8)}@example.com`;
    const { data: person } = await service.from('person').insert({ workspace_id: ws, first_name: 'Two', last_name: 'Seats', email }).select('id').single();
    const granted = await grantSeat(ws, person!.id as string, { role: 'organiser' });
    expect(granted.ok, JSON.stringify(granted)).toBe(true);
    const userId = (granted as { ok: true; userId: string }).userId;
    madeUsers.push(userId);

    // One membership, two seat grants on it (one person has one membership per
    // workspace; a tier and a product can each carry a seat) — a journal row
    // for each, both granted.
    const { data: tier, error: tErr } = await service.from('membership_tier').insert({ workspace_id: ws, name: 'Two seats' }).select('id').single();
    expect(tErr, tErr?.message).toBeNull();
    const { data: member, error: mErr } = await service
      .from('membership_member')
      .insert({ workspace_id: ws, person_id: person!.id, tier_id: tier!.id, status: 'active' })
      .select('id')
      .single();
    expect(mErr, mErr?.message).toBeNull();
    const journal: string[] = [];
    for (let k = 0; k < 2; k++) {
      const { data: grant, error: gErr } = await service
        .from('membership_access_grant')
        .insert({ workspace_id: ws, tier_id: tier!.id, kind: 'fibre_seat', config: { role: 'organiser' } })
        .select('id')
        .single();
      expect(gErr, gErr?.message).toBeNull();
      const { data: row, error } = await service
        .from('membership_member_access')
        .upsert(
          { member_id: member!.id, access_grant_id: grant!.id, status: 'granted', external_ref: userId },
          { onConflict: 'member_id,access_grant_id' },
        )
        .select('id')
        .single();
      expect(error, error?.message).toBeNull();
      journal.push(row!.id as string);
    }
    const wmOf = async () =>
      (await service.from('workspace_member').select('workspace_role').eq('workspace_id', ws).eq('user_id', userId).maybeSingle()).data;

    // A is revoked while B still holds the seat: kept.
    await service.from('membership_member_access').update({ status: 'revoke_pending' }).eq('id', journal[0]!);
    const first = await revokeSeatForTest(ws, userId, 'organiser', journal[0]!);
    expect(first.ok && first.kept, JSON.stringify(first)).toMatch(/another membership/);
    expect(await wmOf()).toEqual({ workspace_role: 'organiser' });

    // Then B goes too: the seat closes.
    await service.from('membership_member_access').update({ status: 'revoked' }).eq('id', journal[0]!);
    await service.from('membership_member_access').update({ status: 'revoke_pending' }).eq('id', journal[1]!);
    const last = await revokeSeatForTest(ws, userId, 'organiser', journal[1]!);
    expect(last, JSON.stringify(last)).toEqual({ ok: true });
    expect(await wmOf()).toBeNull();
  }, 120_000);
});
