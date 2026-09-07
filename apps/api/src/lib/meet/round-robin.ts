// Round-robin fairness rules (v0.59.0 — Suite parity item 3).
//
// Meet's rule used to be hardcoded "least loaded". Suite let each team pick,
// and the choice matters: a sales team wants strict rotation, a support team
// wants least-loaded, a two-person team wants least-recently-assigned.
//
// Everything here is PURE — the caller gathers the facts (who is free, who
// carries what load, who was assigned when) and this decides. That keeps the
// rules unit-testable and keeps "derive, don't duplicate" intact: there is no
// last_assigned_at counter to drift, because the answer is read back off the
// bookings themselves.

export const FAIRNESS_RULES = [
  'least_loaded',
  'least_recently_assigned',
  'strict_rotation',
  'random',
] as const;

export type Fairness = (typeof FAIRNESS_RULES)[number];

export function isFairness(v: unknown): v is Fairness {
  return typeof v === 'string' && (FAIRNESS_RULES as readonly string[]).includes(v);
}

export interface PickArgs {
  fairness: Fairness;
  /** Host ids free at the requested slot, in the engine's own order. */
  candidates: string[];
  /** Upcoming confirmed bookings per host id. Missing = 0. */
  loadByHost?: Record<string, number>;
  /** ms-epoch of each host's most recent assignment. Missing = never assigned. */
  lastAssignedAt?: Record<string, number>;
  /** The meeting type's assignee order — the rotation's spine. */
  rotationOrder?: string[];
  /** Host of the most recent confirmed booking on this meeting type. */
  lastBookedHost?: string | null;
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number;
}

export function pickRoundRobinHost(args: PickArgs): string | null {
  const { candidates } = args;
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  switch (args.fairness) {
    case 'random': {
      const rnd = args.random ?? Math.random;
      const i = Math.min(candidates.length - 1, Math.floor(rnd() * candidates.length));
      return candidates[i]!;
    }

    case 'strict_rotation': {
      const order = args.rotationOrder ?? [];
      // Without a canonical order there is nothing to rotate through.
      if (order.length === 0) return leastRecentlyAssigned(args);
      const last = args.lastBookedHost ?? null;
      const startIdx = last && order.includes(last) ? (order.indexOf(last) + 1) % order.length : 0;
      const free = new Set(candidates);
      // Walk forward until we hit someone who is actually free.
      for (let i = 0; i < order.length; i++) {
        const id = order[(startIdx + i) % order.length]!;
        if (free.has(id)) return id;
      }
      return leastRecentlyAssigned(args);
    }

    case 'least_recently_assigned':
      return leastRecentlyAssigned(args);

    case 'least_loaded':
    default: {
      const load = args.loadByHost ?? {};
      let best = candidates[0]!;
      let bestLoad = load[best] ?? 0;
      for (const id of candidates.slice(1)) {
        const l = load[id] ?? 0;
        if (l < bestLoad) {
          best = id;
          bestLoad = l;
        }
      }
      // Tie on load → fall back to who has waited longest, so a team of
      // equals still rotates instead of always picking the first row.
      const tied = candidates.filter((id) => (load[id] ?? 0) === bestLoad);
      if (tied.length > 1) return leastRecentlyAssigned({ ...args, candidates: tied });
      return best;
    }
  }
}

/** Never-assigned first (Infinity ago), then oldest assignment. Ties keep
 *  the caller's order, which is stable across requests. */
function leastRecentlyAssigned(args: PickArgs): string {
  const seen = args.lastAssignedAt ?? {};
  let best = args.candidates[0]!;
  let bestAt = seen[best] ?? -Infinity;
  for (const id of args.candidates.slice(1)) {
    const at = seen[id] ?? -Infinity;
    if (at < bestAt) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}
