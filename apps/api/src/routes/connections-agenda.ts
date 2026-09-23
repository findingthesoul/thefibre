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
// The calendars this person picked (lib/agenda-calendars.ts), which default
// to the ones they own. And only their OWN token: this route never reads
// another user's calendar, even for an admin, because "who is in your day" is
// not a workspace-level fact.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsAgendaRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { userGoogleToken } from '../lib/connections.js';
import { listEvents } from '../lib/google/client.js';
import { normaliseEmail, resolvePerson } from '../lib/resolve-person.js';
import { profileFor } from '../lib/identity-profile.js';
import { safeTimeZone, zonedDayStart } from '../lib/free-time.js';
import { enabledCalendarIds } from '../lib/agenda-calendars.js';

export const connectionsAgendaRoutes = new Hono();

const DAY = 86_400_000;

/**
 * The same clock time, `n` days later, safely across a daylight-saving change.
 *
 * Adding n×24h to an instant lands an hour early or late on the two days a
 * year the clocks move, which would make "tomorrow" start at 23:00 or 01:00.
 * Landing at MIDDAY first absorbs that — a one-hour shift cannot move noon
 * into another date — and the caller then takes the day start of it.
 */
function offsetDays(from: Date, n: number, tz: string): Date {
  if (n === 0) return from;
  return new Date(zonedDayStart(from, tz).getTime() + n * DAY + 12 * 3_600_000);
}

const AgendaQuery = z.object({
  /** How many days forward. 1 = today. */
  days: z.coerce.number().int().min(1).max(14).default(1),
  /**
   * Start at the viewer's own midnight rather than at this moment, so the
   * WHOLE day comes back and the interface can show what has already
   * happened, greyed out but still there (Sjoerd, 2026-09-21).
   *
   * Opt-in rather than the default because the other caller of this shape —
   * a reminder, a count of what is left — means "from now", and silently
   * changing what `days=1` covers would change their answer too.
   */
  whole_day: z.coerce.boolean().default(false),
  /**
   * Which day to start on, counted from today in the viewer's own zone.
   * 0 = today, 1 = tomorrow. Only meaningful with `whole_day`, which is what
   * establishes where a day begins.
   *
   * Sjoerd, 2026-09-22: *"can you also show tomorrow (maybe even as the
   * calendar view...)"*.
   */
  offset_days: z.coerce.number().int().min(0).max(13).default(0),
});

/** Lowercase, punctuation to spaces — the same folding Connect's own
 *  detector uses, so "Rense  Bos" and "rense bos" are one name. Not a fuzzy
 *  match: this is only ever used to OFFER a person, never to pick one. */
function foldName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

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
  /**
   * People already on file whose NAME is the one the calendar gave, for an
   * attendee no address matched.
   *
   * Sjoerd, 2026-09-23, looking at somebody who exists in The Fibre and was
   * offered as a stranger: *"in fibre this person exist... but the TODAY
   * meeting does not recognize it."* He was right, and the reason is that a
   * person can have no email — this app has been able to create one since
   * v0.95.0 — while the agenda can only match on an address.
   *
   * It is OFFERED, never applied. Matching a calendar name to a contact is a
   * guess, and the rule this codebase keeps is that a guess may be shown to
   * somebody and never acted on for them (handbook §12). The interface asks
   * "is this them?" and a person answers.
   *
   * It also prevents the worse half: without it, pressing add on a name
   * already on file makes a SECOND copy of that person.
   */
  same_name: { id: string; name: string }[];
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

  // The viewer's own midnight, in the viewer's own zone — not the server's,
  // which is UTC and two hours into an Amsterdam summer day.
  const now = new Date();
  const tz = parsed.data.whole_day
    ? safeTimeZone((await profileFor(ctx.userId)).timezone)
    : null;
  const from = tz ? zonedDayStart(offsetDays(now, parsed.data.offset_days, tz), tz) : now;
  const to = new Date((tz ? from.getTime() : now.getTime()) + parsed.data.days * DAY);

  let events;
  try {
    // Only the calendars this person chose. Resolving the choice costs the
    // calendarList call listEvents would have made anyway, and passing the
    // ids means it does not make it twice.
    events = await listEvents(token, from, to, 50, await enabledCalendarIds(token, ctx.workspaceId, ctx.userId));
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

  // The names the calendar gave for attendees NO address matched. Only those:
  // somebody already found by address needs no offering, and looking up a name
  // we do not need is a query nobody asked for.
  const unmatchedNames = new Set<string>();
  for (const ev of events) {
    for (const a of ev.attendees) {
      if (a.self) continue;
      const norm = normaliseEmail(a.email);
      if (!norm || byEmail.has(norm)) continue;
      const folded = foldName(a.name ?? '');
      if (folded) unmatchedNames.add(folded);
    }
  }

  // One read of the workspace's people, matched in memory — the same shape
  // the vocabulary route uses, and for the same reason: a name cannot be
  // matched in SQL the way it has to be folded here.
  const byName = new Map<string, { id: string; name: string }[]>();
  if (unmatchedNames.size) {
    const { data: all } = await adminClient
      .from('person')
      .select('id, first_name, last_name')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .limit(2000);
    for (const p of all ?? []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      const folded = foldName(name);
      if (!folded || !unmatchedNames.has(folded)) continue;
      const list = byName.get(folded) ?? [];
      // Three is enough to ask "is this them?"; a fourth is a merge problem,
      // not a question this row can carry.
      if (list.length < 3) list.push({ id: p.id as string, name });
      byName.set(folded, list);
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
        same_name: hit ? [] : (byName.get(foldName(a.name ?? '')) ?? []),
      });
    }
    return {
      id: ev.id,
      summary: ev.summary,
      start: ev.start.toISOString(),
      end: ev.end.toISOString(),
      all_day: ev.allDay,
      location: ev.location,
      /** The way in, when there is one. The interface turns it into a link
       *  the phone hands to Zoom, Teams or Meet (lib/meeting-links.ts). */
      conference_url: ev.conferenceUrl,
      people,
      /** How many of the room this workspace already knows. The number that
       *  tells you at a glance whether this meeting is with your community or
       *  with strangers. */
      known: people.filter((p) => p.person_id).length,
    };
  });

  return c.json({ connected: true, events: out });
});

