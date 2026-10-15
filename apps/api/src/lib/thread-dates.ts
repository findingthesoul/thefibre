// A thread's three dates, loaded from the database for any number of threads
// at once. The RULE is @thefibre/shared/thread-dates; this file only gathers
// its inputs — so the API, the cards and the message tags read one answer.
//
// Inputs, per thread:
//   · program starts_on / ends_on, and the thread's zone;
//   · its PUBLISHED sessions with a start ("every timed item" may be a key
//     moment — Sjoerd, 2026-10-16); a draft never defines public dates;
//   · the chosen close session (signups_close_engagement_id), when it still
//     has a start;
//   · whether it is on a TEAM CALENDAR: its team is published and active and
//     some membership grant carries that team's calendar (the agenda
//     calendarVisible / could-join list). Such a thread keeps today's close
//     rule when it has no key moment (the fallback in the shared module).

import { adminClient } from '../db.js';
import { rows } from './rows.js';
import { teamCalendarConfig } from './member-discount.js';
import { threadDates, type ThreadDates } from '@thefibre/shared/thread-dates';

export type { ThreadDates } from '@thefibre/shared/thread-dates';

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** The team ids, of those given, whose calendar some membership grant carries. */
export async function teamsWithACalendar(teamIds: string[]): Promise<Set<string>> {
  const wanted = new Set(teamIds.filter(Boolean));
  if (!wanted.size) return new Set();
  const grants = rows(
    'team calendar grants',
    await adminClient
      .from('membership_access_grant')
      .select('config')
      .eq('kind', 'team_calendar')
      .in('config->>team_id', [...wanted]),
  ) as { config: Record<string, unknown> | null }[];
  const out = new Set<string>();
  for (const g of grants) {
    const cfg = teamCalendarConfig(g.config);
    if (cfg && wanted.has(cfg.teamId)) out.add(cfg.teamId);
  }
  return out;
}

/** The thread ids, of those given, named in a membership `thread` grant —
 *  by id, or by slug for a grant not yet backfilled (as threadReferenceCounts
 *  in lib/thread-grant.ts reads them). */
export async function threadsInAMembershipGrant(
  threads: { id: string; slug: string; workspace_id: string }[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const workspaces = [...new Set(threads.map((t) => t.workspace_id))];
  if (!workspaces.length) return out;
  const grants = rows(
    'thread grants',
    await adminClient.from('membership_access_grant').select('workspace_id, config').eq('kind', 'thread').in('workspace_id', workspaces),
  ) as { workspace_id: string; config: Record<string, unknown> | null }[];
  const { threadSlugFromConfig } = await import('./thread-access.js');
  for (const t of threads) {
    const hit = grants.some((g) => {
      if (g.workspace_id !== t.workspace_id) return false;
      const c = g.config ?? {};
      return c.thread_id ? c.thread_id === t.id : threadSlugFromConfig(c) === t.slug;
    });
    if (hit) out.add(t.id);
  }
  return out;
}

/** Each thread's dates, by thread id. A thread that does not exist is absent. */
export async function loadThreadDates(threadIds: string[]): Promise<Map<string, ThreadDates>> {
  const ids = [...new Set(threadIds.filter(Boolean))];
  const out = new Map<string, ThreadDates>();
  if (!ids.length) return out;

  const threads = rows(
    'thread dates: threads',
    await adminClient
      .from('thread_thread')
      .select('id, slug, workspace_id, timezone, team_id, signups_close_engagement_id, program:program_id (starts_on, ends_on), team:team_id (is_published, is_active)')
      .in('id', ids),
  ) as Record<string, unknown>[];
  const sessions = rows(
    'thread dates: sessions',
    await adminClient
      .from('thread_engagement')
      .select('id, thread_id, starts_at, ends_at, is_key_moment, status')
      .in('thread_id', ids)
      .not('starts_at', 'is', null),
  ) as { id: string; thread_id: string; starts_at: string; ends_at: string | null; is_key_moment: boolean; status: string }[];

  const calendarTeams = await teamsWithACalendar(
    threads
      .filter((t) => {
        const team = one(t.team as never) as { is_published?: boolean | null; is_active?: boolean | null } | null;
        return !!team && team.is_published === true && team.is_active !== false;
      })
      .map((t) => t.team_id as string),
  );

  const granted = await threadsInAMembershipGrant(
    threads.map((t) => ({ id: t.id as string, slug: t.slug as string, workspace_id: t.workspace_id as string })),
  );

  const byThread = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = byThread.get(s.thread_id) ?? [];
    list.push(s);
    byThread.set(s.thread_id, list);
  }

  for (const t of threads) {
    const all = byThread.get(t.id as string) ?? [];
    const published = all
      .filter((s) => s.status === 'published')
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    const closeId = t.signups_close_engagement_id as string | null;
    const close = closeId ? (all.find((s) => s.id === closeId) ?? null) : null;
    const program = one(t.program as never) as { starts_on: string | null; ends_on: string | null } | null;
    out.set(
      t.id as string,
      threadDates({
        program: { starts_on: program?.starts_on ?? null, ends_on: program?.ends_on ?? null },
        keyMoments: published.filter((s) => s.is_key_moment),
        closeSession: close ? { starts_at: close.starts_at } : null,
        firstSession: published[0] ? { starts_at: published[0].starts_at } : null,
        onTeamCalendar: !!t.team_id && calendarTeams.has(t.team_id as string),
        inMembershipGrant: granted.has(t.id as string),
        timeZone: (t.timezone as string | null) || 'Europe/Amsterdam',
      }),
    );
  }
  return out;
}

/** The additive public fields, for any payload that describes a thread. */
export function publicDateFields(d: ThreadDates | undefined): {
  event_starts_at: string | null;
  event_ends_at: string | null;
  key_moment_count: number;
  signups_close_at: string | null;
} {
  return {
    event_starts_at: d?.event?.start ?? null,
    event_ends_at: d?.event?.end ?? null,
    key_moment_count: d?.event?.count ?? 0,
    signups_close_at: d?.signupsCloseAt ?? null,
  };
}
