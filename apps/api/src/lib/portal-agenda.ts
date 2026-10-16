// What an agenda item IS, for the person it belongs to.
//
// Lifted out of routes/portal.ts on 2026-09-24 when the calendar subscription
// feed needed the same rows. The point of the move is that there is now more
// than one reader, and a second copy of this query would drift the moment
// somebody adds a field or tightens a filter on one of them — the portal page
// would show a session the feed omitted, or the other way round, and neither
// side would look wrong on its own.
//
// So: routes/portal.ts (the page) and lib/calendar-feed.ts (the subscription)
// both come through here, and there is one answer to "which sessions are
// this person's, and what do they say".

import { sessionHosts, threadHostsFor, type ThreadHost } from './main-facilitator.js';
import { adminClient } from '../db.js';
import { rows } from './rows.js';
import { personIdsForProvenEmail } from './proven-email.js';
import { resolveRsvpEnabled } from './portal.js';
import { releasedAt } from './document-release.js';

/**
 * WHO THIS IS — the scope every other query in the portal hangs off.
 *
 * One human is a `person` row in every workspace that knows them, so the
 * portal is keyed on the VERIFIED EMAIL, not on a person id. Everything the
 * visitor surfaces read runs on adminClient with RLS bypassed; this list is
 * what stands in its place. A query filtered by something else is a query
 * that can return somebody else's data.
 *
 * `person.email` is citext, so the match is already case-insensitive, and
 * participantEmailFromAuth lowercases regardless.
 */
export async function personsForEmail(email: string): Promise<
  { id: string; first_name: string | null; last_name: string | null; email: string }[]
> {
  // WHICH rows this address belongs to is decided in one place
  // (lib/proven-email.ts): the rows whose own `email` is it, plus the rows
  // carrying it as a PROVEN contact point. Asking `person.email` alone was
  // the merged-address lockout — tidy two records of one person into one and
  // the address that lost stops reaching its own portal.
  //
  // This widens ERASURE too, and that is deliberate rather than overlooked:
  // portal-erasure.ts builds its picture from this list, so without it a
  // person whose records were merged could not erase the data that moved,
  // which is the same lockout pointed the other way and the worse half of it.
  const ids = await personIdsForProvenEmail(email);
  if (!ids.length) return [];
  // Throws on a failed read: an empty answer here blanks the whole portal.
  const data = rows(
    'portal: persons for email',
    await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .in('id', ids)
      .is('deleted_at', null),
  );
  return data as { id: string; first_name: string | null; last_name: string | null; email: string }[];
}

export type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  /** A map link for the venue. Stored on the engagement all along and never
   *  published anywhere until the thread session found it missing from the
   *  public page (v0.68.62); the portal shows the same venue and had the
   *  same gap. Null is the ordinary case. */
  location_url: string | null;
  meeting_url: string | null;
  external_url: string | null;
  /**
   * Whether this item asks for an RSVP. Resolved server-side: the workspace
   * default, overridden per thread, overridden per ITEM, each level's NULL
   * meaning inherit. The client is told the answer, never the rule.
   */
  rsvp_enabled: boolean;
  /** This person's current answer. `null` is NO ANSWER, which is a third
   *  state and not the same as 'not_coming'. */
  rsvp: 'coming' | 'not_coming' | null;
  /** Who hosts this session, by name ("with Anna and Peter"). */
  hosts: string[];
  /** This person hosts it, when they are one of its ticked hosts — so the
   *  portal says "You're hosting", not a participant's line. */
  my_role: 'host' | 'facilitator' | null;
};

/**
 * Every published, in-agenda item of the given threads, with this person's
 * own RSVP on it.
 *
 * `personIds` is not decoration and it is not an optimisation: the visitor
 * portal runs on adminClient, so RLS is not filtering the rsvp read. That
 * filter IS what keeps one visitor's answers out of another's page. Never
 * call this with an unscoped id list.
 *
 * `droppedThreads` are threads the person has left. They still SEE them — the
 * record of having taken part is theirs — but the item stops asking for an
 * answer, matching the write path's refusal.
 */
