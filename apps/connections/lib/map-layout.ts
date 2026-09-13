// Where each person sits on the desktop map.
//
// docs/connections-desktop.md §2 and §5c. Sjoerd, 2026-09-11: *"I see a web of
// people.. connected. People who are active bigger.. people who I have not
// contacted or seen... far removed.."* — and later, *"think of a cloud"*.
//
// ── Computed, never simulated (D38) ─────────────────────────────────────────
//
// A force simulation rearranges the whole picture when one person is added, so
// you can never learn where anybody lives — and spatial memory is the entire
// reason to draw people in space. So this is a pure function: the same person
// on the same day lands in the same place, every time, on every machine.
//
//   ANGLE   is identity. Derived from the person's id, so it never changes.
//   RADIUS  is time since last contact. Near the centre: spoken to recently.
//           Far out: gone quiet. People drift outward as they are neglected
//           and snap inward the moment you speak — a true animation, and the
//           reason nothing on screen has to explain what "far" means.
//
// ── A cloud, not a dartboard (§5c) ──────────────────────────────────────────
//
// No rings, no sectors, no grid on screen. Radius is a GRADIENT rather than
// steps, and each person gets a small fixed jitter so people contacted on the
// same day do not sit on a visible circle. The geometry is felt, not seen.
//
// ── The far field is haze (D46) ─────────────────────────────────────────────
//
// Beyond a year without contact, people stop being dots. A vast network would
// otherwise draw hundreds of grey dots at the rim that mean nothing and cost
// everything to render. They become a count in the mist instead, which is the
// honest summary of them, and a click opens a list.
//
// ── Not yet here, and why ───────────────────────────────────────────────────
//
// Clusters. §5c resolves stability against clumping with a NIGHTLY snapshot
// that assigns each person a region. Until that exists, angle is a plain hash
// and people who belong together are not placed together. That is a real gap
// and it is named rather than faked: a fake cluster would be worse than none.

export type MapPerson = {
  id: string;
  name: string;
  /** The maturity rung, used for colour only (D39: one colour axis). */
  rung: string | null;
  /** Most recent contact of any kind, or null for never. */
  lastContactAt: string | null;
  /** In the attention list — drawn larger (D39: size is attention). */
  attention: boolean;
};

export type Dot = MapPerson & {
  /** Position in a unit square, centre (0.5, 0.5). The renderer scales it. */
  x: number;
  y: number;
  /** Radius of the dot itself, in the same unit space. */
  size: number;
  days: number | null;
};

export type MapLayout = { dots: Dot[]; far: MapPerson[] };

/** A year. Past it, a person is haze rather than a dot. */
export const FAR_DAYS = 365;

const DAY = 86_400_000;

/**
 * A stable number in [0, 1) from a string. Not cryptographic, and does not
 * need to be — but it DOES need to spread evenly, and the first version did
 * not.
 *
 * That version was plain FNV-1a, divided by 2^32. Dividing reads the HIGH
 * bits, and FNV-1a mixes its high bits poorly on short, similar inputs: a
 * test sending 200 ids into four quadrants got 10 in one of them where about
 * 50 belong. On the map that is a clump of people who have nothing in common,
 * drawn exactly like a real cluster — which the header of this file calls
 * worse than none. The fix is a finalising avalanche (MurmurHash3's fmix32)
 * after FNV, which scrambles every bit into the high ones.
 */
export function unitHash(s: string, salt = 0): number {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/**
 * Recency to distance from the centre, as a fraction of the map's radius.
 *
 * Square-root rather than linear, so the first weeks get the most room: the
 * difference between yesterday and last week matters far more to somebody
 * deciding who to call than the difference between month seven and month
 * eight. Clamped away from 0 so the most recent person is not hidden under
 * the centre, and away from 1 so nobody sits on the edge of the canvas.
 */
export function radiusFor(days: number): number {
  const t = Math.min(Math.max(days, 0), FAR_DAYS) / FAR_DAYS;
  return 0.1 + Math.sqrt(t) * 0.78;
}

export function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY));
}

export function layout(people: readonly MapPerson[], now: number): MapLayout {
  const dots: Dot[] = [];
  const far: MapPerson[] = [];

  for (const p of people) {
    const days = daysSince(p.lastContactAt, now);
    // Never contacted, or not in a year: haze.
    if (days === null || days > FAR_DAYS) {
      far.push(p);
      continue;
    }

    const angle = unitHash(p.id) * Math.PI * 2;
    // A fixed jitter of up to ±4% of the radius, from a DIFFERENT hash of the
    // same id, so it is stable and uncorrelated with the bearing.
    const jitter = (unitHash(p.id, 7) - 0.5) * 0.08;
    const r = Math.min(Math.max(radiusFor(days) + jitter, 0.06), 0.92) / 2;

    dots.push({
      ...p,
      days,
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
      // Attention is the one thing that should jump out from across the room.
      size: p.attention ? 0.018 : 0.011,
    });
  }

  // Larger dots drawn LAST, so a person needing attention is never hidden
  // under somebody who does not.
  dots.sort((a, b) => a.size - b.size);
  return { dots, far };
}

/**
 * Thinning (D47): every ticked reason kind is a REQUIREMENT, so more ticks
 * leave fewer, stronger links. The reverse of an ordinary filter, which widens
 * with each box ticked — and the obvious implementation, which is why this is
 * a named function with a test rather than a line inside the component.
 * Nothing ticked keeps everything.
 */
export function thin<K extends string, N extends { reasons: { kind: K }[] }>(
  neighbours: N[],
  required: ReadonlySet<K>,
): N[] {
  return neighbours.filter((n) => {
    const kinds = new Set(n.reasons.map((r) => r.kind));
    for (const k of required) if (!kinds.has(k)) return false;
    return true;
  });
}

/**
 * Who the cloud opens on when nobody has chosen: the person you were in touch
 * with most recently, because that is where you actually are in the community.
 *
 * People with no contact date at all are a last resort — landing on somebody
 * you have never spoken to would open the map on its emptiest corner. Ties
 * break by name so the same workspace opens the same way twice.
 */
export function defaultStartPerson<T extends { name: string; lastContactAt: string | null }>(
  people: T[],
): T | undefined {
  const spokenTo = people.filter((p) => p.lastContactAt);
  const pool = spokenTo.length ? spokenTo : people;
  return [...pool].sort((a, b) => {
    const byDate = (b.lastContactAt ?? '').localeCompare(a.lastContactAt ?? '');
    return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
  })[0];
}
