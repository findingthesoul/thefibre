// Today's calendar, with the people in it already found.
//
// Sjoerd, 2026-09-12: *"would be great if the app — when you open it — based
// on agenda — can pre select people from the DB, that are named in the
// agenda"*. Build-order step 5 arriving from the useful end: open the app in
// the morning and it already knows who today is about.
//
// ── Why this is the cheap one ───────────────────────────────────────────────
//
// A calendar attendee is an EMAIL ADDRESS, not a name. That is the whole
// reason this is safe where matching names in note text is not: an address is
// exact, so there is no fuzzy match to get wrong and no risk of attaching a
// stranger to somebody's record because they share a first name. Both Google
// scopes are already granted, so this adds no consent step.
//
// ── Nothing is created ──────────────────────────────────────────────────────
//
// This is a READ. An attendee with no person row comes back as unmatched,
// with their email, and stops there. `resolvePerson()` is the one way a
// person is ever made in this codebase and its first rule is that creation is
// never implicit — a calendar sync that quietly created a person for every
// address in every meeting would fill the workspace with airline booking
// robots and conference-room accounts inside a week. Adding one is a decision
// somebody makes on purpose, and the interface offers it rather than doing it.
//
// ── Whose meetings ─────────────────────────────────────────────────────────
//
// Only calendars the signed-in person owns, filtered in listEvents(). And
// only their OWN token: this route never reads another user's calendar, even
// for an admin, because "who is in your day" is not a workspace-level fact.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsAgendaRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { userGoogleToken } from '../lib/connections.js';
import { listEvents } from '../lib/google/client.js';
import { normaliseEmail } from '../lib/resolve-person.js';

export const connectionsAgendaRoutes = new Hono();

const DAY = 86_400_000;

const AgendaQuery = z.object({
  /** How many days forward. 1 = the rest of today. */
  days: z.coerce.number().int().min(1).max(14).default(1),
});

type Matched = {
  email: string;
  /** The name Google had, kept for an unmatched attendee so the interface can
   *  offer to add a person with something better than an address. */
  calendar_name: string | null;
  person_id: string | null;
  person_name: string | null;
  /** Their standing, so the row can say "came once" next to a name. */
  rung: string | null;
  /** When a note about them was last committed — the thing this surface
   *  exists to produce more of. */
  last_note_at: string | null;
};

connectionsAgendaRoutes.get('/agenda', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const parsed = AgendaQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'invalid query' }, 400);

  const token = await userGoogleToken(ctx.userId);
  // Not an error. Most people will not have connected a calendar, and a 500
  // for "you have not connected one" would make the whole Today page look
  // broken over an optional integration.
  if (!token) return c.json({ connected: false, events: [] });

  const from = new Date();
  const to = new Date(from.getTime() + parsed.data.days * DAY);

  let events;
  try {
    events = await listEvents(token, from, to);
  } catch (e) {
    // A revoked token, a Google outage, a quota. Say so rather than pretending
    // the day is empty — an empty agenda and an unreachable one look identical
    // on screen and mean opposite things.
    console.warn('[connections/agenda] calendar read failed', e);
    return c.json({ connected: true, unavailable: true, events: [] });
  }

  // Every attendee address across every event, looked up in ONE query rather
  // than one per attendee. A day with six meetings of five people each is
  // thirty lookups done as one.
  const emails = new Set<string>();
  for (const ev of events) {
    for (const a of ev.attendees) {
      if (a.self) continue; // you are in your own meetings; that is not news
      const norm = normaliseEmail(a.email);
      if (norm) emails.add(norm);
    }
  }

  const byEmail = new Map<string, { id: string; name: string }>();
  if (emails.size) {
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .in('email', [...emails]);
    for (const p of people ?? []) {
      const norm = normaliseEmail(p.email as string | null);
      if (!norm || byEmail.has(norm)) continue; // oldest wins, like resolvePerson
      byEmail.set(norm, {
        id: p.id as string,
        name:
          [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
          (p.email as string) ||
          '',
      });
    }
  }

  const personIds = [...new Set([...byEmail.values()].map((p) => p.id))];

  // Standing and last conversation, both in one query each, both optional —
  // a row without them is still a row worth showing.
  const rungById = new Map<string, string>();
  const lastNoteById = new Map<string, string>();
  if (personIds.length) {
    const [{ data: land }, { data: notes }] = await Promise.all([
      adminClient.rpc('connections_landscape', { p_workspace: ctx.workspaceId }),
      adminClient
        .from('flow_run_note')
        .select('person_id, happened_at')
        .eq('workspace_id', ctx.workspaceId)
        .in('person_id', personIds)
        .eq('is_draft', false)
        .is('deleted_at', null)
        .in('kind', ['call', 'meeting', 'message', 'note'])
        .order('happened_at', { ascending: false })
        .limit(500),
    ]);
    for (const r of (land ?? []) as { person_id: string; rung: string }[]) {
      if (personIds.includes(r.person_id)) rungById.set(r.person_id, r.rung);
    }
    for (const n of (notes ?? []) as { person_id: string; happened_at: string }[]) {
      // Ordered newest first, so the first one seen per person is the latest.
      if (!lastNoteById.has(n.person_id)) lastNoteById.set(n.person_id, n.happened_at);
    }
  }

  const out = events.map((ev) => {
    const people: Matched[] = [];
    for (const a of ev.attendees) {
      if (a.self) continue;
      const norm = normaliseEmail(a.email);
      if (!norm) continue;
      const hit = byEmail.get(norm);
      people.push({
        email: norm,
        calendar_name: a.name,
        person_id: hit?.id ?? null,
        person_name: hit?.name ?? null,
        rung: hit ? (rungById.get(hit.id) ?? null) : null,
        last_note_at: hit ? (lastNoteById.get(hit.id) ?? null) : null,
      });
    }
    return {
      id: ev.id,
      summary: ev.summary,
      start: ev.start.toISOString(),
      end: ev.end.toISOString(),
      all_day: ev.allDay,
      location: ev.location,
      people,
      /** How many of the room this workspace already knows. The number that
       *  tells you at a glance whether this meeting is with your community or
       *  with strangers. */
      known: people.filter((p) => p.person_id).length,
    };
  });

  return c.json({ connected: true, events: out });
});
