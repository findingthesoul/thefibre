// The web push pass: bell rows marked `push_state = 'pending'` become pushes
// to the devices their person opted in on (docs/web-push-plan.md, Sjoerd's
// answers of 2026-10-16). Runs at the end of every member-notify tick.
//
// No new events. A row is pending only because member-notify wrote it so
// (insertNotifications), by the same rules as the bell and the digest.
//
// THE RULES, all in `planPushes` (pure, clock passed in, tested):
//
//   * ONE PUSH PER GROUP. Session changes group per person, thread and kind
//     — one SEND is one push per thread. New threads group per person and
//     community, and wait for the same 15 quiet minutes as the digest email:
//     an organiser loading a year's agenda is one push, not thirty.
//   * QUIET HOURS, 22:00–08:00 in the thread's own timezone: held until
//     morning. Except a session change whose session starts within the next
//     12 hours — tomorrow 9:00 being cancelled is worth knowing tonight.
//   * A CAP OF 6 PUSHES per person per rolling 24 hours. Over it, the group is
//     skipped; it stays in the bell, where nothing is lost.
//   * STALE AFTER 48 HOURS. A row still pending that long (an outage, a
//     device that kept failing) is skipped, never delivered late.
//   * NO DEVICE LEFT (the person turned push off after the row was written):
//     skipped.
//
// Grouped by EMAIL, not person: person rows are per workspace, a phone is the
// human's. The cap counts across all their communities.
//
// Delivery (`runPushPass`): every device of that email. A 404/410 deletes the
// device at once; other failures count, and the device goes after 5 of them
// over 3+ days. A group is 'sent' when any device took it; left pending when
// every attempt failed for a reason that may pass (retried next tick, until
// stale); 'skipped' when every device turned out to be gone.

import { adminClient } from '../db.js';
import { platformEmailLocale } from './email/platform-i18n.js';
import { pushT } from './push-i18n.js';
import { sendPush, vapidConfig, type PushPayload } from './web-push.js';

export const NEW_THREAD_QUIET_MS = 15 * 60 * 1000;
export const CAP_PER_DAY = 6;
export const STALE_MS = 48 * 60 * 60 * 1000;
export const URGENT_WITHIN_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ = 'Europe/Amsterdam';

export type PendingRow = {
  id: string;
  email: string;
  workspace_id: string;
  kind: 'new_thread' | 'session_added' | 'session_moved' | 'session_cancelled';
  thread_id: string | null;
  subject: string;
  starts_at: string | null;
  created_at: string;
};

export type PushGroup = {
  email: string;
  kind: PendingRow['kind'];
  workspace_id: string;
  thread_id: string | null;
  rows: PendingRow[];
};

export type PlanContext = {
  now: Date;
  /** Devices each email has right now. */
  devicesByEmail: Map<string, number>;
  /** Pushes already sent to each email in the last 24 hours. */
  sentLast24h: Map<string, number>;
  /** The thread's own timezone, for quiet hours. */
  tzByThread: Map<string, string>;
};

export type Plan = {
  send: PushGroup[];
  /** Rows that will never be pushed: stale, capped, or no device. */
  skip: string[];
  /** Rows held for later: quiet hours, or a new-thread burst still arriving. */
  hold: string[];
};

/** The hour of the day at `now` in a timezone; an unknown zone reads as the default. */
export function localHour(now: Date, tz: string): number {
  const hourIn = (zone: string) =>
    Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: zone }).format(now));
  try {
    return hourIn(tz);
  } catch {
    return hourIn(DEFAULT_TZ);
  }
}

export function isQuietHour(hour: number): boolean {
  return hour >= 22 || hour < 8;
}

