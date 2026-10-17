// When a WHOLE THREAD ends, its future sessions leave people's calendars
// (calendar gaps, slice 3; Sjoerd, 2026-10-17: "amazing. Go.").
//
// Until now deleting or archiving a thread sent nothing: everyone who had been
// invited kept the sessions in their calendar. Now each future session that
// ever went out gets a CANCEL — the session's own UID, the sequence bumped —
// to everybody who holds it:
//   · the thread_calendar_held REQUEST rows (every send path writes them);
//   · for a session an organiser SENT before that record existed, every live
//     participant (a CANCEL for an event somebody does not hold is ignored by
//     their calendar, so erring wide is harmless) — minus anyone already
//     recorded as cancelled;
//   · the session's invited hosts.
//
// ORDER IS THE POINT ON DELETE. Deleting a thread cascades its enrolments
// and its held rows away, so the plan is MATERIALISED first — sessions,
// addresses, the thread's own words — and sent after, from that copy. On
// archive nothing is deleted; the rows are flipped to CANCEL, so archiving
// twice sends nothing twice. Completed threads send nothing (their sessions
// are past).

import { adminClient } from '../db.js';
import { agendaEventUid, icalContentType, DEFAULT_EVENT_MINUTES } from '@thefibre/shared/ical';
import { ENTITY, toLocale } from '@thefibre/shared';
import { platformFromAddress, sendEmail } from './email/client.js';
import { calendarInviteEmail } from './email/thread-templates.js';
import { platformEmailLocale } from './email/platform-i18n.js';
import { workspaceSender } from './workspace-brand.js';
import { enrolmentIsLive } from './portal.js';
import { changeInvites, whenLine } from './calendar-invite.js';
import { recordHeld } from './calendar-held.js';

const one = <T>(v: unknown): T | null => (!v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T));
const SEND_GAP_MS = 550;

export type EndSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  url: string | null;
  sequence: number;
  recipients: { email: string; name: string | null }[];
};
export type EndPlan = {
  threadId: string;
  workspaceId: string;
  threadTitle: string;
  organiserName: string;
  organiserEmail: string | null;
  zone: string;
  language: string | null;
  sessions: EndSession[];
};

/** Who holds which future session of this thread, read NOW (before any
 *  delete). Read-only. */
export async function planThreadEnd(threadId: string, now = new Date()): Promise<EndPlan | null> {
  const { data: t } = await adminClient
    .from('thread_thread')
    .select('id, workspace_id, timezone, language, program:program_id (title), organiser:organiser_id (display_name, user:user_id (email, full_name))')
    .eq('id', threadId)
    .maybeSingle();
  if (!t) return null;
  const org = one<{ display_name: string | null; user: unknown }>(t.organiser);
  const user = one<{ email: string | null; full_name: string | null }>(org?.user);

  const { data: rows } = await adminClient
    .from('thread_engagement')
    .select('id, title, starts_at, ends_at, location, location_url, meeting_url, calendar_sequence, calendar_sent_at, invited_hosts')
    .eq('thread_id', threadId)
    .gt('starts_at', now.toISOString());
  const engagements = (rows ?? []) as Record<string, unknown>[];
  const ids = engagements.map((e) => e.id as string);

  const [{ data: held }, { data: te }] = await Promise.all([
    ids.length ? adminClient.from('thread_calendar_held').select('engagement_id, email, method').in('engagement_id', ids) : Promise.resolve({ data: [] }),
    adminClient.from('thread_enrolment').select('person:person_id (email, first_name, last_name), enrolment:enrolment_id (status)').eq('thread_id', threadId),
  ]);
  const live: { email: string; name: string | null }[] = [];
  const seenLive = new Set<string>();
  for (const r of (te ?? []) as Record<string, unknown>[]) {
    if (!enrolmentIsLive(one<{ status: string | null }>(r.enrolment)?.status ?? null)) continue;
    const p = one<{ email: string | null; first_name: string | null; last_name: string | null }>(r.person);
    const email = p?.email?.trim().toLowerCase();
    if (!email || seenLive.has(email)) continue;
    seenLive.add(email);
    live.push({ email, name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null });
  }

  const sessions: EndSession[] = [];
  for (const e of engagements) {
    const mine = ((held ?? []) as { engagement_id: string; email: string; method: string }[]).filter((h) => h.engagement_id === e.id);
    const cancelled = new Set(mine.filter((h) => h.method === 'CANCEL').map((h) => h.email.toLowerCase()));
    const out = new Map<string, { email: string; name: string | null }>();
    for (const h of mine) if (h.method === 'REQUEST') out.set(h.email.toLowerCase(), { email: h.email.toLowerCase(), name: null });
    // Sent before the record existed: everyone live, unless already cancelled.
    if (e.calendar_sent_at) for (const p of live) if (!cancelled.has(p.email) && !out.has(p.email)) out.set(p.email, p);
    for (const h of ((e.invited_hosts as string[] | null) ?? [])) {
      const k = h.toLowerCase();
      if (!cancelled.has(k) && !out.has(k)) out.set(k, { email: k, name: null });
    }
    if (!out.size) continue;
    sessions.push({
      id: e.id as string,
      title: (e.title as string) ?? '',
      starts_at: e.starts_at as string,
      ends_at: (e.ends_at as string | null) ?? null,
      location: (e.location as string | null) ?? null,
      url: ((e.meeting_url as string | null) ?? (e.location_url as string | null)) ?? null,
      sequence: ((e.calendar_sequence as number | null) ?? 0) + 1,
      recipients: [...out.values()],
    });
  }
  return {
    threadId,
    workspaceId: t.workspace_id as string,
    threadTitle: one<{ title: string }>(t.program)?.title ?? 'your thread',
    organiserName: org?.display_name ?? user?.full_name ?? ENTITY.publicName,
    organiserEmail: user?.email ?? null,
    zone: (t.timezone as string | null) ?? 'UTC',
    language: (t.language as string | null) ?? null,
    sessions,
  };
}

