// "Remove my data", from the visitor's own page.
//
// Sjoerd, 2026-09-25, asking the question that decides the whole design:
// *"what happens if someone requests removal but they have a seat / are
// organising threads in the future?"*
//
// The answer is that those are two different people wearing one email
// address, and the portal must not confuse them.
//
// ---------------------------------------------------------------------------
// THREE ANSWERS, NOT ONE
// ---------------------------------------------------------------------------
// What the portal is looking at is a PARTICIPANT: `person` rows, one per
// workspace that knows this email, carrying enrolments, tickets, bookings and
// memberships. That is what a removal request is about.
//
// The same human may also hold a SEAT — a `user` row, a workspace, threads
// they run with other people enrolled in them. Erasing that is not the same
// act at all: it reaches into other people's records. Their certificates name
// this organiser. Their invitations came from this address. Their places
// depend on threads that would have nobody behind them.
//
// And some of it cannot be erased by anybody, because the law that grants the
// right also constrains it (Art. 17(3)(b)): an invoice is a fiscal record and
// is kept for its statutory period regardless of who asks.
//
// So this file does three things and refuses to pretend otherwise:
//
//   1. It always ACCEPTS the request. You cannot decline to receive an
//      erasure request, and the thirty-day clock starts on arrival.
//   2. It tells the person, BEFORE they confirm, what will go, what is kept
//      by law, and what is blocked by the fact that other people depend on
//      it. Finding that out afterwards is how a right becomes a grievance.
//   3. It leaves the doing to a human. The actual erasure across append-only
//      tables is anonymisation with a design behind it
//      (docs/data-protection-approach.md §3.7), and half-automating it would
//      be worse than a request somebody reads.
// ---------------------------------------------------------------------------

import { adminClient } from '../db.js';
import { personsForEmail } from './portal-agenda.js';

export type ErasurePicture = {
  /** An erasure request already in flight, so a second press does not file a
   *  second one and the person can see it is in hand. */
  pending: { id: string; requested_at: string; due_at: string } | null;
  /** What a removal is ABOUT: the participant side. */
  removes: { workspaces: number; enrolments: number; bookings: number; memberships: number };
  /** Kept whatever anyone asks, and named so nobody is surprised later. */
  kept: { invoices: number };
  /**
   * Why this cannot simply happen, when it cannot. Empty for the ordinary
   * case — most people asking this are participants and nothing else.
   */
  blocked: {
    /** Threads this person RUNS that have not finished. */
    upcoming_threads: number;
    /** People enrolled in them, whose places depend on this account. */
    participants_affected: number;
    /** Workspaces where the blocked threads live, by name, so the message can
     *  be specific rather than ominous. EMPTY when nothing is blocked — it
     *  used to list every workspace the person had ever signed in to, which
     *  is true of anyone who has used the portal at all and would have read,
     *  to the next person to use this field, as "they have a seat here". */
    workspaces: string[];
  };
};

export async function erasurePicture(email: string): Promise<ErasurePicture> {
  const persons = await personsForEmail(email);
  const personIds = persons.map((p) => p.id);

  const [pending, participant, obligations, organiser] = await Promise.all([
    pendingRequest(personIds),
    participantFootprint(personIds, email),
    invoiceCount(personIds, email),
    organiserFootprint(email),
  ]);

  return {
    pending,
    removes: { workspaces: persons.length, ...participant },
    kept: { invoices: obligations },
    blocked: organiser,
  };
}

