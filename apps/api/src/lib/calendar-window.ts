// Calendar invitations in a ROLLING WINDOW (calendar gaps, slice 2; Sjoerd,
// 2026-10-17: "amazing. Go.").
//
// Until now a participant only got a session into their calendar when the
// organiser pressed SEND on a change — so someone who enrolled after a
// session's invitation went out never received it. Now every live
// participant holds every published, agenda-shown session of their thread
// that starts within the next SIX WEEKS, one mail per session (an iTIP
// REQUEST with several events is only half-read by Gmail), with the session's
// own UID and current SEQUENCE so a later move updates the same event.
//
// The scheduler runs this every few minutes. It sends only what a person
// does not hold yet:
//   · held — a row in thread_calendar_held for (session, address), written by
//     every send path from now on;
//   · before that table existed — an organiser SEND of that session
//     (thread_calendar_change added / moved / people, sent) while the
//     person's place already existed. Derived, so the launch includes the
//     members who are already enrolled without sending anyone a session twice
//     (Sjoerd: "make [existing members] part of the new flow"). Accepted
//     edge: someone declined and re-enrolled since may be judged as holding
//     it; they get it at the session's next change;
//   · not a FEED FOLLOWER — a live my.thread calendar feed read in the last
//     14 days already shows every session; an invitation too would show it
//     twice.
//
// OFF until platform_setting `calendar_window` = 'on' (absent = off, the
// calendar nudge's pattern). Off, the scheduler only LOGS counts per thread —
// never an address — and the dry-run script prints the same numbers from the
// same planner for Sjoerd to read before he switches it on.

import { adminClient } from '../db.js';
import { agendaEventUid, icalContentType, DEFAULT_EVENT_MINUTES } from '@thefibre/shared/ical';
import { ENTITY, toLocale, type Locale } from '@thefibre/shared';
import { platformFromAddress, sendEmail } from './email/client.js';
import { calendarInviteEmail } from './email/thread-templates.js';
import { platformEmailLocale } from './email/platform-i18n.js';
import { workspaceSender } from './workspace-brand.js';
import { enrolmentIsLive } from './portal.js';
import { changeInvites, whenLine } from './calendar-invite.js';
import { recordHeld } from './calendar-held.js';

export const WINDOW_DAYS = 42;
export const FEED_ACTIVE_DAYS = 14;
export const WINDOW_SETTING = 'calendar_window';
const DAY = 86_400_000;
/** Just inside Resend's two-per-second ceiling (calendar-invite.ts). */
const SEND_GAP_MS = 550;

const one = <T>(v: unknown): T | null => (!v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T));

export type WindowSession = {
  id: string;
  thread_id: string;
  workspace_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  url: string | null;
  sequence: number;
};
export type WindowPlace = { thread_id: string; email: string; name: string | null; since: string };
export type SentChange = { engagement_id: string; sent_at: string };
export type WindowInvite = { session: WindowSession; email: string; name: string | null };

/**
 * PURE: who is invited to what. One decision, used by the scheduler and the
 * dry run alike, so the counts Sjoerd reads are the mails that would go.
 */
export function planWindow(input: {
  sessions: WindowSession[];
  places: WindowPlace[];
  /** `${engagement_id}|${email}` already in thread_calendar_held. */
  held: Set<string>;
  sentChanges: SentChange[];
  feedFollowers: Set<string>;
}): { invites: WindowInvite[]; feedSkipped: Map<string, Set<string>> } {
  const placesByThread = new Map<string, WindowPlace[]>();
  for (const p of input.places) placesByThread.set(p.thread_id, [...(placesByThread.get(p.thread_id) ?? []), p]);
  const sendsBySession = new Map<string, number[]>();
  for (const c of input.sentChanges) {
    sendsBySession.set(c.engagement_id, [...(sendsBySession.get(c.engagement_id) ?? []), Date.parse(c.sent_at)]);
  }
  const invites: WindowInvite[] = [];
  const feedSkipped = new Map<string, Set<string>>();
  for (const s of input.sessions) {
    for (const p of placesByThread.get(s.thread_id) ?? []) {
      const email = p.email.toLowerCase();
      if (input.held.has(`${s.id}|${email}`)) continue;
      // An organiser SEND reached them if it went out while their place existed.
      if ((sendsBySession.get(s.id) ?? []).some((at) => at >= Date.parse(p.since))) continue;
      if (input.feedFollowers.has(email)) {
        feedSkipped.set(s.thread_id, (feedSkipped.get(s.thread_id) ?? new Set()).add(email));
        continue;
      }
      invites.push({ session: s, email, name: p.name });
    }
  }
  return { invites, feedSkipped };
}

/** Everything planWindow needs, read from the database. `threadIds` narrows it
 *  (tests). Read-only. */
