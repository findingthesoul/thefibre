// Grant kind `fibre_seat` — membership grants a WORKSPACE SEAT
// (proposal §3.10: "someone who becomes a certain membership type also
// gets a seat in fibre"). The built-in integration: same journal, same
// worker cadence as Circle, no external credential.
//
// The deliberate-cost rule: seats are BILLED on the workspace's own Fibre
// subscription (seat billing v0.22.0), so granting follows the invite
// flow's exact seat policy — a free/comped workspace past its allowance
// gets journal status 'error' ("seat limit"), a paying one gets charged
// (prorated). Revocation deletes the workspace_member row; the next
// period's invoice counts fewer (proration_behavior 'none' inside
// reconcileSeatBilling — the 2026-09-04 decision).

import { adminClient } from '../db.js';
import { seatAvailable } from './plan.js';
import { syncAutomaticTeams } from './automatic-teams.js';
import { syncUsers } from './team-grants.js';
import { seatBillable, reconcileSeatBilling } from './seat-billing.js';
import { raisedRole } from './role-floor.js';

type JournalRow = {
  id: string;
  status: string;
  grant: { id: string; kind: string; config: Record<string, unknown> | null } | null;
  member: { id: string; workspace_id: string; person_id: string } | null;
};

export async function grantSeat(
  workspaceId: string,
  personId: string,
  config: Record<string, unknown> | null,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { data: person } = await adminClient
    .from('person')
    .select('id, email, first_name, last_name')
    .eq('id', personId)
    .maybeSingle();
  if (!person?.email) return { ok: false, error: 'person has no email' };
  const email = person.email.toLowerCase();

  // User row for (workspace, email) — the invite flow's identity invariant.
  // SOFT-DELETED ROWS INCLUDED, because a seat that was revoked leaves one
  // behind and inserting a second row for the same address would break that
  // invariant. Re-inviting resurrects the row (routes/members.ts POST); so
  // does re-granting.
  let { data: u } = await adminClient
    .from('user')
    .select('id, deleted_at')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .maybeSingle();

  if (u?.deleted_at) {
    // A SOFT-DELETED ROW IS NOT RESURRECTED BY A WORKER. In code this column
    // has one writer and one clearer — member removal and re-invite
    // (routes/members.ts); privacy.ts only reads it for the export. But
    // erasure is still a MANUAL queue, so a person honouring "remove me" today
    // has no other column to use, and from here a removed seat and an erased
    // account look identical. Re-inviting is a human act with a human behind
    // it; a membership sync is not, and an automatic job that un-deletes an
    // account on a maybe is a privacy failure, not a seat failure.
    //
    // So it stops, and says what to do. The journal row goes to `error` with
    // this text, which is what an admin reads on the Members screen.
    return {
      ok: false,
      error:
        'this person was removed from the workspace before — an admin must invite them again, ' +
        'because a membership sync will not restore a removed account on its own',
    };
  }

  if (!u) {
    // New seat: the invite flow's policy, verbatim — allowance first,
    // billable second, refuse third.
    const seat = await seatAvailable(workspaceId);
    if (!seat.ok && !(await seatBillable(workspaceId))) {
      return { ok: false, error: `seat limit: ${seat.used}/${seat.included} in use and the workspace plan cannot bill extra seats` };
    }
    const { data: created, error } = await adminClient
      .from('user')
      .insert({
        workspace_id: workspaceId,
        person_id: person.id,
        email,
        full_name: [person.first_name, person.last_name].filter(Boolean).join(' ') || null,
        primary_auth_method: 'google',
        email_verified: false,
      })
      .select('id, deleted_at')
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? 'user insert failed' };
    u = created;
  }
  // Narrowing for the compiler: both branches above either found a row or
  // made one, and a failure returned.
  if (!u) return { ok: false, error: 'user row could not be resolved' };

  const role = config?.role === 'admin' ? 'admin' : 'organiser';
  // AN EXISTING ROW IS NOT REWRITTEN, beyond raising its role. This was an
  // upsert of (role, 'external'), so a seat granted to somebody already in the
  // workspace — the TEAM, who also buy memberships — set a super_admin to
  // organiser and an internal member to external. Found 2026-10-14: every one
  // of soul.com's five members, Sjoerd included, holds a seat. Same class as
  // the re-invite demotion (routes/members.ts POST). So: insert if absent;
  // otherwise the seat's role is a FLOOR (lib/role-floor.ts) and the
  // relationship is the organisation's to say, not a membership's.
  const { error: insErr } = await adminClient
    .from('workspace_member')
    .upsert(
      { user_id: u.id, workspace_id: workspaceId, workspace_role: role, relationship_type: 'external' },
      { onConflict: 'user_id,workspace_id', ignoreDuplicates: true },
    );
  if (insErr) return { ok: false, error: insErr.message };
  const { data: wm, error: readErr } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', u.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (readErr || !wm) return { ok: false, error: readErr?.message ?? 'membership row could not be read back' };
  const raise = raisedRole(wm.workspace_role, role);
  if (raise) {
    const q = adminClient
      .from('workspace_member')
      .update({ workspace_role: raise })
      .eq('user_id', u.id)
      .eq('workspace_id', workspaceId);
    // Only over the value just read: a role raised meanwhile is not lowered.
    const { error: upErr } = await (wm.workspace_role === null
      ? q.is('workspace_role', null)
      : q.eq('workspace_role', wm.workspace_role));
    if (upErr) return { ok: false, error: upErr.message };
  }

  // THE AUTOMATIC TEAMS. Every other writer of `workspace_member` calls this;
  // the membership path did not, so a seat granted by a product put nobody in
  // Everyone or Admins and the app access those teams carry never arrived.
  // (Measured, not deduced: fibre-seat-teams.int.test.ts was red on it.)
  await syncAutomaticTeams(workspaceId);

  // A NAMED TEAM, when the grant asks for one: "a seat in Fibre, in the
  // volunteers team". Validated where it is written (routes/membership.ts),
  // so by the time it arrives here it is a team of this workspace.
  const teamId = typeof config?.team_id === 'string' ? config.team_id.trim() : '';
  if (teamId) {
    const { error: tmErr } = await adminClient.from('team_member').upsert(
      // 'member', never 'lead': lead is app-admin through team_app_grant, and
      // a membership that buys a seat is not buying the right to administer
      // somebody's team. Same choice the automatic teams make, for the same
      // reason.
      { team_id: teamId, user_id: u.id, role: 'member', status: 'active' },
      // INSERT-IF-ABSENT. A plain upsert would overwrite an existing row:
      // a LEAD of this team would be demoted to member by renewing their
      // membership, and a membership an admin deliberately set inactive would
      // come back. A seat grant says "put them in this team if they are not in
      // it" — it is not an instruction about a membership that already exists,
      // whatever its role or status.
      { onConflict: 'team_id,user_id', ignoreDuplicates: true },
    );
    // Not fatal: the seat itself was granted, and a team that could not be
    // joined is a smaller failure than a seat that silently did not happen.
    // It is logged, and the journal row carries the grant for a later sweep.
    if (tmErr) console.error('[fibre-seat] team join failed', teamId, tmErr.message);
    // AND THE APPS THAT TEAM CONFERS. Joining a team writes a team_member
    // row; it is `syncUsers` that turns the team's grants into the
    // app_membership rows a person actually opens apps with. Without this the
    // seat lands in the right team and still opens nothing — the same shape
    // of failure as the automatic teams above, one layer down.
    else await syncUsers([u.id]);
  }

  await reconcileSeatBilling(workspaceId).catch((e) =>
    console.error('[fibre-seat] seat billing reconcile failed', e),
  );
  return { ok: true, userId: u.id };
}

