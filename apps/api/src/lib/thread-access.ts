// Thread access sync — drains the membership_member_access journal for
// `thread` grants.
//
// Why this exists: the access-grant dropdown has offered "Thread" since the
// app shipped. It saved, it listed, and NOTHING consumed it — circle,
// fibre_seat and google_user each had a worker, thread had none. So a tier
// could promise a thread and deliver nothing, silently, forever (found on
// soul.com 2026-09-09, where four of seven products are threads and the
// €2300 tier unlocked nothing at all).
//
// The journal is the contract (proposal §3.6): membership writes pending /
// revoke_pending rows at lifecycle moments; this worker performs them and
// stamps the outcome. Idempotent and re-runnable — a row only moves forward
// (pending → granted | error, revoke_pending → revoked | error), and both
// directions converge on repeats.
//
// In-family app, so it writes the platform tables directly rather than
// crossing an API (design: in-family apps use the platform natively). An
// enrolment is TWO rows: `enrolment` (the platform's, keyed on program) and
// `thread_enrolment` (the app's). Both are created; neither is ever deleted.
//
// Revoke marks the enrolment 'dropped' and LEAVES both rows. Deleting would
// destroy the record that someone took part, and the platform rule is soft
// delete only for personal data. The participant list already selects
// enrolment.status, so a dropped member reads as dropped rather than
// vanishing. Rejoining flips the same rows back to 'enrolled', which is why
// the pair is looked up before anything is inserted.

import { adminClient } from '../db.js';

type JournalRow = {
  id: string;
  status: string;
  member_id: string;
  grant: { id: string; kind: string; config: Record<string, unknown> | null } | null;
  member: { id: string; workspace_id: string; person_id: string } | null;
};

/** Grants store what the organiser typed. That is a bare slug on a good day
 *  and the full public URL on a normal one — soul.com's existing grant holds
 *  `https://app.thethread.app/soul/community-member-year-agenda`. Take the
 *  last path segment either way. */
export function threadSlugFromConfig(config: Record<string, unknown> | null): string | null {
  const raw = config?.thread_slug;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const withoutQuery = raw.trim().split(/[?#]/)[0] ?? '';
  const segments = withoutQuery.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? last.toLowerCase() : null;
}

async function stamp(id: string, status: string, error?: string | null, ref?: string | null) {
  await adminClient
    .from('membership_member_access')
    .update({
      status,
      ...(ref !== undefined ? { external_ref: ref } : {}),
      last_error: error ?? null,
      ...(status === 'granted' || status === 'revoked' ? { synced_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

export async function runThreadAccessSync(): Promise<{
  granted: number;
  revoked: number;
  errors: number;
}> {
  const out = { granted: 0, revoked: 0, errors: 0 };

  const { data } = await adminClient
    .from('membership_member_access')
    .select(
      'id, status, member_id, grant:access_grant_id (id, kind, config), member:member_id (id, workspace_id, person_id)',
    )
    .in('status', ['pending', 'revoke_pending'])
    .limit(200);
  const rows = (data ?? []) as unknown as JournalRow[];
  const threadRows = rows.filter((r) => r.grant?.kind === 'thread' && r.member);
  if (!threadRows.length) return out;

  for (const row of threadRows) {
    const slug = threadSlugFromConfig(row.grant?.config ?? null);
    if (!slug) {
      await stamp(row.id, 'error', 'the grant has no thread');
      out.errors += 1;
      continue;
    }

    // Scoped to the member's OWN workspace, never by slug alone — slugs are
    // unique per organiser, not globally.
    const { data: thread } = await adminClient
      .from('thread_thread')
      .select('id, program_id, workspace_id')
      .eq('workspace_id', row.member!.workspace_id)
      .eq('slug', slug)
      .maybeSingle();
    if (!thread) {
      await stamp(row.id, 'error', `no thread "${slug}" in this workspace`);
      out.errors += 1;
      continue;
    }

    const personId = row.member!.person_id;
    const granting = row.status === 'pending';

    try {
      const { data: existing } = await adminClient
        .from('enrolment')
        .select('id, status')
        .eq('program_id', thread.program_id)
        .eq('person_id', personId)
        .maybeSingle();

      if (!granting) {
        // Nothing to withdraw is a success, not an error — the member may
        // never have been enrolled, or an admin removed them by hand.
        if (existing) {
          await adminClient
            .from('enrolment')
            .update({ status: 'dropped' })
            .eq('id', existing.id);
        }
        await stamp(row.id, 'revoked', null, thread.id);
        out.revoked += 1;
        continue;
      }

      let enrolmentId = existing?.id ?? null;
      if (enrolmentId) {
        // Rejoin: the rows survive a lapse, so flip this one back.
        if (existing!.status !== 'enrolled' && existing!.status !== 'completed') {
          await adminClient
            .from('enrolment')
            .update({ status: 'enrolled', enrolled_at: new Date().toISOString() })
            .eq('id', enrolmentId);
        }
      } else {
        const { data: created, error: enrErr } = await adminClient
          .from('enrolment')
          .insert({
            program_id: thread.program_id,
            person_id: personId,
            status: 'enrolled',
            enrolled_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (enrErr || !created) {
          await stamp(row.id, 'error', enrErr?.message ?? 'could not enrol');
          out.errors += 1;
          continue;
        }
        enrolmentId = created.id;
      }

      // The app row. `not_required` because the membership already paid for
      // this — a grant is an entitlement, never a second charge.
      const { data: te } = await adminClient
        .from('thread_enrolment')
        .select('id')
        .eq('thread_id', thread.id)
        .eq('person_id', personId)
        .maybeSingle();
      if (!te) {
        const { error: teErr } = await adminClient.from('thread_enrolment').insert({
          workspace_id: thread.workspace_id,
          thread_id: thread.id,
          enrolment_id: enrolmentId,
          person_id: personId,
          payment_status: 'not_required',
          request_id: `membership:${row.grant!.id}:${row.member_id}`,
        });
        if (teErr) {
          await stamp(row.id, 'error', teErr.message);
          out.errors += 1;
          continue;
        }
      }

      await stamp(row.id, 'granted', null, thread.id);
      out.granted += 1;
    } catch (e) {
      await stamp(row.id, 'error', e instanceof Error ? e.message : 'thread sync failed');
      out.errors += 1;
    }
  }

  return out;
}
