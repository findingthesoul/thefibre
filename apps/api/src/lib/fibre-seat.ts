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
import { seatBillable, reconcileSeatBilling } from './seat-billing.js';

type JournalRow = {
  id: string;
  status: string;
  grant: { id: string; kind: string; config: Record<string, unknown> | null } | null;
  member: { id: string; workspace_id: string; person_id: string } | null;
};

async function grantSeat(
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
  let { data: u } = await adminClient
    .from('user')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();

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
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? 'user insert failed' };
    u = created;
  }

  const role = config?.role === 'admin' ? 'admin' : 'organiser';
  const { error: wmErr } = await adminClient
    .from('workspace_member')
    .upsert(
      {
        user_id: u.id,
        workspace_id: workspaceId,
        workspace_role: role,
        relationship_type: 'external',
      },
      { onConflict: 'user_id,workspace_id' },
    );
  if (wmErr) return { ok: false, error: wmErr.message };

  await reconcileSeatBilling(workspaceId).catch((e) =>
    console.error('[fibre-seat] seat billing reconcile failed', e),
  );
  return { ok: true, userId: u.id };
}

async function revokeSeat(workspaceId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  // The seat closes; the user row stays (soft identity — they may hold
  // memberships, purchases, history). Billing counts fewer from the next
  // period (reconcileSeatBilling applies the no-mid-month-credit policy).
  const { error } = await adminClient
    .from('workspace_member')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
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

  for (const row of rows) {
    if (row.status === 'pending') {
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
