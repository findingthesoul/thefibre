// Connections — the landscape.
//
// A read, not a store. Everything here is derived from tables other apps
// already fill: activity, enrolment, thread enrolment, purchases, membership
// and who runs things. Nothing is written, nothing is configured, and there
// is no schema of its own — which is why this surface shows something useful
// on the day it ships and asks nobody to fill anything in.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const connectionsRoutes = new Hono();

/** The ladder, low to high. Order matters — the bands render in it. */
const RUNGS = ['never', 'touched', 'attended', 'returned', 'contributor', 'facilitator'] as const;

// The five axes (docs/connections-mobile.md §2, D32). Same population, same
// visual, same arithmetic — only what the bands MEAN changes. Each list runs
// low to high, because "up" and "down" in the movement list are positions in
// this array and nothing else.
//
// closeness and opportunity read current-state columns with no history, so
// connections_landscape_axis returns today's value at every cutoff. Movement
// on those two is therefore near-always empty, which is the truthful answer:
// nothing records that anybody moved.
const BANDS = {
  maturity: RUNGS,
  closeness: ['unrated', 'weak', 'warm', 'strong', 'advocate'],
  cadence: ['never_spoken', 'quiet', 'slowing', 'in_rhythm'],
  opportunity: ['none', 'open', 'proposal', 'committed'],
  contribution: ['brought_nobody', 'brought_someone', 'brings_regularly'],
} as const satisfies Record<string, readonly string[]>;

type Axis = keyof typeof BANDS;
const AXES = Object.keys(BANDS) as [Axis, ...Axis[]];

const LandscapeQuery = z.object({
  /** How far back "movement" looks. Default a month. */
  since_days: z.coerce.number().int().min(1).max(400).default(30),
  /** Which question the bands answer. Defaults to the ladder, so every
   *  caller written before the picker existed keeps its exact response. */
  axis: z.enum(AXES).default('maturity'),
  /**
   * Also return the per-person rows, which this handler already has in
   * memory and was throwing away.
   *
   * The bands are counts, and counts are all the landscape needs. But any
   * surface listing PEOPLE — /people, a cohort drill-down — needs each
   * person's standing, and there was no way to get it: web cannot call the
   * RPC directly (no direct Supabase from the frontend), so the only
   * alternative was rendering a rung for the ≤40 who moved, which would
   * read as "these people have a standing and those do not". False.
   *
   * Off by default: the landscape itself renders six numbers and should not
   * pay for four hundred rows to do it.
   */
  people: z.coerce.boolean().default(false),
});

// `last_seen` is gone: connections_landscape returned it, nothing here ever
// read it, and only the ladder has such a column to return. Not in the
// response, so nothing outside this file notices.
type Row = { person_id: string; rung: string };

async function landscapeAt(workspaceId: string, axis: Axis, asOf?: Date) {
  const { data, error } = await adminClient.rpc('connections_landscape_axis', {
    p_workspace: workspaceId,
    p_axis: axis,
    ...(asOf ? { p_as_of: asOf.toISOString() } : {}),
  });
  if (error) throw new Error(error.message);
  // One shape for five axes: the function returns `band`, and this route has
  // always called it `rung`. Kept, because /landscape's response is read by
  // a shipped page and renaming a field to suit a new axis would break it.
  return ((data ?? []) as unknown as { person_id: string; band: string }[]).map(
    (r): Row => ({ person_id: r.person_id, rung: r.band }),
  );
}

