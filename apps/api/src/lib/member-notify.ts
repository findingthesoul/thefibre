// Telling members about their team calendars (item 3, 2026-10-14).
//
// Sjoerd: "if a new event is added to a certain agenda, a follower of that
// agenda gets a message, email and notification."
//
// A FOLLOWER of a team calendar is anybody whose active or grace membership
// carries it — by the tier or by a product (teamCalendarEntitlements, the walk
// that also decides what they are charged). There is no separate follow
// button: the membership is the subscription.
//
// TWO TRIGGERS, and they are deliberately not alike:
//
//   NEW THREAD — automatic. A thread appearing on a calendar (the same
//   visibility rule as the Upcoming list, `calendarVisible`) is the organiser
//   publishing, which is already a decision. Fires once per person and thread,
//   EVER (a unique index), and never for a thread that was already visible
//   when this shipped: the first pass records what is there and tells nobody.
//
//   A SESSION MOVED OR CANCELLED — only when the organiser presses SEND on
//   the thread's calendar changes. Sjoerd's rule for those, written in
//   lib/calendar-invite.ts: "editing is not announcing". Nothing here watches
//   an edit. Enrolled participants get an in-app row only — the same press
//   already sent them the calendar update by email, and a second email about
//   one change is noise. Followers who are NOT enrolled get the row and the
//   digest. Past sessions notify nobody.
//
// THE EMAIL is one per PERSON per community, after 15 quiet minutes: an
// organiser loading a year's agenda in one sitting makes thirty threads, and
// that must be one email listing thirty, not thirty emails. (Person is already
// one workspace's, so "per person" is per person per community.)
//
// THE SWITCHES: the community's (Members → Settings, default on) stops all of
// it — threads published while it is off are still marked seen, so switching
// it back on does not announce a restructure. The person's own (my.thread, and
// a link in every email) stops the email and keeps the in-app list.

import { randomBytes } from 'node:crypto';
import { communityWords, memberEmailValues } from './member-email-templates.js';
import { adminClient } from '../db.js';
import { calendarVisible, couldJoinByMember, entitlementsByMember, teamOpen, type CouldJoin } from './could-join.js';
import { audienceTeams } from './thread-teams.js';
import { loadThreadDates } from './thread-dates.js';
import { placesByThread } from './place-state.js';
import { getSetting, setSetting } from './platform-settings.js';
import { stackSurfaceUrl } from './stack-urls.js';
import { getWorkspaceBrand, senderOf } from './workspace-brand.js';
import { sendEmail } from './email/client.js';
import { platformEmailLocale } from './email/platform-i18n.js';
import { greetingName } from './email/membership-templates.js';
import { memberNotifyDigest, type DigestItem } from './email/member-notify-templates.js';
import type { PendingChange } from './calendar-invite.js';

export const QUIET_MS = 15 * 60 * 1000;
/** More newly visible threads than this in one community in one pass are
 *  held, not announced (the circuit breaker in runNewThreadPass). */
export const HOLD_ABOVE = 20;
const BASELINE_KEY = 'member_notify_baseline_at';

const one = <T>(v: unknown): T | null =>
  !v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T);

const THREAD_SELECT =
  'id, workspace_id, team_id, public_enrolment_open, team:team_id (is_published, is_active), program:program_id (title, status, starts_on, ends_on)';

type CalendarTeam = { id: string; is_published: boolean | null; is_active: boolean | null };

/** The calendars each thread is on: its owner AND the teams it is offered to
 *  (lib/thread-teams.ts — the one reader), as team rows so visibility can be
 *  judged on them. A thread offered to a team is announced to that team's
 *  followers exactly as an owned one. */
async function calendarsOf(threads: Record<string, unknown>[]): Promise<Map<string, CalendarTeam[]>> {
  const owners = new Map(threads.map((t) => [t.id as string, (t.team_id as string | null) ?? null]));
  const audience = await audienceTeams([...owners.keys()], owners);
  const teamIds = [...new Set([...audience.values()].flatMap((s) => [...s]))];
  const byId = new Map<string, CalendarTeam>();
  if (teamIds.length) {
    const { data, error } = await adminClient.from('team').select('id, is_published, is_active').in('id', teamIds);
    if (error) throw new Error(`calendar teams: ${error.message}`);
    for (const r of data ?? []) byId.set(r.id as string, r as CalendarTeam);
  }
  return new Map(
    [...audience].map(([id, teams]) => [id, [...teams].map((x) => byId.get(x)).filter((x): x is CalendarTeam => !!x)]),
  );
}

