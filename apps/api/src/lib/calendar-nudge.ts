// The nudge: a reminder to the ORGANISER when calendar changes have waited
// for their SEND for a day.
//
// Sjoerd, 2026-10-16: "keep send manual with nudge". Editing a session queues
// a change (lib/calendar-invite.ts, "editing is not announcing"); nobody is
// told until the organiser presses SEND. That stays. What was missing is the
// case where the press never comes, and participants turn up at the old time.
//
// THE RULES, each one a way this could become noise:
//   · DUE when the OLDEST waiting change is at least 24 hours old and less
//     than 7 days. Under a day is an organiser still editing. Over a week is
//     a queue somebody has clearly left, and the first deploy must not mail
//     every organiser about every queue that ever went stale (the window, not
//     a baseline, keeps that quiet; the badge on the Threads list still
//     shows them).
//   · ONCE PER BATCH. The batch is "since the last SEND": the claim row is
//     (thread, the thread's latest sent_at — epoch if it never sent). Whatever
//     happens to that queue afterwards, it is not reminded again. Pressing
//     SEND moves the key, which re-arms it for the next batch.
//   · CLAIM BEFORE MAIL. INSERT … ON CONFLICT DO NOTHING; only the tick that
//     got a row back sends (thread_message_send's pattern), so two ticks or
//     two machines send one mail.
//   · ONLY CHANGES THAT STILL MATTER. A session that is over is not mailed
//     at SEND either (sendPendingChanges), so it is not a reason to nudge.
//   · ONLY THE ORGANISER, never a participant, and never an admin in their
//     place: a thread whose organiser has no address is recorded as skipped,
//     once (the claim row is the "once"), and logged.

import { appUrl, type Locale } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { sendEmail } from './email/client.js';
import { platformEmailLocale } from './email/platform-i18n.js';
import { calendarNudgeEmail } from './email/thread-templates.js';
import { selectAll, selectIn } from './select-in.js';

const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export const NUDGE_AFTER_MS = 24 * 60 * 60 * 1000;
export const NUDGE_UNTIL_MS = 7 * 24 * 60 * 60 * 1000;
const EPOCH = '1970-01-01T00:00:00.000Z';

type Pending = {
  id: string;
  thread_id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  was: { starts_at?: string | null; ends_at?: string | null } | null;
  now_state: { starts_at?: string | null; ends_at?: string | null } | null;
};

/** Still worth telling somebody about: its session (as it now stands, or as
 *  it was for a cancellation) has not ended. Undated changes count. */
export function stillMatters(c: Pick<Pending, 'was' | 'now_state'>, now: Date): boolean {
  const s = c.now_state ?? c.was;
  const end = s?.ends_at ?? s?.starts_at;
  return !end || new Date(end).getTime() > now.getTime();
}

/** Inside the window: at least a day, under a week. */
export function inNudgeWindow(oldestAt: string, now: Date): boolean {
  const age = now.getTime() - new Date(oldestAt).getTime();
  return age >= NUDGE_AFTER_MS && age < NUDGE_UNTIL_MS;
}

export type NudgeDue = {
  thread_id: string;
  workspace_id: string;
  thread_title: string;
  organiser_email: string | null;
  change_count: number;
  oldest_at: string;
  after_send_at: string;
  titles: string[];
};

/** Which threads are due a reminder now, without claiming or sending —
 *  what the DRY run prints. */
export async function nudgesDue(now: Date = new Date(), opts: { threadIds?: string[] } = {}): Promise<NudgeDue[]> {
  const sel = 'id, thread_id, workspace_id, title, created_at, was, now_state';
  const pending = (
    opts.threadIds
      ? await selectIn<Pending>('nudge: pending', opts.threadIds, (chunk) =>
          adminClient.from('thread_calendar_change').select(sel).in('thread_id', chunk).is('sent_at', null).order('id'),
        )
      : await selectAll<Pending>('nudge: pending', () =>
          adminClient.from('thread_calendar_change').select(sel).is('sent_at', null).order('id'),
        )
  ).filter((c) => stillMatters(c, now));

  const byThread = new Map<string, Pending[]>();
  for (const c of pending) byThread.set(c.thread_id, [...(byThread.get(c.thread_id) ?? []), c]);
  const dueIds = [...byThread]
    .filter(([, list]) => inNudgeWindow(list.map((c) => c.created_at).sort()[0]!, now))
    .map(([id]) => id);
  if (!dueIds.length) return [];

  const [sentRows, threads] = await Promise.all([
    selectIn<{ id: string; thread_id: string; sent_at: string }>('nudge: last send', dueIds, (chunk) =>
      adminClient.from('thread_calendar_change').select('id, thread_id, sent_at').in('thread_id', chunk).not('sent_at', 'is', null).order('id'),
    ),
    selectIn<Record<string, unknown>>('nudge: threads', dueIds, (chunk) =>
      adminClient
        .from('thread_thread')
        .select('id, program:program_id (title, status), organiser:organiser_id (user:user_id (email))')
        .in('id', chunk)
        .order('id'),
    ),
  ]);
  const lastSend = new Map<string, string>();
  for (const r of sentRows) {
    const at = new Date(r.sent_at).toISOString();
    if (!lastSend.has(r.thread_id) || at > lastSend.get(r.thread_id)!) lastSend.set(r.thread_id, at);
  }
  const threadById = new Map(threads.map((t) => [t.id as string, t]));

  const out: NudgeDue[] = [];
  for (const id of dueIds) {
    const t = threadById.get(id);
    if (!t) continue;
    const program = one(t.program as never) as { title?: string; status?: string } | null;
    // An archived thread is finished business.
    if (program?.status === 'archived') continue;
    const org = one(t.organiser as never) as { user?: unknown } | null;
    const user = one(org?.user as never) as { email?: string | null } | null;
    const list = byThread.get(id)!;
    out.push({
      thread_id: id,
      workspace_id: list[0]!.workspace_id,
      thread_title: program?.title ?? 'your thread',
      organiser_email: user?.email?.trim() || null,
      change_count: list.length,
      oldest_at: list.map((c) => c.created_at).sort()[0]!,
      after_send_at: lastSend.get(id) ?? EPOCH,
      titles: list.map((c) => c.title),
    });
  }
  return out;
}

