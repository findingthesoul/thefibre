// Telling people when a session moves.
//
// Sjoerd, 2026-09-24, on why a subscription was not the whole answer: *"if I
// send an invite and change it, it changes the invite."* Which is exactly
// right, and worth stating plainly because it is the thing this file exists
// to reproduce: nothing is watching. His calendar SENDS AN EMAIL — a specially
// formed one saying "same meeting as before, here is version 2, it is now
// Thursday" — and the recipient's calendar edits the event it already holds.
// That is iMIP (RFC 5546), and it is the only mechanism that reaches an event
// somebody already has.
//
// ---------------------------------------------------------------------------
// EDITING IS NOT ANNOUNCING
// ---------------------------------------------------------------------------
// *"when someone moves an event for which people have registered and RSVP-ed,
// changing the date is with an extra warning… This should not be a light
// thing."* And: *"if an organiser moves five sessions in one sitting, that's
// one email, not five."*
//
// So a change never sends at the moment of the edit. It queues, the thread
// shows who has not been told, and the organiser reviews and presses once. An
// organiser rearranging a programme on a Tuesday afternoon is thinking, not
// broadcasting, and the system should not mistake one for the other.
//
// ---------------------------------------------------------------------------
// WHAT ONE PRESS ACTUALLY SENDS — read this before promising otherwise
// ---------------------------------------------------------------------------
// One press is one decision, not one message on the wire. RFC 5546 allows
// several VEVENTs in a single REQUEST only when they are recurrences of the
// SAME event; unrelated sessions must travel as separate iMIP messages, or
// the receiving calendar acts on one of them and ignores the rest. So five
// moved sessions are five messages, sent together, from one press — the same
// thing that happens when anyone moves five events in their own calendar.
// The promise kept is that the organiser is not making five decisions and
// five people are not being interrupted five times by five acts of
// carelessness.
// ---------------------------------------------------------------------------

import { adminClient } from '../db.js';
import {
  agendaEventUid,
  buildInviteIcal,
  icalContentType,
  DEFAULT_EVENT_MINUTES,
} from '@thefibre/shared/ical';
import { ENTITY } from '@thefibre/shared';
import { platformFromAddress, sendEmail } from './email/client.js';
import { calendarInviteEmail } from './email/thread-templates.js';

/** The fields whose change is worth telling somebody about. Sjoerd set this
 *  list explicitly: date, time, place, existence — *"not when someone fixes a
 *  typo in a description"*. Renaming a session is deliberately absent: a
 *  calendar entry's title changing under someone is noise, not news. */
export type CalendarState = {
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  location_url: string | null;
  meeting_url: string | null;
};

export type ChangeKind = 'added' | 'moved' | 'cancelled';

/**
 * Whether this row is something a calendar could hold at all.
 *
 * Three conditions, and each excludes a real case: a draft nobody can see, a
 * message or a resource that is not an appointment, and an item with no date
 * — a thread carries plenty of those and an all-day VEVENT for "Reading
 * week" is machinery for no benefit.
 */
export function isCalendarSession(row: Record<string, unknown>): boolean {
  return (
    row.status === 'published' &&
    row.show_in_agenda === true &&
    !!(row.starts_at as string | null)
  );
}

export function calendarStateOf(row: Record<string, unknown>): CalendarState {
  return {
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    location_url: (row.location_url as string | null) ?? null,
    meeting_url: (row.meeting_url as string | null) ?? null,
  };
}

/** Whether anything a calendar would care about actually differs. */
export function calendarStateChanged(a: CalendarState, b: CalendarState): boolean {
  return (
    !sameInstant(a.starts_at, b.starts_at) ||
    !sameInstant(a.ends_at, b.ends_at) ||
    a.location !== b.location ||
    a.location_url !== b.location_url ||
    a.meeting_url !== b.meeting_url
  );
}