export async function loadAgendaByThread(args: {
  threadIds: string[];
  personIds: string[];
  droppedThreads: ReadonlySet<string>;
  /** The visitor's verified address, to recognise them among a session's
   *  hosts. Omitted = nobody is recognised. */
  email?: string | null;
}): Promise<Map<string, AgendaItem[]>> {
  const byThread = new Map<string, AgendaItem[]>();
  if (!args.threadIds.length || !args.personIds.length) return byThread;

  // An item asks only when its own switch is on (lib/portal.ts
  // resolveRsvpEnabled). Two queries stood here — the thread's override and
  // the workspace default — and both are gone with the inheritance chain
  // they served.
  const engagements = rows(
    'portal: agenda engagements',
    await adminClient
      .from('thread_engagement')
      .select(
        'id, thread_id, title, description, type, starts_at, ends_at, location, location_url, meeting_url, content, position, rsvp_enabled, excluded_people',
      )
      .in('thread_id', args.threadIds)
      .eq('status', 'published')
      .eq('show_in_agenda', true)
      .order('position', { ascending: true }),
  );

  // This person's own answers. Scoped by person_id exactly as everything
  // else here is — a visitor has no RLS identity in these workspaces.
  const rsvps = rows(
    'portal: rsvps',
    await adminClient.from('thread_rsvp').select('engagement_id, response').in('person_id', args.personIds),
  );
  const answerByEngagement = new Map(
    rsvps.map((r) => [r.engagement_id as string, r.response as 'coming' | 'not_coming']),
  );

  // Hosts by thread, one read; a failure names nobody rather than failing
  // the agenda.
  const hostsByThread = await threadHostsFor(args.threadIds).catch(() => new Map<string, ThreadHost[]>());
  const me = args.email?.trim().toLowerCase() || null;

  // A DOCUMENT step's link waits for its release to this person (Sjoerd,
  // 2026-10-16), exactly as on the community page and Files: until the
  // thread's own trigger has sent it, the schedule shows its title and date
  // and no link. One reader for all three (lib/document-release.ts).
  const docIds = (engagements ?? []).filter((e) => e.type === 'document').map((e) => e.id as string);
  const released = await releasedAt(docIds, args.personIds);

  for (const e of engagements ?? []) {
    const content = (e.content ?? {}) as { external_url?: string; file_url?: string };
    const link = e.type === 'document' && !released.has(e.id as string) ? null : content.external_url ?? content.file_url ?? null;
    const ticked = sessionHosts(hostsByThread.get(e.thread_id as string) ?? [], e.excluded_people as string[] | null);
    const mine = me ? ticked.find((h) => h.email === me) : undefined;
    const list = byThread.get(e.thread_id as string) ?? [];
    list.push({
      id: e.id as string,
      title: e.title as string,
      description: (e.description as string | null) ?? null,
      type: e.type as string,
      starts_at: (e.starts_at as string | null) ?? null,
      ends_at: (e.ends_at as string | null) ?? null,
      location: (e.location as string | null) ?? null,
      location_url: (e.location_url as string | null) ?? null,
      meeting_url: (e.meeting_url as string | null) ?? null,
      external_url: link,
      // One resolver, shared with the write path and the organiser panel.
      // A dropped participant is refused separately: they still SEE the
      // thread, they just stop answering for it.
      rsvp_enabled:
        !args.droppedThreads.has(e.thread_id as string) &&
        resolveRsvpEnabled({
          item: e.rsvp_enabled as boolean | null,
          hasStart: !!e.starts_at,
        }),
      rsvp: answerByEngagement.get(e.id as string) ?? null,
      hosts: ticked.map((h) => h.name),
      my_role: mine?.role ?? null,
    });
    byThread.set(e.thread_id as string, list);
  }

  return byThread;
}
