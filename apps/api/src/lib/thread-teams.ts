// WHICH TEAMS A THREAD IS FOR — the one reader.
//
// Sjoerd, 2026-10-16 ("Yes, build it"): a thread keeps ONE owner —
// thread_thread.team_id, or none for a workspace thread — which keeps the
// public address and the money; and it can be OFFERED to more teams in the
// same workspace (thread_team_offer), whose members then see it as if it were
// their own team's thread.
//
// "Is this thread for team X?" used to be `thread.team_id === X`, asked in
// five places. Every one of them asks here now:
//   - could-join (my.thread's "you could join", and the team calendar);
//   - the member discount (the public hint and the price);
//   - member-notify (a team's followers hear about a new thread);
//   - the public team page;
//   - the ?team= embed list.
// A sixth place that compares team_id itself is the bug this file exists to
// prevent: an offered thread that shows in the list and is charged full price.
//
// THE AUDIENCE IS A SET: owner ∪ offers. The table's guard refuses an offer
// naming the owner at INSERT, but a thread's owner can later change to a team
// that already holds an offer — that row is then the owner twice, and a set
// counts it once. (Coordinator, 2026-10-16.)
//
// Service role, so the workspace boundary is ours: the guard keeps every
// offer in its thread's workspace, and every id here came from the server.

import { adminClient } from '../db.js';

/** owner ∪ offers, deduplicated; a workspace thread (no owner) has only offers. */
export function audienceOf(ownerTeamId: string | null | undefined, offeredTeamIds: Iterable<string>): Set<string> {
  const out = new Set<string>(offeredTeamIds);
  if (ownerTeamId) out.add(ownerTeamId);
  return out;
}

/** The OFFERED teams of each thread (not the owner). */
async function offersOf(threadIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!threadIds.length) return out;
  const { data, error } = await adminClient
    .from('thread_team_offer')
    .select('thread_id, team_id')
    .in('thread_id', threadIds);
  if (error) throw new Error(`thread-teams: offers: ${error.message}`);
  for (const r of data ?? []) {
    const k = r.thread_id as string;
    out.set(k, [...(out.get(k) ?? []), r.team_id as string]);
  }
  return out;
}

/**
 * Every team each thread is for: its owner and the teams it is offered to.
 * `owners` maps thread → owner team (null for a workspace thread) when the
 * caller already read the thread; threads missing from it are read here.
 */
export async function audienceTeams(
  threadIds: string[],
  owners?: Map<string, string | null>,
): Promise<Map<string, Set<string>>> {
  const ids = [...new Set(threadIds)];
  const known = new Map(owners ?? []);
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) {
    const { data, error } = await adminClient.from('thread_thread').select('id, team_id').in('id', missing);
    if (error) throw new Error(`thread-teams: owners: ${error.message}`);
    for (const r of data ?? []) known.set(r.id as string, (r.team_id as string | null) ?? null);
  }
  const offers = await offersOf(ids);
  const out = new Map<string, Set<string>>();
  for (const id of ids) out.set(id, audienceOf(known.get(id) ?? null, offers.get(id) ?? []));
  return out;
}

/** One thread's audience. */
export async function audienceTeamsOf(threadId: string, ownerTeamId?: string | null): Promise<Set<string>> {
  const owners = ownerTeamId === undefined ? undefined : new Map([[threadId, ownerTeamId]]);
  return (await audienceTeams([threadId], owners)).get(threadId) ?? new Set();
}

/**
 * The inverse: which threads are for ANY of these teams — owned by one, or
 * offered to one — with, per thread, WHICH of the asked teams it is for.
 * The callers that start from a team (a member's calendars, a team page, an
 * embed) use this instead of `.in('team_id', teams)`.
 */
export async function threadsForTeams(teamIds: string[]): Promise<Map<string, Set<string>>> {
  const asked = [...new Set(teamIds)];
  const out = new Map<string, Set<string>>();
  if (!asked.length) return out;
  const add = (thread: string, team: string) => out.set(thread, (out.get(thread) ?? new Set()).add(team));
  const [owned, offered] = await Promise.all([
    adminClient.from('thread_thread').select('id, team_id').in('team_id', asked),
    adminClient.from('thread_team_offer').select('thread_id, team_id').in('team_id', asked),
  ]);
  if (owned.error) throw new Error(`thread-teams: owned: ${owned.error.message}`);
  if (offered.error) throw new Error(`thread-teams: offered: ${offered.error.message}`);
  for (const r of owned.data ?? []) add(r.id as string, r.team_id as string);
  for (const r of offered.data ?? []) add(r.thread_id as string, r.team_id as string);
  return out;
}