/** Everybody who follows ANY of these (showing) calendars, once each. */
function fansOf(followers: Map<string, Set<string>>, teams: CalendarTeam[]): Set<string> {
  const out = new Set<string>();
  for (const tm of teams) if (teamOpen(tm)) for (const p of followers.get(tm.id) ?? []) out.add(p);
  return out;
}

type NotificationRow = {
  workspace_id: string;
  person_id: string;
  kind: 'new_thread' | 'session_added' | 'session_moved' | 'session_cancelled';
  thread_id: string;
  subject: string;
  starts_at: string | null;
  email_state: 'pending' | 'none';
};

/** The community's switch. No settings row = the default, on. */
export async function notifyMembersOn(workspaceId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from('membership_settings')
    .select('notify_members')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  // FAILS CLOSED. A read that failed is not a community that said yes: a
  // pooler blip must never count as "on" and announce on their behalf.
  if (error) throw new Error(`notify switch for ${workspaceId}: ${error.message}`);
  return (data?.notify_members as boolean | null | undefined) !== false;
}

/** Who follows each team calendar in a community: person ids, by team id. */
export async function followersByTeam(workspaceId: string): Promise<Map<string, Set<string>>> {
  const { data: members } = await adminClient
    .from('membership_member')
    .select('id, person_id, workspace_id')
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'grace'])
    .is('deleted_at', null);
  const list = ((members ?? []) as { id: string; person_id: string | null; workspace_id: string }[]).filter(
    (m) => m.person_id,
  );
  const entitlements = await entitlementsByMember(list);
  const out = new Map<string, Set<string>>();
  for (const m of list) {
    for (const e of entitlements.get(m.id) ?? []) {
      const set = out.get(e.teamId) ?? new Set<string>();
      set.add(m.person_id as string);
      out.set(e.teamId, set);
    }
  }
  return out;
}

/** Everybody who has ANY place on a thread, held or not: none of them is
 *  told the thread is "new". */
async function personsWithAPlace(threadId: string): Promise<Map<string, string | null>> {
  const { data, error } = await adminClient
    .from('thread_enrolment')
    .select('person_id, enrolment:enrolment_id (status)')
    .eq('thread_id', threadId);
  // Throw: an empty answer would tell people who already hold a place that
  // the thread is new, and would leave participants out of a SEND.
  if (error) throw new Error(`places on ${threadId}: ${error.message}`);
  const out = new Map<string, string | null>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    out.set(r.person_id as string, (one(r.enrolment) as { status?: string | null } | null)?.status ?? null);
  }
  return out;
}

/** Insert, and treat "already told about this thread" as done. The once-ever
 *  rule is a partial unique index, which PostgREST's upsert cannot target, so
 *  a batch that collides falls back to one row at a time. */