/** Timestamps round-trip through Postgres in a different spelling than they
 *  went in — '2027-01-05T15:00:00Z' comes back '2027-01-05 15:00:00+00'. A
 *  string compare would call every save a reschedule and mail everybody. */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}

/**
 * Queue a change, collapsing it into whatever is already unsent.
 *
 * The rules are all consequences of one idea — a participant can only act on
 * the difference between what they were told and what is true now:
 *
 *   * A session nobody has been told about cannot be "moved". Until its first
 *     invitation goes out it is a draft being drafted, and `added` is what its
 *     first send will be regardless of how many times it shifts first.
 *   * Moving something three times before pressing send is ONE change, from
 *     where it originally was to where it now is. `was` is written once and
 *     never overwritten.
 *   * Added and then cancelled, both unsent, is NOTHING. Nobody was told it
 *     existed, so there is nothing to correct — the row is removed and no
 *     message is ever sent about a session that briefly existed on a Tuesday.
 */
export type CollapseDecision =
  | { do: 'ignore' }
  | { do: 'forget' }
  | { do: 'update'; kind: ChangeKind }
  | { do: 'insert'; kind: ChangeKind };

/**
 * What a new change does to whatever is already queued. Pure, because these
 * four rules are the whole feature and each of them is a decision somebody
 * will want to check without a database.
 */
export function collapseDecision(args: {
  /** Has an invitation for this session ever gone out? */
  everSent: boolean;
  /** The kind already queued and unsent, if any. */
  pendingKind: ChangeKind | null;
  kind: ChangeKind;
}): CollapseDecision {
  if (!args.everSent) {
    // Nobody holds it. A cancellation erases the episode entirely: no message
    // is ever sent about a session that existed for one afternoon.
    if (args.kind === 'cancelled') return args.pendingKind ? { do: 'forget' } : { do: 'ignore' };
    // Still a draft moving around. Whatever is queued stays 'added', and the
    // send carries wherever it has ended up by then.
    if (args.pendingKind) return { do: 'update', kind: 'added' };
    if (args.kind === 'moved') return { do: 'ignore' };
    return { do: 'insert', kind: 'added' };
  }

  // It is out there. A cancellation supersedes a pending move — the move no
  // longer matters to anybody.
  if (args.pendingKind) {
    return { do: 'update', kind: args.kind === 'cancelled' ? 'cancelled' : args.pendingKind };
  }
  return { do: 'insert', kind: args.kind };
}

export async function recordCalendarChange(args: {
  engagement: Record<string, unknown>;
  kind: ChangeKind;
  /** State before the edit. Omitted for 'added' and 'cancelled'. */
  before?: CalendarState;
  actorUserId?: string | null;
}): Promise<void> {
  const e = args.engagement;
  const engagementId = e.id as string;

  const { data: pending } = await adminClient
    .from('thread_calendar_change')
    .select('id, kind, was')
    .eq('engagement_id', engagementId)
    .is('sent_at', null)
    .maybeSingle();

  const decision = collapseDecision({
    everSent: !!e.calendar_sent_at,
    pendingKind: (pending?.kind as ChangeKind | undefined) ?? null,
    kind: args.kind,
  });

  if (decision.do === 'ignore') return;

  if (decision.do === 'forget') {
    await adminClient.from('thread_calendar_change').delete().eq('id', pending!.id as string);
    return;
  }

  if (decision.do === 'update') {
    // `was` is never rewritten: three moves before one send is still one
    // change, from where it originally was to where it now is.
    await adminClient
      .from('thread_calendar_change')
      .update({ kind: decision.kind, title: e.title as string, now_state: calendarStateOf(e) })
      .eq('id', pending!.id as string);
    return;
  }

  await adminClient.from('thread_calendar_change').insert({
    workspace_id: e.workspace_id as string,
    thread_id: e.thread_id as string,
    engagement_id: engagementId,
    kind: decision.kind,
    title: e.title as string,
    was: args.before ?? null,
    now_state: calendarStateOf(e),
    created_by: args.actorUserId ?? null,
  });
}