// ── Adding one of them ─────────────────────────────────────────────────────
//
// Sjoerd, 2026-09-21: *"there I see people who are not yet in my contact
// list... Would be great if I could just click on their name and add people
// from this agenda."*
//
// This is the "interface offers it" half of the rule at the top of this file.
// Nothing is created by the sync; this is created by a person pressing a name
// they recognise, one at a time. `resolvePerson` stays the one way a person is
// made, so a second press — or two people pressing the same name in the same
// minute — returns the existing row rather than making a twin.
//
// The name comes from GOOGLE's attendee list, not from the client: the client
// sends the address it was shown and the server looks the display name up
// again. Otherwise this route would be a way to write any name onto any
// address in the workspace by pressing a button with a forged body.

const AddAttendee = z.object({
  email: z.string().email().max(320),
  /** How far ahead the agenda being looked at reaches — the same window, so
   *  the address is checked against the meetings actually on screen. */
  days: z.coerce.number().int().min(1).max(14).default(1),
});

connectionsAgendaRoutes.post('/agenda/person', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const body = AddAttendee.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const email = normaliseEmail(body.data.email);
  if (!email) return c.json({ error: 'invalid email' }, 400);

  const token = await userGoogleToken(ctx.userId);
  if (!token) return c.json({ error: 'no calendar connected' }, 400);

  const from = new Date();
  const to = new Date(from.getTime() + body.data.days * DAY);

  let events;
  try {
    events = await listEvents(token, from, to, 50, await enabledCalendarIds(token, ctx.workspaceId, ctx.userId));
  } catch (e) {
    console.warn('[connections/agenda] calendar read failed on add', e);
    return c.json({ error: 'calendar unavailable' }, 502);
  }

  // The address has to be in the agenda on screen. This is the whole
  // authorisation for the write: the person pressing it is being shown this
  // address because they are in a meeting with it.
  let name: string | null = null;
  let found = false;
  for (const ev of events) {
    for (const a of ev.attendees) {
      if (a.self) continue;
      if (normaliseEmail(a.email) !== email) continue;
      found = true;
      if (a.name && !name) name = a.name;
    }
  }
  if (!found) return c.json({ error: 'not in your agenda' }, 404);

  const resolved = await resolvePerson({
    workspaceId: ctx.workspaceId,
    email,
    name,
    source: 'calendar_attendee',
    create: true,
  });
  if (!resolved.ok) {
    console.error('[connections/agenda] add failed', resolved);
    return c.json({ error: resolved.reason, message: resolved.message }, 500);
  }

  return c.json({
    person_id: resolved.personId,
    /** False when they were already on file under a name you did not
     *  recognise — the interface says "already here" rather than "added". */
    created: resolved.created,
  });
});