async function insertNotifications(rows: NotificationRow[]): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await adminClient.from('member_notification').insert(rows);
  if (!error) return rows.length;
  if (error.code !== '23505') throw new Error(`member_notification insert: ${error.message}`);
  let n = 0;
  for (const r of rows) {
    const { error: e } = await adminClient.from('member_notification').insert(r);
    if (!e) n += 1;
    else if (e.code !== '23505') throw new Error(`member_notification insert: ${e.message}`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// NEW ON THE CALENDAR
// ---------------------------------------------------------------------------

/** One pass: find threads newly visible on a team calendar and tell their
 *  followers. The first pass ever only records the baseline. */
export async function runNewThreadPass(
  now: Date = new Date(),
  /** Tests only: one workspace, and a baseline key of its own, so a test
   *  never moves staging's real baseline or announces somebody else's thread. */
  scope: { workspaceIds?: string[]; baselineKey?: string } = {},
): Promise<{ baseline: number; announced: number; told: number; held: number }> {
  let query = adminClient
    .from('thread_thread')
    .select(THREAD_SELECT)
    // No "has an owner team" filter any more: a workspace thread OFFERED to a
    // team is on that team's calendar. One with no team at all has no
    // calendar, and calendarsOf gives it none, so it is still never visible.
    .or('public_enrolment_open.is.null,public_enrolment_open.eq.true');
  if (scope.workspaceIds) query = query.in('workspace_id', scope.workspaceIds);
  const { data, error } = await query;
  if (error) throw new Error(`calendar threads: ${error.message}`);
  const all = (data ?? []) as Record<string, unknown>[];
  const [datesById, calendars] = await Promise.all([loadThreadDates(all.map((t) => t.id as string)), calendarsOf(all)]);
  const visible = all.filter((t) =>
    calendarVisible(t, datesById.get(t.id as string), now, calendars.get(t.id as string) ?? []),
  );
  if (!visible.length) return { baseline: 0, announced: 0, told: 0, held: 0 };

  const seen = new Set<string>();
  const ids = visible.map((t) => t.id as string);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rows, error: seenErr } = await adminClient
      .from('thread_calendar_seen')
      .select('thread_id')
      .in('thread_id', ids.slice(i, i + 200));
    // THROW, never carry on. An empty answer here would make every thread
    // that has been on the calendar all along look new — and announce it to
    // every follower. A failed tick is a quiet tick; the next one retries.
    if (seenErr) throw new Error(`seen threads: ${seenErr.message}`);
    for (const r of rows ?? []) seen.add(r.thread_id as string);
  }
  const unseen = visible.filter((t) => !seen.has(t.id as string));
  if (!unseen.length) return { baseline: 0, announced: 0, told: 0, held: 0 };

  // THE BASELINE. The first deploy anywhere must email nobody about threads
  // that have been on the calendar all along.
  const baselineKey = scope.baselineKey ?? BASELINE_KEY;
  const baselineAt = await getSetting<string | null>(baselineKey, null);
  // (getSetting answers its fallback, null, when the read fails — which lands
  // HERE and records a baseline: the failure goes the quiet way.)
  if (!baselineAt) {
    const { error: baseErr } = await adminClient.from('thread_calendar_seen').upsert(
      unseen.map((t) => ({ thread_id: t.id as string, workspace_id: t.workspace_id as string, announced: false })),
      { onConflict: 'thread_id', ignoreDuplicates: true },
    );
    // The key is written ONLY after the rows are: a baseline recorded with no
    // seen rows behind it would make the next tick announce everything.
    if (baseErr) throw new Error(`baseline seen rows: ${baseErr.message}`);
    await setSetting(baselineKey, now.toISOString());
    return { baseline: unseen.length, announced: 0, told: 0, held: 0 };
  }

  let announced = 0;
  let told = 0;
  let heldCount = 0;
  const byWorkspace = new Map<string, Record<string, unknown>[]>();
  for (const t of unseen) {
    const list = byWorkspace.get(t.workspace_id as string) ?? [];
    list.push(t);
    byWorkspace.set(t.workspace_id as string, list);
  }
  for (const [ws, threads] of byWorkspace) {
    let on: boolean;
    try {
      on = await notifyMembersOn(ws);
    } catch (e) {
      // This community is skipped this tick, nothing written: its threads
      // stay unseen and are judged again next time, with a working read.
      console.error('[member-notify] skipped a workspace this tick', ws, e);
      continue;
    }
    // THE CIRCUIT BREAKER. More than HOLD_ABOVE threads newly visible in one
    // community in one pass is far more likely to be an import, a restore or
    // a bug than an organiser's sitting — and an accidental announcement to a
    // whole community cannot be taken back. They are recorded as seen and
    // NOT announced; a quiet miss is the cheap failure. (Coordinator review,
    // 2026-10-14.)
    const held = threads.length > HOLD_ABOVE;
    if (held) {
      console.warn(`[member-notify] held ${threads.length} threads for ${ws}`);
    }
    // Seen FIRST, whether or not anybody is told: a thread published while
    // the switch is off, or held, stays unannounced for good.
    const { error: seenWriteErr } = await adminClient.from('thread_calendar_seen').upsert(
      threads.map((t) => ({
        thread_id: t.id as string,
        workspace_id: ws,
        announced: on && !held,
        // Marked, so an admin can decide (heldThreads / announceHeld). Only
        // a HOLD is marked: a thread published while the switch is off was
        // a decision already, and is never offered again.
        held_at: on && held ? now.toISOString() : null,
      })),
      { onConflict: 'thread_id', ignoreDuplicates: true },
    );
    // Nobody is told about a thread that could not be marked seen: the
    // next tick would tell them again, which the unique index catches only
    // per person — and it is the same "act without a record" mistake.
    if (seenWriteErr) {
      console.error('[member-notify] could not mark threads seen; telling nobody', ws, seenWriteErr.message);
      continue;
    }
    if (held) {
      heldCount += threads.length;
      continue;
    }
    if (!on) continue;
    const r = await announceThreads(ws, threads);
    announced += r.announced;
    told += r.told;
  }
  return { baseline: 0, announced, told, held: heldCount };
}