export type PendingChange = {
  id: string;
  engagement_id: string | null;
  kind: ChangeKind;
  title: string;
  was: CalendarState | null;
  now_state: CalendarState | null;
  created_at: string;
};

export async function pendingChanges(threadId: string): Promise<PendingChange[]> {
  const { data } = await adminClient
    .from('thread_calendar_change')
    .select('id, engagement_id, kind, title, was, now_state, created_at')
    .eq('thread_id', threadId)
    .is('sent_at', null)
    .order('created_at', { ascending: true });
  return (data ?? []) as PendingChange[];
}

/**
 * Who would be told — everyone with a live enrolment and an address.
 *
 * Deliberately NOT gated on the "share participants" toggle: that decides
 * whether people can see EACH OTHER, which is a separate question from
 * whether each of them hears about their own session moving. Listing them to
 * one another on the invitation is the thing that waits on Sjoerd, because
 * the consent people gave covers appearing as "Marja d." on a page, not
 * having their address delivered into everybody's calendar.
 */
export async function calendarAudience(
  threadId: string,
): Promise<{ email: string; name: string | null }[]> {
  const { data } = await adminClient
    .from('thread_enrolment')
    .select('person:person_id (email, first_name, last_name), enrolment:enrolment_id (status)')
    .eq('thread_id', threadId);

  const seen = new Set<string>();
  const out: { email: string; name: string | null }[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const status = (one(row.enrolment) as { status: string | null } | null)?.status ?? null;
    if (!enrolmentHoldsAPlace(status)) continue;
    const p = one(row.person) as
      | { email: string | null; first_name: string | null; last_name: string | null }
      | null;
    const email = p?.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null,
    });
  }
  return out;
}

/** Someone who is actually coming. Withdrawn and rejected people are not told
 *  a session moved, because it is no longer their session. */
function enrolmentHoldsAPlace(status: string | null): boolean {
  return status !== 'withdrawn' && status !== 'rejected' && status !== 'cancelled';
}

const one = <T>(v: unknown): T | null =>
  !v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T);

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** One message per recipient per changed session, and each .ics names only
 *  its own recipient as ATTENDEE.
 *
 *  Not a privacy afterthought — it is the only shape available today. Listing
 *  every participant on the invitation would put their addresses into each
 *  other's calendars, and the consent people gave at enrolment covers
 *  appearing as "Marja d." in a cohort list, not that. Sjoerd has the question
 *  and until he answers it, each person is invited to their own copy. */