/** For the confirm dialog: how many people, how many sessions. */
export function endReach(plan: EndPlan | null): { people: number; sessions: number } {
  if (!plan) return { people: 0, sessions: 0 };
  return { people: new Set(plan.sessions.flatMap((s) => s.recipients.map((r) => r.email))).size, sessions: plan.sessions.length };
}

/**
 * Send the CANCELs from a materialised plan. `record`: true on archive (the
 * rows still exist and are flipped to CANCEL); false after a delete (they
 * cascaded away with the thread, by design).
 */
export async function sendThreadEnd(plan: EndPlan, opts: { record: boolean }): Promise<{ sent: number; failed: number; total: number }> {
  let sent = 0;
  let failed = 0;
  // Paced at SEND_GAP_MS (Resend's two-a-second), so 360 cancels run ~3½
  // minutes. After a DELETE the held rows are already gone, so a restart
  // mid-send loses the rest: the START line says how many were due and the
  // END line how many went, so a cut-off reads as a start with no end.
  const total = plan.sessions.reduce((n, s) => n + s.recipients.length, 0);
  console.log('[calendar-thread-end] start', { thread: plan.threadId, sessions: plan.sessions.length, total, record: opts.record });
  for (const s of plan.sessions) {
    if (opts.record) {
      // The bump, once per session, so every calendar takes the CANCEL.
      await adminClient.from('thread_engagement').update({ calendar_sequence: s.sequence }).eq('id', s.id);
    }
    const startsAt = new Date(s.starts_at);
    const endsAt = s.ends_at ? new Date(s.ends_at) : new Date(startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);
    const invites = changeInvites({
      uid: agendaEventUid(s.id),
      sequence: s.sequence,
      recipients: s.recipients.map((r) => ({ ...r, method: 'CANCEL' as const, hostChange: null })),
      startsAt,
      endsAt,
      summary: s.title,
      description: plan.threadTitle,
      location: s.location,
      url: s.url,
      organizerName: plan.organiserName,
      organizerEmail: platformFromAddress(),
      cancelled: true,
    });
    for (const { recipient, ics } of invites) {
      try {
        const locale = await platformEmailLocale(recipient.email, plan.language).catch(() => toLocale(plan.language));
        const mail = calendarInviteEmail({
          kind: 'cancelled',
          sessionTitle: s.title,
          threadTitle: plan.threadTitle,
          organiserName: plan.organiserName,
          whenLine: whenLine(startsAt, endsAt, plan.zone, locale),
          wasLine: null,
          whereLine: s.location,
          placeOnly: false,
          wasWhereLine: null,
          onlineUrl: s.url,
          locale,
          note: null,
          hostChange: null,
        });
        await sendEmail({
          to: recipient.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          ...(await workspaceSender(plan.workspaceId)),
          fromName: plan.organiserName,
          ...(plan.organiserEmail ? { replyTo: plan.organiserEmail } : {}),
          attachments: [{ filename: 'invite.ics', content: Buffer.from(ics, 'utf8').toString('base64'), contentType: icalContentType('CANCEL') }],
        });
        sent += 1;
        if (opts.record) {
          await recordHeld({ workspace_id: plan.workspaceId, thread_id: plan.threadId, engagement_id: s.id, email: recipient.email, method: 'CANCEL', sequence: s.sequence, source: 'thread_end' });
        }
        await new Promise((r) => setTimeout(r, SEND_GAP_MS));
      } catch (e) {
        failed += 1;
        console.error('[calendar-thread-end] cancel not sent', { thread: plan.threadId, session: s.id, e: (e as Error).message });
      }
    }
  }
  console.log(`[calendar-thread-end] done: ${sent} of ${total} sent (${failed} failed)`, { thread: plan.threadId });
  return { sent, failed, total };
}