/** Tell a community's followers about these threads: the one fan-out, for
 *  the pass and for an admin's "Tell members now". Never somebody who holds a
 *  place; once per person and thread, by the unique index. */
async function announceThreads(
  ws: string,
  threads: Record<string, unknown>[],
): Promise<{ announced: number; told: number }> {
  const [followers, calendars] = await Promise.all([followersByTeam(ws), calendarsOf(threads)]);
  let announced = 0;
  let told = 0;
  for (const t of threads) {
    // Followers of every showing calendar it is on — owner and offered —
    // once each, however many of them a person follows.
    const fans = fansOf(followers, calendars.get(t.id as string) ?? []);
    if (!fans.size) continue;
    announced += 1;
    const placed = await personsWithAPlace(t.id as string);
    const program = one(t.program) as { title?: string; starts_on?: string | null } | null;
    told += await insertNotifications(
      [...fans]
        .filter((p) => !placed.has(p))
        .map((person_id) => ({
          workspace_id: ws,
          person_id,
          kind: 'new_thread' as const,
          thread_id: t.id as string,
          subject: program?.title ?? 'A new thread',
          starts_at: program?.starts_on ?? null,
          email_state: 'pending' as const,
        })),
    );
  }
  return { announced, told };
}

// ---------------------------------------------------------------------------
// HELD THREADS — the circuit breaker's catch, for an admin to decide
// ---------------------------------------------------------------------------

export type HeldThread = { thread_id: string; title: string; starts_on: string | null; held_at: string };

/** What the breaker held in this community and nobody has decided yet —
 *  only threads still on the calendar (one withdrawn since is not news). */