/** Exported ONLY for the integration test that proves a revoked seat loses
 *  its automatic teams. The worker below is the real caller; nothing else
 *  should revoke a seat directly. */
export { revokeSeat as revokeSeatForTest };

async function revokeSeat(workspaceId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  // THE SEAT ACTUALLY CLOSES. Removal through the invite flow soft-deletes
  // the workspace's `user` row, and says why in its own words: that row "is
  // exactly what `seatsUsed` counts, so the seat stops existing the moment
  // the row is soft-deleted". This path deleted only the membership edge, so
  // a revoked seat kept its place in the allowance AND on the bill —
  // `reconcileSeatBilling` counts the same rows. Found by a test that could
  // not provision a second seat in a workspace whose only seat had already
  // been revoked: "seat limit: 1/1 in use".
  //
  // The PERSON stays, and so does the row — soft, never hard: they may hold
  // memberships, purchases and history, and re-granting resurrects it.
  const { error: delErr } = await adminClient
    .from('user')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('workspace_id', workspaceId);
  if (delErr) return { ok: false, error: delErr.message };

  const { error } = await adminClient
    .from('workspace_member')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };

  // AND THE TEAMS LET GO. Without this the workspace_member row goes while
  // the team_member rows stay, so every app grant those teams carry outlives
  // the seat that justified it — access retained after revocation, which is
  // the direction nobody notices because nothing on screen says so.
  await syncAutomaticTeams(workspaceId);

  await reconcileSeatBilling(workspaceId).catch((e) =>
    console.error('[fibre-seat] seat billing reconcile failed', e),
  );
  return { ok: true };
}