export async function sendPendingChanges(args: {
  threadId: string;
  note?: string | null;
}): Promise<{ sent: number; recipients: number; changes: number; skipped: string[] }> {
  const changes = await pendingChanges(args.threadId);
  const skipped: string[] = [];
  if (!changes.length) return { sent: 0, recipients: 0, changes: 0, skipped };

  const { data: thread } = await adminClient
    .from('thread_thread')
    .select(
      `id, workspace_id,
       program:program_id (title),
       organiser:organiser_id (display_name, user:user_id (email, full_name))`,
    )
    .eq('id', args.threadId)
    .maybeSingle();
  if (!thread) return { sent: 0, recipients: 0, changes: 0, skipped: ['thread not found'] };

  const org = one(thread.organiser) as
    | { display_name: string | null; user: unknown }
    | null;
  const orgUser = one(org?.user) as { email: string | null; full_name: string | null } | null;
  const organiserName = org?.display_name ?? orgUser?.full_name ?? ENTITY.publicName;
  const organiserEmail = orgUser?.email ?? null;
  const threadTitle = (one(thread.program) as { title: string } | null)?.title ?? 'your thread';

  // An invitation with no ORGANIZER is not an invitation — clients refuse to
  // file it, and some show it as a broken attachment. Better to refuse here,
  // where somebody can read the reason, than to send 200 inert messages.
  if (!organiserEmail) {
    return { sent: 0, recipients: 0, changes: changes.length, skipped: ['no organiser address'] };
  }

  // WHOSE ADDRESS GOES IN ORGANIZER — and why it is not the organiser's.
  //
  // It was theirs until 2026-09-25, and Gmail refused every invitation:
  // "Unable to load event", nothing filed. iMIP requires the message's SENDER
  // to align with the ORGANIZER, and ours leaves from the platform address
  // because that is the domain with SPF and DKIM. A mail from us claiming an
  // ORGANIZER at someone else's domain is, to Google, exactly what a forged
  // invitation looks like — and it is right to think so.
  //
  // So the address is ours and the NAME is theirs: the invitation reads as
  // "Sjoerd Luteijn" in the inbox and in the calendar entry, and Reply-To
  // still reaches them. What a person sees is the organiser; what the
  // protocol checks is consistent.
  //
  // The alternative — invitations genuinely FROM each organiser's address —
  // needs every organiser to verify their own domain with us, which is real
  // setup rather than a code change. That is Sjoerd's call and he has it.
  const organizerEmail = platformFromAddress();

  const audience = await calendarAudience(args.threadId);
  if (!audience.length) {
    // Nothing to tell, but the changes are still resolved: leaving them
    // queued would show the organiser a permanent unsent bar for an empty room.
    await markSent(changes.map((ch) => ch.id));
    return { sent: 0, recipients: 0, changes: changes.length, skipped: ['nobody enrolled'] };
  }

  let sent = 0;
  for (const change of changes) {
    // Marked one at a time, below, as each finishes. It used to be one
    // markSent for all of them after the loop, and the loop does not always
    // reach the end (2026-09-24: Fly closed a 20-second request mid-send).
    // With a single mark at the end, a send that dies halfway leaves every
    // change unsent — so pressing the button again re-invites everyone who
    // already heard, from a sequence that has already moved on.
    const state = change.now_state ?? change.was;
    if (!state?.starts_at) {
      skipped.push(`${change.title}: no date`);
      continue;
    }
    const startsAt = new Date(state.starts_at);
    const endsAt = state.ends_at
      ? new Date(state.ends_at)
      : new Date(startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);

    // The sequence a calendar will compare against what it already holds.
    // Read and incremented per SEND, never per edit, so three moves before one
    // press advance it once.
    const sequence = await nextSequence(change.engagement_id);

    const method = change.kind === 'cancelled' ? 'CANCEL' : 'REQUEST';
    const uid = agendaEventUid(change.engagement_id ?? change.id);

    const mail = calendarInviteEmail({
      kind: change.kind,
      sessionTitle: change.title,
      threadTitle,
      organiserName,
      whenLine: whenLine(startsAt, endsAt),
      wasLine: change.kind === 'moved' && change.was?.starts_at
        ? whenLine(new Date(change.was.starts_at), change.was.ends_at ? new Date(change.was.ends_at) : null)
        : null,
      whereLine: state.location ?? null,
      note: args.note ?? null,
    });

    for (const person of audience) {
      const ics = buildInviteIcal({
        method,
        uid,
        sequence,
        startsAt,
        endsAt,
        summary: change.title,
        description: threadTitle,
        location: state.location,
        url: state.meeting_url ?? state.location_url,
        organizerName: organiserName,
        organizerEmail,
        attendees: [{ name: person.name, email: person.email }],
        status: change.kind === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
      });

      try {
        await sendEmail({
          to: person.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          fromName: organiserName,
          replyTo: organiserEmail,
          attachments: [
            {
              filename: 'invite.ics',
              content: Buffer.from(ics, 'utf8').toString('base64'),
              // The line the whole feature stands on. Without `method=` the
              // same bytes arrive as a file to download: the calendar does
              // nothing and nothing on our side looks wrong.
              contentType: icalContentType(method),
            },
          ],
        });
        sent += 1;
        // Resend accepts two requests a second. A thread of forty people with
        // three moved sessions is a hundred and twenty sends in a tight loop,
        // and the rejections would land silently in `skipped` — a send that
        // reports partial success and looks fine in the log. Pace it.
        await new Promise((r) => setTimeout(r, SEND_GAP_MS));
      } catch (e) {
        console.error('[thread/calendar] send failed', { to: person.email, e });
        skipped.push(`${person.email}: send failed`);
      }
    }

    // This change is done. Recorded now so a later failure cannot undo it —
    // and recorded even when every address bounced, because the alternative
    // is a queue that can never be cleared and a button that re-sends forever
    // to the people it CAN reach.
    await markSent([change.id]);
  }

  return { sent, recipients: audience.length, changes: changes.length, skipped };
}