export async function loadWindow(now: Date, scope: { threadIds?: string[] } = {}) {
  const until = new Date(now.getTime() + WINDOW_DAYS * DAY);
  let q = adminClient
    .from('thread_engagement')
    .select('id, thread_id, workspace_id, title, starts_at, ends_at, location, location_url, meeting_url, calendar_sequence, thread:thread_id (program:program_id (status))')
    .eq('status', 'published')
    .eq('show_in_agenda', true)
    .gte('starts_at', now.toISOString())
    .lt('starts_at', until.toISOString())
    .limit(5000);
  if (scope.threadIds) q = q.in('thread_id', scope.threadIds);
  const { data: rows, error } = await q;
  if (error) throw new Error(`window sessions: ${error.message}`);
  const sessions: WindowSession[] = ((rows ?? []) as Record<string, unknown>[])
    .filter((r) => one<{ status: string }>(one<{ program: unknown }>(r.thread)?.program)?.status === 'active')
    .map((r) => ({
      id: r.id as string,
      thread_id: r.thread_id as string,
      workspace_id: r.workspace_id as string,
      title: (r.title as string) ?? '',
      starts_at: r.starts_at as string,
      ends_at: (r.ends_at as string | null) ?? null,
      location: (r.location as string | null) ?? null,
      url: ((r.meeting_url as string | null) ?? (r.location_url as string | null)) ?? null,
      sequence: (r.calendar_sequence as number | null) ?? 0,
    }));
  const threadIds = [...new Set(sessions.map((s) => s.thread_id))];
  const sessionIds = sessions.map((s) => s.id);
  if (!sessions.length) return { sessions, places: [], held: new Set<string>(), sentChanges: [], feedFollowers: new Set<string>() };

  const [{ data: te }, { data: heldRows }, { data: changes }] = await Promise.all([
    adminClient
      .from('thread_enrolment')
      .select('thread_id, created_at, person:person_id (email, first_name, last_name), enrolment:enrolment_id (status)')
      .in('thread_id', threadIds),
    adminClient.from('thread_calendar_held').select('engagement_id, email').in('engagement_id', sessionIds),
    adminClient
      .from('thread_calendar_change')
      .select('engagement_id, sent_at')
      .in('engagement_id', sessionIds)
      .in('kind', ['added', 'moved', 'people'])
      .not('sent_at', 'is', null),
  ]);
  const seen = new Set<string>();
  const places: WindowPlace[] = [];
  for (const r of (te ?? []) as Record<string, unknown>[]) {
    if (!enrolmentIsLive(one<{ status: string | null }>(r.enrolment)?.status ?? null)) continue;
    const p = one<{ email: string | null; first_name: string | null; last_name: string | null }>(r.person);
    const email = p?.email?.trim().toLowerCase();
    if (!email) continue;
    const key = `${r.thread_id}|${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ thread_id: r.thread_id as string, email, name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null, since: r.created_at as string });
  }
  const emails = [...new Set(places.map((p) => p.email))];
  const feedFollowers = new Set<string>();
  if (emails.length) {
    const { data: feeds } = await adminClient
      .from('person_calendar_feed')
      .select('email')
      .is('revoked_at', null)
      .gte('last_read_at', new Date(now.getTime() - FEED_ACTIVE_DAYS * DAY).toISOString())
      .in('email', emails);
    for (const f of feeds ?? []) feedFollowers.add((f.email as string).toLowerCase());
  }
  return {
    sessions,
    places,
    held: new Set((heldRows ?? []).map((h) => `${h.engagement_id}|${(h.email as string).toLowerCase()}`)),
    sentChanges: ((changes ?? []) as SentChange[]).filter((c) => !!c.engagement_id),
    feedFollowers,
  };
}

export type WindowCount = { thread_id: string; live: number; feed_skipped: number; people: number; invitations: number };

/** Counts per thread — what the dry run prints and the off-switch logs. */
export function countByThread(input: Awaited<ReturnType<typeof loadWindow>>, plan: ReturnType<typeof planWindow>): WindowCount[] {
  const out = new Map<string, WindowCount>();
  const row = (id: string) => {
    if (!out.has(id)) out.set(id, { thread_id: id, live: 0, feed_skipped: 0, people: 0, invitations: 0 });
    return out.get(id)!;
  };
  for (const s of input.sessions) row(s.thread_id);
  for (const p of input.places) if (out.has(p.thread_id)) row(p.thread_id).live += 1;
  for (const [t, set] of plan.feedSkipped) row(t).feed_skipped = set.size;
  const people = new Map<string, Set<string>>();
  for (const i of plan.invites) {
    row(i.session.thread_id).invitations += 1;
    people.set(i.session.thread_id, (people.get(i.session.thread_id) ?? new Set()).add(i.email));
  }
  for (const [t, set] of people) row(t).people = set.size;
  return [...out.values()].filter((c) => c.invitations || c.feed_skipped).sort((a, b) => b.invitations - a.invitations);
}

/** Send the planned invitations, one mail per session per person. */
export async function sendWindow(invites: WindowInvite[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const contexts = new Map<string, Awaited<ReturnType<typeof threadContext>>>();
  for (const inv of invites) {
    const s = inv.session;
    if (!contexts.has(s.thread_id)) contexts.set(s.thread_id, await threadContext(s.thread_id));
    const ctx = contexts.get(s.thread_id);
    if (!ctx) {
      failed += 1;
      continue;
    }
    const startsAt = new Date(s.starts_at);
    const endsAt = s.ends_at ? new Date(s.ends_at) : new Date(startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);
    const ics = changeInvites({
      uid: agendaEventUid(s.id),
      sequence: s.sequence,
      recipients: [{ email: inv.email, name: inv.name, method: 'REQUEST', hostChange: null }],
      startsAt,
      endsAt,
      summary: s.title,
      description: ctx.threadTitle,
      location: s.location,
      url: s.url,
      organizerName: ctx.organiserName,
      organizerEmail: platformFromAddress(),
      cancelled: false,
    })[0]!.ics;
    const locale: Locale = await platformEmailLocale(inv.email, ctx.language).catch(() => toLocale(ctx.language));
    const mail = calendarInviteEmail({
      kind: 'added',
      sessionTitle: s.title,
      threadTitle: ctx.threadTitle,
      organiserName: ctx.organiserName,
      whenLine: whenLine(startsAt, endsAt, ctx.zone, locale),
      wasLine: null,
      whereLine: s.location,
      placeOnly: false,
      wasWhereLine: null,
      onlineUrl: s.url,
      locale,
      note: null,
      hostChange: null,
    });
    try {
      await sendEmail({
        to: inv.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(await workspaceSender(s.workspace_id)),
        fromName: ctx.organiserName,
        ...(ctx.organiserEmail ? { replyTo: ctx.organiserEmail } : {}),
        attachments: [{ filename: 'invite.ics', content: Buffer.from(ics, 'utf8').toString('base64'), contentType: icalContentType('REQUEST') }],
      });
      await recordHeld({ workspace_id: s.workspace_id, thread_id: s.thread_id, engagement_id: s.id, email: inv.email, method: 'REQUEST', sequence: s.sequence, source: 'window' });
      sent += 1;
      await new Promise((r) => setTimeout(r, SEND_GAP_MS));
    } catch (e) {
      failed += 1;
      console.error('[calendar-window] send failed', { thread: s.thread_id, session: s.id, e: (e as Error).message });
    }
  }
  return { sent, failed };
}

async function threadContext(threadId: string) {
  const { data: t } = await adminClient
    .from('thread_thread')
    .select('timezone, language, program:program_id (title), organiser:organiser_id (display_name, user:user_id (email, full_name))')
    .eq('id', threadId)
    .maybeSingle();
  if (!t) return null;
  const org = one<{ display_name: string | null; user: unknown }>(t.organiser);
  const user = one<{ email: string | null; full_name: string | null }>(org?.user);
  return {
    threadTitle: one<{ title: string }>(t.program)?.title ?? 'your thread',
    organiserName: org?.display_name ?? user?.full_name ?? ENTITY.publicName,
    organiserEmail: user?.email ?? null,
    zone: (t.timezone as string | null) ?? 'UTC',
    language: (t.language as string | null) ?? null,
  };
}

export async function windowSwitchOn(): Promise<boolean> {
  const { data, error } = await adminClient.from('platform_setting').select('value').eq('key', WINDOW_SETTING).maybeSingle();
  if (error) return false;
  return data?.value === 'on';
}

let lastDry: { key: string; at: number } | null = null;

/** The scheduler's entry: sends when switched on; otherwise logs counts per
 *  thread (never an address), at most hourly unless they change. */
export async function runCalendarWindowJob(now = new Date()): Promise<void> {
  const input = await loadWindow(now);
  const plan = planWindow(input);
  if (await windowSwitchOn()) {
    if (!plan.invites.length) return;
    const r = await sendWindow(plan.invites);
    console.log('[calendar-window]', r);
    return;
  }
  const counts = countByThread(input, plan);
  const key = JSON.stringify(counts);
  if (!counts.length) return;
  if (lastDry && lastDry.key === key && now.getTime() - lastDry.at < 3_600_000) return;
  lastDry = { key, at: now.getTime() };
  console.log('[calendar-window] DRY (switch off): would invite', counts);
}