async function pendingRequest(personIds: string[]) {
  if (!personIds.length) return null;
  const { data } = await adminClient
    .from('data_subject_request')
    .select('id, requested_at, due_at, status')
    .in('person_id', personIds)
    .eq('type', 'erasure')
    .in('status', ['received', 'in_progress'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        id: data.id as string,
        requested_at: data.requested_at as string,
        due_at: data.due_at as string,
      }
    : null;
}

async function participantFootprint(personIds: string[], email: string) {
  if (!personIds.length) return { enrolments: 0, bookings: 0, memberships: 0 };
  const [enrolments, byPerson, byEmail, memberships] = await Promise.all([
    adminClient.from('thread_enrolment').select('id', { count: 'exact', head: true }).in('person_id', personIds),
    adminClient.from('meet_booking').select('id', { count: 'exact', head: true }).in('invitee_person_id', personIds),
    adminClient.from('meet_booking').select('id', { count: 'exact', head: true }).eq('invitee_email', email),
    adminClient.from('membership_member').select('id', { count: 'exact', head: true }).in('person_id', personIds).is('deleted_at', null),
  ]);
  return {
    enrolments: enrolments.count ?? 0,
    // Deliberately the larger of the two rather than a sum: the dual keys
    // overlap, and a count that double-counts a booking is a number the
    // person can catch us being wrong about.
    bookings: Math.max(byPerson.count ?? 0, byEmail.count ?? 0),
    memberships: memberships.count ?? 0,
  };
}

async function invoiceCount(personIds: string[], email: string): Promise<number> {
  const [byPerson, byEmail] = await Promise.all([
    personIds.length
      ? adminClient.from('purchase').select('id', { count: 'exact', head: true }).in('person_id', personIds)
      : Promise.resolve({ count: 0 }),
    adminClient.from('purchase').select('id', { count: 'exact', head: true }).eq('payer_email', email),
  ]);
  return Math.max(byPerson.count ?? 0, byEmail.count ?? 0);
}

/**
 * The seat side. `user` rows carry the email directly — one per workspace —
 * and an organiser's threads hang off `thread_organiser`.
 *
 * "Upcoming" is judged on the PROGRAMME's end date, falling back to its
 * start: a thread that finished last year has nobody depending on it, and
 * counting it would make an ordinary request look catastrophic.
 */
async function organiserFootprint(email: string): Promise<ErasurePicture['blocked']> {
  const empty = { upcoming_threads: 0, participants_affected: 0, workspaces: [] as string[] };

  // `user` unquoted. PostgREST addresses it by plain name; `'"user"'` 404s
  // with PGRST205 and, because every failure here returns an empty list, the
  // whole organiser check would have silently reported "nothing blocks this"
  // for every organiser on the platform. Caught by running the select, which
  // is the only thing that reads these strings.
  const { data: users } = await adminClient
    .from('user')
    .select('id, workspace_id, workspace:workspace_id (name)')
    .eq('email', email)
    .is('deleted_at', null);
  if (!users?.length) return empty;

  const workspaces = [
    ...new Set(
      users
        .map((u) => (one(u.workspace) as { name: string } | null)?.name)
        .filter((n): n is string => !!n),
    ),
  ];

  const { data: organisers } = await adminClient
    .from('thread_organiser')
    .select('id')
    .in('user_id', users.map((u) => u.id as string));
  if (!organisers?.length) return empty;

  const today = new Date().toISOString().slice(0, 10);
  const { data: threads } = await adminClient
    .from('thread_thread')
    .select('id, program:program_id (starts_on, ends_on)')
    .in('organiser_id', organisers.map((o) => o.id as string));

  const upcoming = (threads ?? []).filter((t) => {
    const p = one(t.program) as { starts_on: string | null; ends_on: string | null } | null;
    const last = p?.ends_on ?? p?.starts_on ?? null;
    // No dates at all counts as upcoming: an undated thread is a live plan,
    // not a finished one, and guessing it away is the wrong direction to err.
    return !last || last >= today;
  });
  if (!upcoming.length) return empty;

  const { count } = await adminClient
    .from('thread_enrolment')
    .select('id', { count: 'exact', head: true })
    .in('thread_id', upcoming.map((t) => t.id as string));

  return {
    upcoming_threads: upcoming.length,
    participants_affected: count ?? 0,
    workspaces,
  };
}

/**
 * File it. One request per person row, because each workspace is its own
 * controller and each has to answer for its own copy — a single request
 * against one of them would leave the others holding data nobody was told
 * to remove.
 *
 * Never refuses. A request that is blocked is still a request: it is
 * recorded, the clock runs, and the note says what stands in the way so
 * whoever picks it up is not re-deriving it.
 */
export async function fileErasureRequest(args: {
  email: string;
  reason?: string | null;
}): Promise<ErasurePicture> {
  const picture = await erasurePicture(args.email);
  if (picture.pending) return picture;

  const persons = await personsForEmail(args.email);
  if (!persons.length) return picture;

  const note = erasureNote({ ...picture, reason: args.reason ?? null });

  await adminClient.from('data_subject_request').insert(
    persons.map((p) => ({ person_id: p.id, type: 'erasure', notes: note.slice(0, 2000) })),
  );

  return await erasurePicture(args.email);
}

/**
 * What the person handling this needs to know, in one paragraph.
 *
 * Its own function because it is the only part of erasure that is pure — and
 * because the blocked sentence is the answer to the question that prompted
 * all of this. Whoever opens the request should not have to re-derive that
 * erasing this account removes somebody else's organiser.
 */
export function erasureNote(args: {
  blocked: ErasurePicture['blocked'];
  kept: ErasurePicture['kept'];
  reason: string | null;
}): string {
  return [
    'Requested from the visitor portal.',
    args.reason?.trim() ? `Their words: ${args.reason.trim()}` : null,
    args.blocked.upcoming_threads
      ? `BLOCKED: also organises ${args.blocked.upcoming_threads} unfinished thread(s) with ${args.blocked.participants_affected} enrolment(s)${
          args.blocked.workspaces.length ? ` in ${args.blocked.workspaces.join(', ')}` : ''
        }. Hand over or close those first — erasing this account removes other people's organiser.`
      : null,
    args.kept.invoices
      ? `${args.kept.invoices} invoice(s) are kept regardless (Art. 17(3)(b), fiscal retention).`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
}

const one = <T>(v: unknown): T | null =>
  !v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T);