export async function heldThreads(ws: string, now: Date = new Date()): Promise<HeldThread[]> {
  const { data: seen, error } = await adminClient
    .from('thread_calendar_seen')
    .select('thread_id, held_at')
    .eq('workspace_id', ws)
    .not('held_at', 'is', null);
  if (error) throw new Error(`held threads: ${error.message}`);
  if (!seen?.length) return [];
  const { data: threads, error: tErr } = await adminClient
    .from('thread_thread')
    .select(THREAD_SELECT)
    .in('id', seen.map((r) => r.thread_id as string));
  if (tErr) throw new Error(`held thread rows: ${tErr.message}`);
  const heldAt = new Map(seen.map((r) => [r.thread_id as string, r.held_at as string]));
  const list = (threads ?? []) as Record<string, unknown>[];
  const datesById = await loadThreadDates(list.map((t) => t.id as string));
  return list
    .filter((t) => calendarVisible(t, datesById.get(t.id as string), now))
    .map((t) => {
      const program = one(t.program) as { title?: string; starts_on?: string | null } | null;
      return {
        thread_id: t.id as string,
        title: program?.title ?? '',
        starts_on: program?.starts_on ?? null,
        held_at: heldAt.get(t.id as string)!,
      };
    })
    .sort((a, b) => (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999'));
}

/** "Tell members now": announce every held thread still on the calendar.
 *  They land in each follower's pending rows, so the digest sends them as
 *  ONE email after the quiet window, like any sitting. The hold is cleared
 *  first, so a second press cannot announce twice (and the unique index
 *  would refuse it anyway). */
export async function announceHeld(ws: string, now: Date = new Date()): Promise<{ announced: number; told: number }> {
  if (!(await notifyMembersOn(ws))) return { announced: 0, told: 0 };
  const held = await heldThreads(ws, now);
  if (!held.length) return { announced: 0, told: 0 };
  const ids = held.map((h) => h.thread_id);
  const { error } = await adminClient
    .from('thread_calendar_seen')
    .update({ held_at: null, announced: true })
    .in('thread_id', ids)
    .eq('workspace_id', ws);
  if (error) throw new Error(`clear hold: ${error.message}`);
  const { data: threads, error: tErr } = await adminClient.from('thread_thread').select(THREAD_SELECT).in('id', ids);
  if (tErr) throw new Error(`held thread rows: ${tErr.message}`);
  return announceThreads(ws, (threads ?? []) as Record<string, unknown>[]);
}

/** "Don't announce": the hold is cleared and the threads stay unannounced
 *  for good. */
export async function dismissHeld(ws: string): Promise<number> {
  const { data, error } = await adminClient
    .from('thread_calendar_seen')
    .update({ held_at: null })
    .eq('workspace_id', ws)
    .not('held_at', 'is', null)
    .select('thread_id');
  if (error) throw new Error(`dismiss hold: ${error.message}`);
  return (data ?? []).length;
}

// ---------------------------------------------------------------------------
// SESSIONS MOVED OR CANCELLED — at the organiser's SEND
// ---------------------------------------------------------------------------

/** Who would hear about a SEND on this thread, for the dialog's reach line:
 *  participants (calendar update by email) and followers who are not
 *  participants (in-app and the digest). Zero followers while the community
 *  switch is off. */
export async function sendReach(threadId: string, now: Date = new Date()): Promise<{ participants: number; followers: number }> {
  const { data: t } = await adminClient.from('thread_thread').select(THREAD_SELECT).eq('id', threadId).maybeSingle();
  if (!t) return { participants: 0, followers: 0 };
  const placed = await personsWithAPlace(threadId);
  const participants = [...placed.values()].filter((s) => s !== 'dropped').length;
  const cal = (await calendarsOf([t])).get(threadId) ?? [];
  if (!calendarVisible(t, (await loadThreadDates([threadId])).get(threadId), now, cal)) return { participants, followers: 0 };
  // A count for a dialog: a failed switch read shows no followers rather
  // than taking the dialog down.
  const on = await notifyMembersOn(t.workspace_id as string).catch(() => false);
  if (!on) return { participants, followers: 0 };
  const fans = fansOf(await followersByTeam(t.workspace_id as string), cal);
  return { participants, followers: [...fans].filter((p) => !placed.has(p)).length };
}

/** Called when the organiser presses SEND, with the changes that press
 *  sends: a session added, moved or cancelled, for FUTURE sessions only.
 *  (`added` was left out until 2026-10-16, on the reasoning that its
 *  invitation already told participants; Sjoerd: participants hear about
 *  every change, in the bell as well.) A `people` change is the hosts'
 *  business and tells no one here.
 *
 *  THE COMMUNITY SWITCH GATES THE FOLLOWERS, NOT THE PARTICIPANTS.
 *  `notify_members` is a community's choice about telling its MEMBERS what
 *  appears on a calendar they follow. Somebody who holds a place in this
 *  thread is told because of the place, not the membership — before
 *  2026-10-16 a workspace with the switch off, or with no community at all,
 *  left them without the bell entry. Their rows carry email_state 'none':
 *  the organiser's SEND already emailed them. */
export async function notifyCalendarSend(
  threadId: string,
  changes: PendingChange[],
  now: Date = new Date(),
): Promise<number> {
  const relevant = changes
    .filter((c) => c.kind === 'added' || c.kind === 'moved' || c.kind === 'cancelled')
    .map((c) => ({
      kind:
        c.kind === 'added'
          ? ('session_added' as const)
          : c.kind === 'moved'
            ? ('session_moved' as const)
            : ('session_cancelled' as const),
      title: c.title,
      startsAt:
        c.kind === 'cancelled'
          ? (c.was?.starts_at ?? c.now_state?.starts_at ?? null)
          : (c.now_state?.starts_at ?? null),
    }))
    .filter((c) => !!c.startsAt && new Date(c.startsAt).getTime() > now.getTime());
  if (!relevant.length) return 0;

  const { data: t } = await adminClient.from('thread_thread').select(THREAD_SELECT).eq('id', threadId).maybeSingle();
  if (!t) return 0;
  const ws = t.workspace_id as string;

  const placed = await personsWithAPlace(threadId);
  const participants = [...placed.entries()].filter(([, s]) => s !== 'dropped').map(([p]) => p);
  let followers: string[] = [];
  const cal = (await calendarsOf([t])).get(threadId) ?? [];
  if (calendarVisible(t, (await loadThreadDates([threadId])).get(threadId), now, cal) && (await notifyMembersOn(ws))) {
    followers = [...fansOf(await followersByTeam(ws), cal)].filter((p) => !placed.has(p));
  }
  const threadTitle = (one(t.program) as { title?: string } | null)?.title ?? '';
  const rows: NotificationRow[] = [];
  for (const c of relevant) {
    const subject = threadTitle ? `${threadTitle} · ${c.title}` : c.title;
    for (const person_id of participants) {
      rows.push({ workspace_id: ws, person_id, kind: c.kind, thread_id: threadId, subject, starts_at: c.startsAt, email_state: 'none' });
    }
    for (const person_id of followers) {
      rows.push({ workspace_id: ws, person_id, kind: c.kind, thread_id: threadId, subject, starts_at: c.startsAt, email_state: 'pending' });
    }
  }
  return insertNotifications(rows);
}

// ---------------------------------------------------------------------------
// THE DIGEST
// ---------------------------------------------------------------------------

/** The person's email pref row, created with its unsubscribe token on first
 *  need. */
export async function ensurePref(
  personId: string,
  workspaceId: string,
): Promise<{ email_off: boolean; unsubscribe_token: string }> {
  const { data, error } = await adminClient
    .from('member_notification_pref')
    .select('email_off, unsubscribe_token')
    .eq('person_id', personId)
    .maybeSingle();
  // A failed read is not "no pref, so emails are on": it throws.
  if (error) throw new Error(`notification pref: ${error.message}`);
  if (data) return data as { email_off: boolean; unsubscribe_token: string };
  const fresh = { person_id: personId, workspace_id: workspaceId, email_off: false, unsubscribe_token: randomBytes(24).toString('hex') };
  await adminClient.from('member_notification_pref').upsert(fresh, { onConflict: 'person_id', ignoreDuplicates: true });
  const { data: again } = await adminClient
    .from('member_notification_pref')
    .select('email_off, unsubscribe_token')
    .eq('person_id', personId)
    .single();
  return again as { email_off: boolean; unsubscribe_token: string };
}

async function mark(ids: string[], state: 'sent' | 'skipped', at: Date) {
  if (!ids.length) return;
  await adminClient
    .from('member_notification')
    .update({ email_state: state, ...(state === 'sent' ? { emailed_at: at.toISOString() } : {}) })
    .in('id', ids);
}

/** Which pending people are ready: their newest pending row is older than
 *  the quiet window. Pure, so the window can be tested without a clock. */
export function readyForDigest(
  rows: { person_id: string; created_at: string }[],
  now: Date,
  quietMs: number = QUIET_MS,
): Set<string> {
  const newest = new Map<string, number>();
  for (const r of rows) {
    const at = new Date(r.created_at).getTime();
    newest.set(r.person_id, Math.max(newest.get(r.person_id) ?? 0, at));
  }
  return new Set([...newest].filter(([, at]) => now.getTime() - at >= quietMs).map(([p]) => p));
}

export async function runNotificationDigest(
  now: Date = new Date(),
  /** Tests only: these people's rows and nobody else's. */
  scope: { personIds?: string[] } = {},
): Promise<{ sent: number; skipped: number }> {
  let query = adminClient
    .from('member_notification')
    .select('id, workspace_id, person_id, kind, thread_id, subject, starts_at, created_at')
    .eq('email_state', 'pending')
    .order('created_at', { ascending: true })
    .limit(2000);
  if (scope.personIds) query = query.in('person_id', scope.personIds);
  const { data, error } = await query;
  if (error) throw new Error(`pending notifications: ${error.message}`);
  const pending = (data ?? []) as {
    id: string;
    workspace_id: string;
    person_id: string;
    kind: NotificationRow['kind'];
    thread_id: string | null;
    subject: string;
    starts_at: string | null;
    created_at: string;
  }[];
  const ready = readyForDigest(pending, now);
  let sent = 0;
  let skipped = 0;
  for (const personId of ready) {
    const mine = pending.filter((r) => r.person_id === personId);
    const ws = mine[0]!.workspace_id;
    const ids = mine.map((r) => r.id);

    // One person's failed reads leave THEIR rows pending for the next tick
    // and never stop anybody else's digest — and never count as "send".
    let person: { first_name: string | null; email: string | null; deleted_at: string | null } | null;
    let on: boolean;
    let pref: { email_off: boolean; unsubscribe_token: string };
    try {
      const [p, o, pr] = await Promise.all([
        adminClient.from('person').select('first_name, email, deleted_at').eq('id', personId).maybeSingle(),
        notifyMembersOn(ws),
        ensurePref(personId, ws),
      ]);
      if (p.error) throw new Error(p.error.message);
      person = p.data as typeof person;
      on = o;
      pref = pr;
    } catch (e) {
      console.error('[member-notify] digest held for a person this tick', personId, e);
      continue;
    }
    if (!on || pref.email_off || !person?.email || person.deleted_at) {
      await mark(ids, 'skipped', now);
      skipped += ids.length;
      continue;
    }

    // "New" lines are re-checked at send time: a thread withdrawn, or joined,
    // inside the quiet window is not news any more. The price comes from the
    // walk that charges.
    const newRows = mine.filter((r) => r.kind === 'new_thread');
    let offers = new Map<string, CouldJoin>();
    if (newRows.length) {
      const [{ data: members }, { data: places }] = await Promise.all([
        adminClient
          .from('membership_member')
          .select('id, person_id, workspace_id')
          .eq('person_id', personId)
          .is('deleted_at', null),
        adminClient
          .from('thread_enrolment')
          .select('id, thread_id, payment_status, enrolment:enrolment_id (status)')
          .eq('person_id', personId),
      ]);
      const placeMap = await placesByThread(
        ((places ?? []) as Record<string, unknown>[]).map((e) => ({
          id: e.id as string,
          thread_id: (e.thread_id as string | null) ?? null,
          payment_status: (e.payment_status as string | null) ?? null,
          enrolment_status: (one(e.enrolment) as { status?: string | null } | null)?.status ?? null,
        })),
      );
      const byMember = await couldJoinByMember(
        ((members ?? []) as { id: string; person_id: string; workspace_id: string }[]),
        placeMap,
        null,
      );
      offers = new Map([...byMember.values()].flat().map((r) => [r.thread_id, r]));
    }

    const items: DigestItem[] = [];
    const used: string[] = [];
    const dropped: string[] = [];
    for (const r of mine) {
      if (r.kind === 'new_thread') {
        const offer = r.thread_id ? offers.get(r.thread_id) : undefined;
        if (!offer) {
          dropped.push(r.id);
          continue;
        }
        items.push({
          kind: 'new_thread',
          title: r.subject,
          startsAt: r.starts_at,
          yourPriceCents: offer.your_price_cents,
          listPriceCents: offer.list_price_cents,
          currency: offer.currency,
        });
      } else {
        items.push({ kind: r.kind, title: r.subject, startsAt: r.starts_at });
      }
      used.push(r.id);
    }
    await mark(dropped, 'skipped', now);
    skipped += dropped.length;
    if (!items.length) continue;

    const [{ data: wsRow }, brand, locale] = await Promise.all([
      adminClient.from('workspace').select('name').eq('id', ws).maybeSingle(),
      getWorkspaceBrand(ws),
      platformEmailLocale(person.email as string),
    ]);
    const myOrigin = stackSurfaceUrl('my-portal', process.env);
    const msg = memberNotifyDigest({
      name: greetingName(person.first_name as string | null, person.email as string),
      communityName: (wsRow?.name as string | undefined) ?? 'your community',
      items,
      upcomingUrl: `${myOrigin}/upcoming`,
      unsubscribeUrl: `${myOrigin}/unsubscribe/${pref.unsubscribe_token}`,
      locale,
      brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      // The community's own words for its digest (Settings → Emails).
      custom: await communityWords({
        workspaceId: ws,
        kind: 'digest',
        memberLocale: locale,
        values: memberEmailValues({ firstName: person.first_name as string | null, lastName: (person as { last_name?: string | null }).last_name ?? null, communityName: wsRow?.name as string | undefined, portalUrl: `${myOrigin}/upcoming`, locale }),
      }),
    });
    try {
      await sendEmail({ to: person.email as string, subject: msg.subject, html: msg.html, text: msg.text, ...senderOf(brand) });
      await mark(used, 'sent', now);
      sent += used.length;
    } catch (e) {
      // Left pending: the next tick tries again. A failed send must not be
      // recorded as told.
      console.error('[member-notify] digest send failed', personId, e);
    }
  }
  return { sent, skipped };
}

/** The scheduler's job: new threads first, so a thread published minutes ago
 *  is in the same quiet window as the rest of the sitting. */
export async function runMemberNotify(): Promise<void> {
  await runNewThreadPass();
  await runNotificationDigest();
}