// GET /connections/landscape — the shape of the community, and what moved.
//
// Movement is free because every source is a timestamped event: "what did
// this look like a month ago" is the same query with an earlier cutoff. No
// snapshot table, and the answer can never drift from the facts underneath.
connectionsRoutes.get('/landscape', async (c) => {
  const ctx = c.get('ctx');
  const parsed = LandscapeQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const since = new Date(Date.now() - parsed.data.since_days * 86_400_000);
  const axis = parsed.data.axis;
  const ladder = BANDS[axis] as readonly string[];

  let now: Row[];
  let then: Row[];
  try {
    [now, then] = await Promise.all([
      landscapeAt(ctx.workspaceId, axis),
      landscapeAt(ctx.workspaceId, axis, since),
    ]);
  } catch (e) {
    console.error('[connections/landscape] failed', axis, (e as Error).message);
    return c.json({ error: (e as Error).message }, 500);
  }

  const tally = (rows: Row[]) => {
    const m = Object.fromEntries(ladder.map((r) => [r, 0])) as Record<string, number>;
    for (const r of rows) if (r.rung in m) m[r.rung] = (m[r.rung] ?? 0) + 1;
    return m;
  };

  const before = new Map(then.map((r) => [r.person_id, r.rung]));
  const rank = (r: string) => ladder.indexOf(r);

  // Only people who existed at both ends can have "moved" — somebody who
  // arrived since is new, which is a different fact and counted separately.
  const moved: { person_id: string; from: string; to: string; up: boolean }[] = [];
  let arrived = 0;
  for (const r of now) {
    const was = before.get(r.person_id);
    if (was === undefined) {
      arrived += 1;
      continue;
    }
    if (was !== r.rung) {
      moved.push({ person_id: r.person_id, from: was, to: r.rung, up: rank(r.rung) > rank(was) });
    }
  }

  // Names only for the handful that moved — the bands need counts, not
  // people, and pulling four hundred rows to render six numbers would be
  // the thing that makes this page slow enough to stop opening.
  const ids = moved.slice(0, 40).map((m) => m.person_id);
  // Scoped explicitly. The ids came out of a workspace-scoped function, so
  // this changes nothing today — but adminClient bypasses RLS, and a read of
  // `person` that names no workspace is the shape every cross-tenant leak in
  // this codebase has had. Cheaper to state than to re-verify.
  const { data: people } = ids.length
    ? await adminClient
        .from('person')
        .select('id, first_name, last_name, email')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', ids)
    : { data: [] as Record<string, unknown>[] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));

  const counts = tally(now);
  const wasCounts = tally(then);

  // Net movement per rung, counted ONLY over people who existed at both ends.
  //
  // The obvious delta — count now minus count then — is wrong in a way that
  // reads as insight. On a young workspace every band shows a fat "+n"
  // because those people did not exist a month ago, so "Contributes +6"
  // looks like six promotions and is six arrivals. Arrivals are a different
  // fact and are reported on their own.
  const net = Object.fromEntries(ladder.map((r) => [r, 0])) as Record<string, number>;
  for (const m of moved) {
    net[m.to] = (net[m.to] ?? 0) + 1;
    net[m.from] = (net[m.from] ?? 0) - 1;
  }

  return c.json({
    total: now.length,
    since_days: parsed.data.since_days,
    axis,
    // Highest rung first: the top of the ladder is the part worth protecting.
    bands: [...ladder].reverse().map((rung) => ({
      rung,
      count: counts[rung] ?? 0,
      was: wasCounts[rung] ?? 0,
      net_moved: net[rung] ?? 0,
    })),
    arrived,
    moved: moved.slice(0, 40).map((m) => ({ ...m, person: byId.get(m.person_id) ?? null })),
    moved_total: moved.length,
    // Additive and omitted unless asked for, so every existing caller sees
    // the response it already saw.
    ...(parsed.data.people ? { people: now.map((r) => ({ person_id: r.person_id, rung: r.rung })) } : {}),
  });
});

const AttentionQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

type AttentionRow = {
  person_id: string;
  condition: string;
  since: string | null;
  detail: string;
};

// GET /connections/attention — who needs something, and why in words.
//
// Never a score. Each row carries the fact that produced it, so the
// interface can explain itself instead of asking to be trusted.
connectionsRoutes.get('/attention', async (c) => {
  const ctx = c.get('ctx');
  const parsed = AttentionQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { data, error } = await adminClient.rpc('connections_attention', {
    p_workspace: ctx.workspaceId,
    p_limit: parsed.data.limit,
  });
  if (error) {
    console.error('[connections/attention] failed', error);
    return c.json({ error: error.message }, 500);
  }

  const rows = (data ?? []) as unknown as AttentionRow[];
  const ids = [...new Set(rows.map((r) => r.person_id))];
  // Scoped explicitly — see the note on the landscape read above.
  const { data: people } = ids.length
    ? await adminClient
        .from('person')
        .select('id, first_name, last_name, email')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', ids)
    : { data: [] as Record<string, unknown>[] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));

  return c.json({
    items: rows.map((r) => ({ ...r, person: byId.get(r.person_id) ?? null })),
  });
});
