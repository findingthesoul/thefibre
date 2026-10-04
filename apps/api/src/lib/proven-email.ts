// What a PROVEN email address entitles somebody to — decided in one place.
//
// The lockout this fixes. A participant's portal answers for the one thing
// their token proves: an address they can receive mail at. Every lookup asked
// `person.email = <that address>`. Then two of their contact records were
// merged — which is the right thing to do with two records of one person —
// and the merge keeps ONE `person.email`, moving the other address into
// `email_secondary` and the contact-point table. From that moment the person
// signing in with the address that lost is a stranger to their own portal:
// their tickets, invoices and memberships are all on a person row whose
// `email` column now says something else. Tidying the data locked them out.
//
// So a lookup must ask the wider question — "which person rows does this
// address belong to" — and the contact-point table already holds that answer.
//
// WHY ONLY VERIFIED POINTS, and why this is the load-bearing line:
// a contact point is ordinary curator data. Any organiser can type an address
// onto any contact; that is the whole point of a CRM. If an unverified point
// granted portal access, then typing `someone@else.com` onto a contact would
// hand whoever controls that mailbox every invoice and enrolment of the
// person it was typed on. An address grants access only once somebody has
// PROVEN they receive mail there, by signing in with it.
//
// `verified_at` has existed on person_contact_point since 2026-09-15 and was
// backfilled once at migration time for addresses that matched a linked
// user's email. Nothing has written it since, so it has been going stale from
// the day it was created; markEmailProven is what keeps it true.

import { adminClient } from '../db.js';

/**
 * Record that somebody has proven they receive mail at this address.
 *
 * Called where an email is PROVEN and nowhere else: the participant surfaces,
 * whose token is a Supabase session minted by Google sign-in or by the
 * platform's 8-digit emailed code. Both prove the same thing — the holder
 * reads that mailbox — which is exactly what `verified_at` records.
 *
 * Idempotent and narrow: it only touches rows that are not already stamped,
 * so the steady state is a no-op, and it never un-verifies anything.
 *
 * Deliberately NOT fatal. A failure here must not break somebody's portal:
 * the worst case is that the address stays unverified and the next sign-in
 * stamps it. It is logged, because silently never stamping would look exactly
 * like this feature working.
 */
export async function markEmailProven(email: string): Promise<void> {
  const value = email.trim().toLowerCase();
  if (!value) return;
  const { error } = await adminClient
    .from('person_contact_point')
    .update({ verified_at: new Date().toISOString() })
    .eq('kind', 'email')
    .eq('value', value)
    .is('verified_at', null);
  if (error) {
    console.error('[proven-email] could not stamp verified_at', { error: error.message });
  }
}

/**
 * The person rows a proven email may act for: the rows whose own `email` is
 * that address, plus the rows carrying it as a VERIFIED contact point.
 *
 * Soft-deleted people are excluded — a forgotten person is forgotten.
 *
 * Membership's portal slice builds on this; it is the one function to call,
 * rather than each surface re-deriving the rule and one of them forgetting
 * the `verified_at` clause.
 *
 * Throws on a failed read rather than returning []. An empty array here means
 * "this address belongs to nobody", which is a real answer that empties
 * somebody's portal; a database error must never be able to impersonate it.
 */
export async function personIdsForProvenEmail(email: string): Promise<string[]> {
  return (await personsForProvenEmail(email)).map((p) => p.id);
}

/**
 * The same answer, carrying each person's workspace — which the surfaces that
 * answer per workspace need (an RSVP belongs to the workspace running the
 * thread). The id-only version is a map over this one rather than a second
 * query, so the two can never disagree about who you are.
 */
export async function personsForProvenEmail(
  email: string,
): Promise<{ id: string; workspace_id: string }[]> {
  const value = email.trim().toLowerCase();
  if (!value) return [];

  const [own, viaPoint] = await Promise.all([
    adminClient
      .from('person')
      .select('id, workspace_id')
      .eq('email', value)
      .is('deleted_at', null),
    adminClient
      .from('person_contact_point')
      .select('person_id, person:person_id (deleted_at, workspace_id)')
      .eq('kind', 'email')
      .eq('value', value)
      .not('verified_at', 'is', null),
  ]);
  if (own.error) throw new Error(`personIdsForProvenEmail (person): ${own.error.message}`);
  if (viaPoint.error) {
    throw new Error(`personIdsForProvenEmail (contact points): ${viaPoint.error.message}`);
  }

  const byId = new Map<string, { id: string; workspace_id: string }>();
  for (const r of own.data ?? []) {
    byId.set(r.id as string, { id: r.id as string, workspace_id: r.workspace_id as string });
  }
  for (const r of viaPoint.data ?? []) {
    // The join comes back object-or-array depending on PostgREST's mood.
    const p = (Array.isArray(r.person) ? r.person[0] : r.person) as
      | { deleted_at: string | null; workspace_id: string }
      | null
      | undefined;
    if (!p || p.deleted_at) continue;
    byId.set(r.person_id as string, {
      id: r.person_id as string,
      workspace_id: p.workspace_id,
    });
  }
  return [...byId.values()];
}