export function planPushes(rows: PendingRow[], ctx: PlanContext): Plan {
  const now = ctx.now.getTime();
  const plan: Plan = { send: [], skip: [], hold: [] };

  const fresh: PendingRow[] = [];
  for (const r of rows) {
    if (now - Date.parse(r.created_at) > STALE_MS) plan.skip.push(r.id);
    else if (!(ctx.devicesByEmail.get(r.email) ?? 0)) plan.skip.push(r.id);
    else fresh.push(r);
  }

  // Group: session changes per email+thread+kind; new threads per email+community.
  const groups = new Map<string, PushGroup>();
  for (const r of fresh) {
    const key = r.kind === 'new_thread' ? `${r.email}|new|${r.workspace_id}` : `${r.email}|${r.kind}|${r.thread_id ?? r.id}`;
    const g = groups.get(key) ?? { email: r.email, kind: r.kind, workspace_id: r.workspace_id, thread_id: r.thread_id, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }

  // Oldest first, so when the cap bites it is the newest that waits for the bell.
  const ordered = [...groups.values()].sort(
    (a, b) => Math.min(...a.rows.map((r) => Date.parse(r.created_at))) - Math.min(...b.rows.map((r) => Date.parse(r.created_at))),
  );
  const used = new Map(ctx.sentLast24h);

  for (const g of ordered) {
    const ids = g.rows.map((r) => r.id);

    // A new-thread burst still arriving waits for quiet, like the digest.
    if (g.kind === 'new_thread') {
      const newest = Math.max(...g.rows.map((r) => Date.parse(r.created_at)));
      if (now - newest < NEW_THREAD_QUIET_MS) {
        plan.hold.push(...ids);
        continue;
      }
    }

    const tz = (g.thread_id && ctx.tzByThread.get(g.thread_id)) || DEFAULT_TZ;
    if (isQuietHour(localHour(ctx.now, tz))) {
      const urgent =
        g.kind !== 'new_thread' &&
        g.rows.some((r) => {
          if (!r.starts_at) return false;
          const until = Date.parse(r.starts_at) - now;
          return until >= 0 && until <= URGENT_WITHIN_MS;
        });
      if (!urgent) {
        plan.hold.push(...ids);
        continue;
      }
    }

    const count = used.get(g.email) ?? 0;
    if (count >= CAP_PER_DAY) {
      plan.skip.push(...ids);
      continue;
    }
    used.set(g.email, count + 1);
    plan.send.push(g);
  }
  return plan;
}

/** The lock screen's words for one group, in the reader's language. */
export function payloadFor(g: PushGroup, locale: string, community: string | null): PushPayload {
  const first = g.rows[0]!;
  let title: string;
  if (g.kind === 'new_thread') {
    title =
      g.rows.length === 1
        ? pushT(locale, 'push_new_one', { subject: first.subject })
        : pushT(locale, 'push_new_many', { n: g.rows.length, community: community ?? '' });
  } else {
    const key =
      g.kind === 'session_added' ? 'push_session_added' : g.kind === 'session_moved' ? 'push_session_moved' : 'push_session_cancelled';
    title = pushT(locale, key, { subject: first.subject });
    if (g.rows.length > 1) title = pushT(locale, 'push_and_more', { title, n: g.rows.length - 1 });
  }
  return {
    title,
    url: '/notifications',
    // Per thread for session changes, so a second change replaces the first
    // on the lock screen; per community for new threads.
    tag: g.kind === 'new_thread' ? `calendar:${g.workspace_id}` : `thread:${g.thread_id ?? first.id}`,
  };
}

const one = <T>(v: unknown): T | null => (!v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T));

