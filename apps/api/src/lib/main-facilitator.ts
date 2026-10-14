// The main facilitator — whose room a thread's sessions meet in.
//
// Sjoerd, 2026-10-14: "I made the thread. But someone else will facilitate.
// Problem is that the Virtual room should be from the main facilitator."
//
// A "personal room" session took its address from whoever SAVED it (the
// editor read its own user's room), so a thread Sjoerd built and somebody
// else runs met in Sjoerd's room. Now a thread names its MAIN FACILITATOR —
// one of its hosts or facilitators holding an account
// (thread_thread.main_facilitator_id → thread_thread_organiser.id), or nobody,
// meaning the organiser as before — and the room is resolved from that
// person, on the server, whoever presses save.
//
// NOT FROZEN, BUT ONE WRITER. The room is still stored on each session
// (meeting_url): the public agenda, the portal, the .ics feed, invitations
// and scheduled emails all read that column, and teaching five readers to
// resolve at read time is where drift lives. Instead, when the room changes
// — a new main facilitator, that person removed, or that person editing
// their own room in Settings → Connections — `propagateRoom` rewrites the
// affected sessions and queues each as a calendar change, so participants
// hear of a new room through the organiser's SEND like any other change
// ("editing is not announcing"). The four guards, approved 2026-10-14:
//   (a) FUTURE sessions only — a past session's room is history;
//   (b) only `personal_room` sessions whose stored URL IS the old room — a
//       link somebody typed, or Zoom/Meet, is never overwritten;
//   (c) only threads where this person is the meeting account (the main
//       facilitator, or the organiser of a thread with none);
//   (d) removing the main facilitator falls back to the organiser, and that
//       is propagated and queued like any other change.

import { adminClient } from '../db.js';
import { userPersonalRoom } from './connections.js';
import { recordCalendarChange, calendarStateOf, isCalendarSession } from './calendar-invite.js';

const one = <T>(v: unknown): T | null =>
  !v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T);

export type MeetingAccount = {
  /** The account whose room and connections the sessions use. */
  userId: string | null;
  name: string;
  /** True when it is the named main facilitator, false for the organiser. */
  isMain: boolean;
  /** thread_thread_organiser.id of the main facilitator, when one is set. */
  mainRowId: string | null;
};

/** Whose account a thread's online sessions use. */
export async function meetingAccount(threadId: string): Promise<MeetingAccount> {
  const { data: t, error } = await adminClient
    .from('thread_thread')
    .select(
      'main_facilitator_id, organiser:organiser_id (user_id, display_name), main:main_facilitator_id (id, organiser:organiser_id (user_id, display_name))',
    )
    .eq('id', threadId)
    .maybeSingle();
  if (error) throw new Error(`meeting account: ${error.message}`);
  const main = one<{ id: string; organiser: unknown }>(t?.main);
  const mainOrg = one<{ user_id: string | null; display_name: string | null }>(main?.organiser);
  if (main && mainOrg?.user_id) {
    return { userId: mainOrg.user_id, name: await nameOf(mainOrg.user_id, mainOrg.display_name), isMain: true, mainRowId: main.id };
  }
  const org = one<{ user_id: string | null; display_name: string | null }>(t?.organiser);
  return {
    userId: org?.user_id ?? null,
    name: org?.user_id ? await nameOf(org.user_id, org.display_name) : 'The organiser',
    isMain: false,
    mainRowId: null,
  };
}

async function nameOf(userId: string, fallback: string | null): Promise<string> {
  const { data } = await adminClient.from('user_profile').select('display_name').eq('user_id', userId).maybeSingle();
  if (data?.display_name) return data.display_name as string;
  if (fallback) return fallback;
  const { data: u } = await adminClient.from('user').select('full_name, email').eq('id', userId).maybeSingle();
  return (u?.full_name as string | null) ?? (u?.email as string | null) ?? 'The organiser';
}

/** The room a `personal_room` session of this thread meets in, or null. */
export async function threadRoom(threadId: string): Promise<{ account: MeetingAccount; url: string | null }> {
  const account = await meetingAccount(threadId);
  return { account, url: await userPersonalRoom(account.userId) };
}

/** Whether `userId` said yes to organisers creating Google Meet / Zoom links
 *  on their connected account (their own Settings → Connections). */
export async function allowsOrganiserMeetings(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await adminClient
    .from('user_connection')
    .select('allow_organiser_meetings')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.allow_organiser_meetings === true;
}

/**
 * Whose room ONE SESSION meets in: its pinned host (room_owner_id) when set,
 * else the thread's main facilitator, else the organiser. A pinned row that
 * holds no account (a person-only host) cannot own a room — the route
 * refuses to pin one — so it falls through to the thread's account here.
 */