export type NudgeResult = { due: number; sent: number; skipped: number; already: number };

/** The scheduler's pass: claim, then mail, one per thread per batch. */
export async function runCalendarNudge(
  now: Date = new Date(),
  opts: { threadIds?: string[]; send?: typeof sendEmail; locale?: (email: string) => Promise<Locale> } = {},
): Promise<NudgeResult> {
  const send = opts.send ?? sendEmail;
  const due = await nudgesDue(now, opts);
  const result: NudgeResult = { due: due.length, sent: 0, skipped: 0, already: 0 };
  for (const d of due) {
    const { data: claim, error } = await adminClient
      .from('thread_calendar_nudge')
      .upsert(
        {
          workspace_id: d.workspace_id,
          thread_id: d.thread_id,
          after_send_at: d.after_send_at,
          change_count: d.change_count,
          oldest_at: d.oldest_at,
        },
        { onConflict: 'thread_id,after_send_at', ignoreDuplicates: true },
      )
      .select('id');
    if (error) {
      console.error('[calendar-nudge] claim failed', { thread: d.thread_id, message: error.message });
      continue;
    }
    // No row back: another tick (or an earlier one) holds this batch.
    const claimId = (claim ?? [])[0]?.id as string | undefined;
    if (!claimId) {
      result.already += 1;
      continue;
    }
    if (!d.organiser_email) {
      console.warn('[calendar-nudge] organiser has no address; not reminded', { thread: d.thread_id });
      await adminClient.from('thread_calendar_nudge').update({ skipped: 'no organiser address' }).eq('id', claimId);
      result.skipped += 1;
      continue;
    }
    try {
      const locale = await (opts.locale ?? ((e: string) => platformEmailLocale(e)))(d.organiser_email);
      const mail = calendarNudgeEmail({
        threadTitle: d.thread_title,
        count: d.change_count,
        titles: d.titles,
        url: `${appUrl('the-thread', process.env as Record<string, string>)}/threads/${d.thread_id}`,
        locale,
      });
      await send({ to: d.organiser_email, subject: mail.subject, text: mail.text, html: mail.html });
      await adminClient.from('thread_calendar_nudge').update({ sent_at: new Date().toISOString() }).eq('id', claimId);
      result.sent += 1;
    } catch (e) {
      // Not retried: the claim stands, so a failing address is not mailed
      // every five minutes. The row says what happened.
      console.error('[calendar-nudge] send failed', { thread: d.thread_id, message: (e as Error).message });
      await adminClient
        .from('thread_calendar_nudge')
        .update({ skipped: `send failed: ${(e as Error).message}`.slice(0, 500) })
        .eq('id', claimId);
      result.skipped += 1;
    }
  }
  return result;
}

/** The switch: `platform_setting` key `calendar_nudge`, value `on`. Anything
 *  else (absent, a failed read) is OFF, and the scheduler only LOGS what it
 *  would send — so the first deploy anywhere is a dry run, and the list of
 *  who would be mailed can be read before anybody is (the coordinator's
 *  condition, 2026-10-16). */
export const NUDGE_SETTING = 'calendar_nudge';

export async function nudgeSwitchOn(): Promise<boolean> {
  const { data, error } = await adminClient.from('platform_setting').select('value').eq('key', NUDGE_SETTING).maybeSingle();
  if (error) return false;
  return data?.value === 'on';
}

/** The scheduler's entry: mails when switched on, otherwise logs the would-be
 *  reminders by thread (never an address). */
export async function runCalendarNudgeJob(): Promise<void> {
  if (await nudgeSwitchOn()) {
    const r = await runCalendarNudge();
    if (r.due) console.log('[calendar-nudge]', r);
    return;
  }
  const due = await nudgesDue();
  if (due.length) {
    console.log(
      '[calendar-nudge] DRY (switch off): would remind',
      due.map((d) => ({ thread: d.thread_id, changes: d.change_count, oldest: d.oldest_at, has_address: !!d.organiser_email })),
    );
  }
}
