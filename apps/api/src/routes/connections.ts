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
type Rung = (typeof RUNGS)[number];

const LandscapeQuery = z.object({
  /** How far back "movement" looks. Default a month. */
  since_days: z.coerce.number().int().min(1).max(400).default(30),
});

type Row = { person_id: string; rung: Rung; last_seen: string | null };

async function landscapeAt(workspaceId: string, asOf?: Date) {
  const { data, error } = await adminClient.rpc('connections_landscape', {
    p_workspace: workspaceId,
    ...(asOf ? { p_as_of: asOf.toISOString() } : {}),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
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

  let now: Row[];
  let then: Row[];
  try {
    [now, then] = await Promise.all([
      landscapeAt(ctx.workspaceId),
      landscapeAt(ctx.workspaceId, since),
    ]);
  } catch (e) {
    console.error('[connections/landscape] failed', (e as Error).message);
    return c.json({ error: (e as Error).message }, 500);
  }

  const tally = (rows: Row[]) => {
    const m = Object.fromEntries(RUNGS.map((r) => [r, 0])) as Record<Rung, number>;
    for (const r of rows) if (r.rung in m) m[r.rung] += 1;
    return m;
  };

  const before = new Map(then.map((r) => [r.person_id, r.rung]));
  const rank = (r: Rung) => RUNGS.indexOf(r);

  // Only people who existed at both ends can have "moved" — somebody who
  // arrived since is new, which is a different fact and counted separately.
  const moved: { person_id: string; from: Rung; to: Rung; up: boolean }[] = [];
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
  const { data: people } = ids.length
    ? await adminClient
        .from('person')
        .select('id, first_name, last_name, email')
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
  const net = Object.fromEntries(RUNGS.map((r) => [r, 0])) as Record<Rung, number>;
  for (const m of moved) {
    net[m.to] += 1;
    net[m.from] -= 1;
  }

  return c.json({
    total: now.length,
    since_days: parsed.data.since_days,
    // Highest rung first: the top of the ladder is the part worth protecting.
    bands: [...RUNGS].reverse().map((rung) => ({
      rung,
      count: counts[rung],
      was: wasCounts[rung],
      net_moved: net[rung],
    })),
    arrived,
    moved: moved.slice(0, 40).map((m) => ({ ...m, person: byId.get(m.person_id) ?? null })),
    moved_total: moved.length,
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
  const { data: people } = ids.length
    ? await adminClient.from('person').select('id, first_name, last_name, email').in('id', ids)
    : { data: [] as Record<string, unknown>[] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));

  return c.json({
    items: rows.map((r) => ({ ...r, person: byId.get(r.person_id) ?? null })),
  });
});
