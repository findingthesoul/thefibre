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

import { adminClient } from '../db.js';
import { rows } from './rows.js';
import { resolveRsvpEnabled } from './portal.js';

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
  // Throws on a failed read: an empty answer here blanks the whole portal.
  const data = rows(
    'portal: persons for email',
    await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('email', email)
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
        'id, thread_id, title, description, type, starts_at, ends_at, location, location_url, meeting_url, content, position, rsvp_enabled',
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

  for (const e of engagements ?? []) {
    const content = (e.content ?? {}) as { external_url?: string; file_url?: string };
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
      external_url: content.external_url ?? content.file_url ?? null,
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
    });
    byThread.set(e.thread_id as string, list);
  }

  return byThread;
}