export async function sessionRoomAccount(threadId: string, roomOwnerId: string | null | undefined): Promise<MeetingAccount> {
  if (roomOwnerId) {
    const { data: row, error } = await adminClient
      .from('thread_thread_organiser')
      .select('id, organiser:organiser_id (user_id, display_name)')
      .eq('id', roomOwnerId)
      .eq('thread_id', threadId)
      .maybeSingle();
    if (error) throw new Error(`room owner: ${error.message}`);
    const o = one<{ user_id: string | null; display_name: string | null }>(row?.organiser);
    if (row && o?.user_id) return { userId: o.user_id, name: await nameOf(o.user_id, o.display_name), isMain: false, mainRowId: null };
  }
  return meetingAccount(threadId);
}

/** The room of one session's owner, or null. */
export async function sessionRoom(threadId: string, roomOwnerId: string | null | undefined): Promise<{ account: MeetingAccount; url: string | null }> {
  const account = await sessionRoomAccount(threadId, roomOwnerId);
  return { account, url: await userPersonalRoom(account.userId) };
}

/** Which account mints a Meet/Zoom link for a session: its room owner when
 *  that person has opted in (or IS the caller), otherwise the caller's own —
 *  using someone's OAuth credential needs THEIR yes. */
export async function mintingAccount(
  threadId: string,
  callerUserId: string,
  roomOwnerId: string | null = null,
): Promise<{ userId: string; onBehalf: boolean }> {
  const { userId } = await sessionRoomAccount(threadId, roomOwnerId);
  if (!userId || userId === callerUserId) return { userId: callerUserId, onBehalf: false };
  return (await allowsOrganiserMeetings(userId)) ? { userId, onBehalf: true } : { userId: callerUserId, onBehalf: false };
}

/** Pure: which sessions a room change rewrites (guards a and b). */
export function sessionsToMove<T extends { meeting_provider: string | null; meeting_url: string | null; starts_at: string | null }>(
  rows: T[],
  oldUrl: string | null,
  now: Date,
): T[] {
  return rows.filter(
    (r) =>
      r.meeting_provider === 'personal_room' &&
      // An unset room is matched too: a session saved while the account had
      // no room yet gets one when they add it.
      (r.meeting_url ?? null) === (oldUrl ?? null) &&
      !!r.starts_at &&
      new Date(r.starts_at).getTime() > now.getTime(),
  );
}

/**
 * Rewrite the room of one thread's future personal-room sessions from
 * `oldUrl` to `newUrl`, queueing each as a calendar change with `reason`.
 * Returns how many sessions moved.
 */