/** One pass. Dark (does nothing) until the stack has VAPID keys. */
export async function runPushPass(now: Date = new Date()): Promise<{ sent: number; skipped: number; held: number }> {
  const cfg = vapidConfig();
  if (!cfg) return { sent: 0, skipped: 0, held: 0 };

  const { data, error } = await adminClient
    .from('member_notification')
    .select('id, workspace_id, kind, thread_id, subject, starts_at, created_at, person:person_id (email)')
    .eq('push_state', 'pending')
    .order('created_at', { ascending: true })
    .limit(1000);
  // A failed read is a quiet tick: nothing is marked, the next tick retries.
  if (error) throw new Error(`push pending: ${error.message}`);
  const rows: PendingRow[] = [];
  const orphaned: string[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const email = (one<{ email: string | null }>(r.person)?.email ?? '').toLowerCase();
    if (!email) {
      orphaned.push(r.id as string);
      continue;
    }
    rows.push({
      id: r.id as string,
      email,
      workspace_id: r.workspace_id as string,
      kind: r.kind as PendingRow['kind'],
      thread_id: (r.thread_id as string | null) ?? null,
      subject: r.subject as string,
      starts_at: (r.starts_at as string | null) ?? null,
      created_at: r.created_at as string,
    });
  }
  if (orphaned.length) await mark(orphaned, 'skipped', now);
  if (!rows.length) return { sent: 0, skipped: orphaned.length, held: 0 };

  const emails = [...new Set(rows.map((r) => r.email))];
  const threadIds = [...new Set(rows.map((r) => r.thread_id).filter(Boolean))] as string[];
  const [subs, sentRows, threads] = await Promise.all([
    adminClient.from('push_subscription').select('id, email, endpoint, p256dh, auth, fail_count, first_fail_at').in('email', emails),
    adminClient
      .from('member_notification')
      .select('pushed_at, person:person_id (email)')
      .eq('push_state', 'sent')
      .gte('pushed_at', new Date(now.getTime() - DAY_MS).toISOString()),
    threadIds.length
      ? adminClient.from('thread_thread').select('id, timezone').in('id', threadIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (subs.error) throw new Error(`push devices: ${subs.error.message}`);
  // Throw rather than read an empty list as "nothing sent today": that would
  // lift the cap exactly when the database is struggling.
  if (sentRows.error) throw new Error(`push cap: ${sentRows.error.message}`);

  type Sub = { id: string; email: string; endpoint: string; p256dh: string; auth: string; fail_count: number; first_fail_at: string | null };
  const devices = new Map<string, Sub[]>();
  for (const s of (subs.data ?? []) as Sub[]) devices.set(s.email, [...(devices.get(s.email) ?? []), s]);

  // A push stamps every row it carries with ONE pushed_at, so distinct
  // timestamps per email = pushes sent.
  const stamps = new Map<string, Set<string>>();
  for (const r of (sentRows.data ?? []) as Record<string, unknown>[]) {
    const email = (one<{ email: string | null }>(r.person)?.email ?? '').toLowerCase();
    if (!email || !r.pushed_at) continue;
    stamps.set(email, (stamps.get(email) ?? new Set()).add(r.pushed_at as string));
  }

  const plan = planPushes(rows, {
    now,
    devicesByEmail: new Map([...devices].map(([e, d]) => [e, d.length])),
    sentLast24h: new Map([...stamps].map(([e, s]) => [e, s.size])),
    tzByThread: new Map(
      ((threads.data ?? []) as { id: string; timezone: string | null }[]).map((t) => [t.id, t.timezone || DEFAULT_TZ]),
    ),
  });

  await mark(plan.skip, 'skipped', now);
  let sent = 0;
  const communityNames = await workspaceNames([...new Set(plan.send.filter((g) => g.kind === 'new_thread').map((g) => g.workspace_id))]);
  const localeCache = new Map<string, string>();

  for (const g of plan.send) {
    let locale = localeCache.get(g.email);
    if (!locale) {
      locale = await platformEmailLocale(g.email);
      localeCache.set(g.email, locale);
    }
    const payload = payloadFor(g, locale, communityNames.get(g.workspace_id) ?? null);
    const ids = g.rows.map((r) => r.id);
    const targets = devices.get(g.email) ?? [];
    let anySent = false;
    let anyFailed = false;
    for (const d of targets) {
      const outcome = await sendPush(d, payload, cfg);
      if (outcome === 'sent') {
        anySent = true;
        await adminClient
          .from('push_subscription')
          .update({ last_ok_at: now.toISOString(), fail_count: 0, first_fail_at: null })
          .eq('id', d.id);
      } else if (outcome === 'gone') {
        // Hard delete — the approved exception to soft delete (2026-10-16).
        await adminClient.from('push_subscription').delete().eq('id', d.id);
      } else {
        anyFailed = true;
        const failCount = (d.fail_count ?? 0) + 1;
        const firstFail = d.first_fail_at ?? now.toISOString();
        if (failCount >= 5 && now.getTime() - Date.parse(firstFail) >= 3 * DAY_MS) {
          await adminClient.from('push_subscription').delete().eq('id', d.id);
        } else {
          await adminClient.from('push_subscription').update({ fail_count: failCount, first_fail_at: firstFail }).eq('id', d.id);
        }
      }
    }
    if (anySent) {
      await mark(ids, 'sent', now);
      sent += 1;
    } else if (!anyFailed) {
      // Every device was gone.
      await mark(ids, 'skipped', now);
    }
    // else: every attempt failed for a reason that may pass — left pending.
  }
  return { sent, skipped: plan.skip.length + orphaned.length, held: plan.hold.length };
}

async function mark(ids: string[], state: 'sent' | 'skipped', at: Date): Promise<void> {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await adminClient
      .from('member_notification')
      .update({ push_state: state, ...(state === 'sent' ? { pushed_at: at.toISOString() } : {}) })
      .in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`push mark ${state}: ${error.message}`);
  }
}

async function workspaceNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data } = await adminClient.from('workspace').select('id, name').in('id', ids);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((w) => [w.id, w.name]));
}

/** Which of these people have at least one device that opted in. For
 *  member-notify's insert: only their rows are written 'pending'. */
export async function personsWithDevices(personIds: string[]): Promise<Set<string>> {
  if (!personIds.length) return new Set();
  const { data: persons, error } = await adminClient.from('person').select('id, email').in('id', personIds);
  // A failed read means nobody gets 'pending' this time: the bell row is still
  // written, only the push is missed. Never the other way round.
  if (error) return new Set();
  const byEmail = new Map<string, string[]>();
  for (const p of (persons ?? []) as { id: string; email: string | null }[]) {
    const e = p.email?.toLowerCase();
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), p.id]);
  }
  if (!byEmail.size) return new Set();
  const { data: subs } = await adminClient.from('push_subscription').select('email').in('email', [...byEmail.keys()]);
  const out = new Set<string>();
  for (const s of (subs ?? []) as { email: string }[]) for (const id of byEmail.get(s.email) ?? []) out.add(id);
  return out;
}