export async function runFibreSeatSync(): Promise<{ granted: number; revoked: number; errors: number }> {
  const out = { granted: 0, revoked: 0, errors: 0 };
  const { data } = await adminClient
    .from('membership_member_access')
    .select(
      'id, status, external_ref, grant:access_grant_id (id, kind, config), member:member_id (id, workspace_id, person_id)',
    )
    .in('status', ['pending', 'revoke_pending'])
    .limit(200);
  const rows = ((data ?? []) as unknown as (JournalRow & { external_ref: string | null })[]).filter(
    (r) => r.grant?.kind === 'fibre_seat' && r.member,
  );

  // Per-workspace seat policy (membership_settings): 'approve' parks every
  // seat for a human; 'auto' provisions free-allowance seats but still
  // parks BILLED seats unless allow_billed_seats consents.
  const wsIds = [...new Set(rows.map((r) => r.member!.workspace_id))];
  const { data: settingsRows } = wsIds.length
    ? await adminClient
        .from('membership_settings')
        .select('workspace_id, fibre_seat_mode, allow_billed_seats')
        .in('workspace_id', wsIds)
    : { data: [] as { workspace_id: string; fibre_seat_mode: string; allow_billed_seats: boolean }[] };
  const policy = new Map((settingsRows ?? []).map((r) => [r.workspace_id, r]));

  for (const row of rows) {
    if (row.status === 'pending') {
      const pol = policy.get(row.member!.workspace_id);
      const mode = pol?.fibre_seat_mode ?? 'approve';
      if (mode === 'approve') {
        await adminClient
          .from('membership_member_access')
          .update({ status: 'awaiting_approval', last_error: null, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        continue;
      }
      // auto mode: a seat that would BILL still needs the standing consent.
      const seat = await seatAvailable(row.member!.workspace_id);
      if (!seat.ok && !(pol?.allow_billed_seats ?? false)) {
        await adminClient
          .from('membership_member_access')
          .update({
            status: 'awaiting_approval',
            last_error: `would add a billed seat (${seat.used}/${seat.included} in use) — approve to charge it`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        continue;
      }
      const r = await grantSeat(row.member!.workspace_id, row.member!.person_id, row.grant!.config);
      await adminClient
        .from('membership_member_access')
        .update(
          r.ok
            ? { status: 'granted', external_ref: r.userId, last_error: null, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            : { status: 'error', last_error: r.error, updated_at: new Date().toISOString() },
        )
        .eq('id', row.id);
      r.ok ? (out.granted += 1) : (out.errors += 1);
    } else {
      if (!row.external_ref) {
        await adminClient
          .from('membership_member_access')
          .update({ status: 'revoked', updated_at: new Date().toISOString() })
          .eq('id', row.id);
        out.revoked += 1;
        continue;
      }
      const r = await revokeSeat(row.member!.workspace_id, row.external_ref);
      await adminClient
        .from('membership_member_access')
        .update(
          r.ok
            ? { status: 'revoked', last_error: null, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            : { status: 'error', last_error: r.error ?? 'revoke failed', updated_at: new Date().toISOString() },
        )
        .eq('id', row.id);
      r.ok ? (out.revoked += 1) : (out.errors += 1);
    }
  }
  return out;
}