export async function propagateRoom(args: {
  threadId: string;
  oldUrl: string | null;
  newUrl: string | null;
  reason: string;
  /** WHOSE sessions: room_owner_id values to match, `null` meaning the
   *  sessions that follow the main facilitator. Default: those only. */
  owners?: (string | null)[];
  /** The account whose room the sessions now meet in (recorded as the
   *  session's meeting_account_user_id). */
  newAccountUserId?: string | null;
  actorUserId?: string | null;
  now?: Date;
}): Promise<number> {
  if ((args.oldUrl ?? null) === (args.newUrl ?? null)) return 0;
  const owners = args.owners ?? [null];
  const { data, error } = await adminClient
    .from('thread_engagement')
    .select('*')
    .eq('thread_id', args.threadId)
    .eq('meeting_provider', 'personal_room');
  if (error) throw new Error(`room sessions: ${error.message}`);
  const theirs = ((data ?? []) as { id: string; room_owner_id: string | null; meeting_provider: string | null; meeting_url: string | null; starts_at: string | null }[]).filter(
    (r) => owners.includes(r.room_owner_id ?? null),
  );
  const moving = sessionsToMove(theirs, args.oldUrl, args.now ?? new Date());
  let moved = 0;
  for (const row of moving) {
    const before = calendarStateOf(row as Record<string, unknown>);
    const { data: after, error: uErr } = await adminClient
      .from('thread_engagement')
      .update({
        meeting_url: args.newUrl,
        ...(args.newAccountUserId !== undefined ? { meeting_account_user_id: args.newAccountUserId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      // Only over the value just read (guard b, again, at write time).
      .eq('meeting_provider', 'personal_room')
      .select('*')
      .maybeSingle();
    if (uErr) throw new Error(`room update: ${uErr.message}`);
    if (!after) continue;
    moved += 1;
    if (isCalendarSession(after)) {
      await recordCalendarChange({ engagement: after, kind: 'moved', before, actorUserId: args.actorUserId ?? null, reason: args.reason });
    }
  }
  return moved;
}

/** Every thread whose meeting account is `userId` (guard c): threads naming
 *  them main facilitator, and threads they organise with none named. */
export async function threadsUsingAccount(userId: string): Promise<string[]> {
  const { data: org } = await adminClient.from('thread_organiser').select('id').eq('user_id', userId).maybeSingle();
  if (!org) return [];
  const [{ data: asMain, error: e1 }, { data: asOrganiser, error: e2 }] = await Promise.all([
    adminClient
      .from('thread_thread_organiser')
      .select('id, thread_id')
      .eq('organiser_id', org.id),
    adminClient.from('thread_thread').select('id').eq('organiser_id', org.id).is('main_facilitator_id', null),
  ]);
  if (e1 || e2) throw new Error(`threads for account: ${(e1 ?? e2)!.message}`);
  const rowIds = (asMain ?? []).map((r) => r.id as string);
  let mainThreads: string[] = [];
  if (rowIds.length) {
    const { data: t, error } = await adminClient.from('thread_thread').select('id').in('main_facilitator_id', rowIds);
    if (error) throw new Error(`threads for account: ${error.message}`);
    mainThreads = (t ?? []).map((r) => r.id as string);
  }
  return [...new Set([...mainThreads, ...(asOrganiser ?? []).map((r) => r.id as string)])];
}

/** After somebody changes their own personal room: move every session that
 *  meets in it — sessions following them as a thread's meeting account, and
 *  sessions pinned to one of their host rows on any thread (guard c). */
export async function propagatePersonalRoomChange(userId: string, oldUrl: string | null, newUrl: string | null): Promise<number> {
  if ((oldUrl ?? null) === (newUrl ?? null)) return 0;
  const name = await nameOf(userId, null);
  const reason = `room changed: ${name} updated their personal room`;
  let total = 0;
  for (const threadId of await threadsUsingAccount(userId)) {
    total += await propagateRoom({ threadId, oldUrl, newUrl, reason, owners: [null], actorUserId: userId });
  }
  const { data: org } = await adminClient.from('thread_organiser').select('id').eq('user_id', userId).maybeSingle();
  if (org) {
    const { data: rows, error } = await adminClient.from('thread_thread_organiser').select('id, thread_id').eq('organiser_id', org.id);
    if (error) throw new Error(`host rows: ${error.message}`);
    for (const r of rows ?? []) {
      total += await propagateRoom({ threadId: r.thread_id as string, oldUrl, newUrl, reason, owners: [r.id as string], actorUserId: userId });
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// WHO HOSTS A SESSION — the thread's hosts and facilitators, minus the ones
// unticked on it (thread_engagement.excluded_people). Named on the public
// agenda and in my.thread ("with Anna and Peter"), and, with an address,
// invited to the session's calendar entry.
// ---------------------------------------------------------------------------

export type ThreadHost = {
  /** thread_thread_organiser.id */
  id: string;
  role: 'host' | 'facilitator';
  name: string;
  /** The account, when the host has one (a person-only host has none). */
  userId: string | null;
  email: string | null;
};

/** Every host and facilitator of several threads, by thread — one read. */
export async function threadHostsFor(threadIds: string[]): Promise<Map<string, ThreadHost[]>> {
  const out = new Map<string, ThreadHost[]>();
  if (!threadIds.length) return out;
  const { data, error } = await adminClient
    .from('thread_thread_organiser')
    .select(
      'id, thread_id, role, organiser:organiser_id (user_id, display_name, user:user_id (email, full_name)), person:person_id (first_name, last_name, email)',
    )
    .in('thread_id', threadIds)
    .order('id', { ascending: true });
  if (error) throw new Error(`thread hosts: ${error.message}`);
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const o = one<{ user_id: string | null; display_name: string | null; user: unknown }>(r.organiser);
    const u = one<{ email: string | null; full_name: string | null }>(o?.user);
    const p = one<{ first_name: string | null; last_name: string | null; email: string | null }>(r.person);
    const personName = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
    const list = out.get(r.thread_id as string) ?? [];
    list.push({
      id: r.id as string,
      role: r.role as 'host' | 'facilitator',
      name: o?.display_name ?? u?.full_name ?? (personName || 'A host'),
      userId: o?.user_id ?? null,
      email: (u?.email ?? p?.email ?? null)?.trim().toLowerCase() || null,
    });
    out.set(r.thread_id as string, list);
  }
  return out;
}

/** Every host and facilitator of one thread. */
export async function threadHosts(threadId: string): Promise<ThreadHost[]> {
  return (await threadHostsFor([threadId])).get(threadId) ?? [];
}

/** Pure: the hosts ticked on one session. */
export function sessionHosts(hosts: ThreadHost[], excluded: string[] | null | undefined): ThreadHost[] {
  const out = new Set(excluded ?? []);
  return hosts.filter((h) => !out.has(h.id));
}