/** Just inside Resend's two-per-second ceiling, with room for jitter. */
const SEND_GAP_MS = 550;

async function markSent(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await adminClient
    .from('thread_calendar_change')
    .update({ sent_at: new Date().toISOString() })
    .in('id', ids);
}

/** Bump and return. A calendar ignores an update numbered at or below the one
 *  it holds, so this only ever goes up — which is also what makes a retry of a
 *  half-finished send harmless rather than silently ignored. */
async function nextSequence(engagementId: string | null): Promise<number> {
  if (!engagementId) return 0;
  const { data } = await adminClient
    .from('thread_engagement')
    .select('calendar_sequence')
    .eq('id', engagementId)
    .maybeSingle();
  const next = ((data?.calendar_sequence as number | null) ?? 0) + 1;
  await adminClient
    .from('thread_engagement')
    .update({ calendar_sequence: next, calendar_sent_at: new Date().toISOString() })
    .eq('id', engagementId);
  return next;
}

/** A date a person can read, in the organiser's words rather than ISO. The
 *  calendar entry itself carries the real instant; this is the sentence in the
 *  email beside it. */
export function whenLine(startsAt: Date, endsAt: Date | null): string {
  const day = startsAt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const time = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return endsAt ? `${day}, ${time(startsAt)}–${time(endsAt)} UTC` : `${day}, ${time(startsAt)} UTC`;
}

// ---------------------------------------------------------------------------
// Starting a send without holding a request open
// ---------------------------------------------------------------------------
//
// A send is one message per recipient per change, paced at Resend's ceiling.
// Forty people and three changes is a hundred and twenty messages and over a
// minute of work — far longer than anything should hold an HTTP connection
// open, and on 2026-09-24 Fly closed one mid-send at about twenty seconds. The
// organiser saw nothing, the queue stayed unsent, and the sequence numbers had
// already moved on.
//
// So the request starts the work and answers immediately with what it is about
// to do. The queue is the record of what is left, marked change by change as
// it goes, which is what makes an interrupted run safe to leave interrupted.

/** Threads with a send in flight. A second press while the first is running
 *  would re-invite everyone the first has not reached yet — and the button is
 *  exactly the kind people press twice when nothing appears to happen. */
const sending = new Set<string>();

export async function startSendingPendingChanges(args: {
  threadId: string;
  note?: string | null;
}): Promise<{ started: boolean; changes: number; recipients: number }> {
  const [changes, audience] = await Promise.all([
    pendingChanges(args.threadId),
    calendarAudience(args.threadId),
  ]);
  if (!changes.length) return { started: false, changes: 0, recipients: audience.length };
  if (sending.has(args.threadId)) {
    return { started: false, changes: changes.length, recipients: audience.length };
  }

  sending.add(args.threadId);
  void sendPendingChanges({ threadId: args.threadId, note: args.note ?? null })
    .then((r) => {
      if (r.skipped.length) {
        console.log('[thread/calendar] send finished with skips', { threadId: args.threadId, ...r });
      }
    })
    .catch((e) => console.error('[thread/calendar] send failed', { threadId: args.threadId, e }))
    .finally(() => sending.delete(args.threadId));

  return { started: true, changes: changes.length, recipients: audience.length };
}
