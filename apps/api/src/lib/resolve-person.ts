// Person SPoT — the one way a person is matched or created.
//
// Before this, nine call sites across six route files each rolled their own
// match-or-create, and they disagreed in ways that were quietly wrong:
//
//   - Five used .maybeSingle() with no .limit(1). PostgREST raises PGRST116
//     when more than one row matches, so the moment a workspace held two
//     people on one address, a Meet booking or a membership join 500'd. The
//     duplicate problem was eating the code meant to prevent it.
//   - Matching was inconsistent: .eq() on a citext column in some places,
//     .ilike() in others. .ilike() treats % and _ in the VALUE as wildcards,
//     and _ is legal in an address — so foo_bar@x.com could match fooXbar@x.com.
//     citext already compares case-insensitively; ilike was both unnecessary
//     and wrong.
//   - Name splitting was reimplemented six times, writing last_name as ''
//     in two places and null in the rest.
//   - Nothing recorded how a person came to exist.
//
// The rules here, which are the point of the file:
//
//   1. Creation is never implicit. A caller that wants a row asks for one
//      with create: true; everything else gets a miss and decides for itself.
//   2. Matching is deterministic. Oldest non-deleted row wins, ordered
//      explicitly, limited to one. Duplicates can never raise.
//   3. Duplicates are counted and reported, so callers can log them and the
//      merge tool has something to find. We cannot add a unique index —
//      couples share an address and info@ is one mailbox for a whole
//      organisation — so the API enforces this with judgement, not the
//      database with a constraint.
//   4. Every created row records its source in person.created_via. Trivial
//      now, impossible to backfill later.
//
// Same pattern as connections.ts (Google tokens) and payment-accounts.ts
// (Stripe accounts) — both written after the same value drifted across
// several readers.

import { adminClient } from '../db.js';

/** How a person row came to exist. Stored on person.created_via. */
export type PersonSource =
  | 'manual' // someone typed it into Contacts
  | 'meet_booking' // a meeting was booked with this address
  | 'meet_invite' // added as an invitee / team member by a host
  | 'thread_enrolment' // public enrolment form
  | 'thread_participant' // an organiser added them to a thread
  | 'member_invite' // invited into the workspace
  | 'membership_join' // public membership signup
  | 'membership_purchase' // bought a membership product
  | 'app_link'; // an external app claimed/created via /apps links

const SOURCES: readonly PersonSource[] = [
  'manual',
  'meet_booking',
  'meet_invite',
  'thread_enrolment',
  'thread_participant',
  'member_invite',
  'membership_join',
  'membership_purchase',
  'app_link',
];

export function isPersonSource(v: unknown): v is PersonSource {
  return typeof v === 'string' && (SOURCES as readonly string[]).includes(v);
}

/**
 * Normalise an address for storage and comparison: trim, lowercase, drop
 * surrounding angle brackets that arrive from mail headers and calendar
 * attendee lists ("<marja@example.org>").
 *
 * Deliberately NOT a validity check — that belongs to zod at the route
 * boundary. This only makes two spellings of one address compare equal.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^<|>$/g, '').trim().toLowerCase();
  return t.length > 0 ? t : null;
}

/**
 * Split a display name into first/last the one way, so "Marja" is not
 * first_name:'Marja', last_name:'' in one table and last_name:null in
 * another. Empty string is never written — absent is null.
 */
export function splitPersonName(full: string | null | undefined): {
  first: string | null;
  last: string | null;
} {
  const t = (full ?? '').trim();
  if (!t) return { first: null, last: null };
  const parts = t.split(/\s+/);
  const first = parts[0] ?? null;
  const last = parts.length > 1 ? parts.slice(1).join(' ') : null;
  return { first, last };
}

export type ResolvePersonInput = {
  workspaceId: string;
  /** Raw address; normalised here. */
  email: string | null | undefined;
  /** Full display name — split if firstName/lastName are not given. */
  name?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  /** How this person came to us. Recorded on create. */
  source: PersonSource;
  /**
   * Create when nothing matches. Default false — a miss is a miss, and the
   * caller decides whether that is an error, a 404, or a row to make.
   */
  create?: boolean;
  /** Extra columns to set when creating. Never applied to a match. */
  extra?: Record<string, unknown> | undefined;
};

export type ResolvePersonResult =
  | {
      ok: true;
      personId: string;
      /** True when this call inserted the row. */
      created: boolean;
      /**
       * How many non-deleted rows in this workspace hold this address.
       * 1 is normal, 0 means we just created it, >1 means a duplicate is
       * already there and the oldest was returned.
       */
      matches: number;
      firstName: string | null;
    }
  | {
      ok: false;
      reason: 'invalid_email' | 'not_found' | 'create_failed';
      /** Postgres error message when reason is create_failed. */
      message?: string | undefined;
    };

/**
 * Match a person by (workspace, email), or create one when asked to.
 *
 * Matching is by normalised address on a citext column, oldest row first, so
 * the answer is stable and duplicates never raise. When more than one row
 * matches, the oldest is returned and `matches` says how many there were —
 * callers should log that, and the merge tool reads it.
 */
export async function resolvePerson(input: ResolvePersonInput): Promise<ResolvePersonResult> {
  const email = normaliseEmail(input.email);
  if (!email) return { ok: false, reason: 'invalid_email' };

  // Oldest-wins, explicitly ordered and limited. Never .maybeSingle() on a
  // column without a unique index — that is the PGRST116 trap this file
  // exists to close.
  const { data: rows, error: selErr } = await adminClient
    .from('person')
    .select('id, first_name')
    .eq('workspace_id', input.workspaceId)
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(25);

  if (selErr) {
    console.error('[resolvePerson] lookup failed', {
      code: selErr.code,
      message: selErr.message,
      workspace_id: input.workspaceId,
    });
    // A lookup failure must not silently become a create — that is how you
    // manufacture the duplicate you were trying to avoid.
    return { ok: false, reason: 'not_found' };
  }

  const matches = rows?.length ?? 0;
  if (matches > 0) {
    const first = rows![0]!;
    if (matches > 1) {
      console.warn('[resolvePerson] duplicate address', {
        workspace_id: input.workspaceId,
        matches,
        resolved_to: first.id,
        source: input.source,
      });
    }
    return {
      ok: true,
      personId: first.id as string,
      created: false,
      matches,
      firstName: (first.first_name as string | null) ?? null,
    };
  }

  if (!input.create) return { ok: false, reason: 'not_found' };

  const split = splitPersonName(input.name);
  const firstName = input.firstName ?? split.first;
  const lastName = input.lastName ?? split.last;

  const { data: created, error: insErr } = await adminClient
    .from('person')
    .insert({
      ...(input.extra ?? {}),
      workspace_id: input.workspaceId,
      email,
      first_name: firstName,
      last_name: lastName,
      created_via: input.source,
    })
    .select('id, first_name')
    .single();

  if (insErr || !created) {
    console.error('[resolvePerson] create failed', {
      code: insErr?.code,
      message: insErr?.message,
      details: insErr?.details,
      hint: insErr?.hint,
      workspace_id: input.workspaceId,
      source: input.source,
    });
    return { ok: false, reason: 'create_failed', message: insErr?.message };
  }

  return {
    ok: true,
    personId: created.id as string,
    created: true,
    matches: 0,
    firstName: (created.first_name as string | null) ?? null,
  };
}

/**
 * Convenience for the many callers that only want an id and treat every
 * failure the same way. Returns null instead of a result union.
 */
export async function resolvePersonId(
  input: ResolvePersonInput,
): Promise<string | null> {
  const r = await resolvePerson(input);
  return r.ok ? r.personId : null;
}
