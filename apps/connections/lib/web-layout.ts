// The moving web: one person in the middle, their strongest connections
// floating around them.
//
// Sjoerd, 2026-09-13: *"Is the map not moving? Like the thesaurus... a moving
// web of connection. You click on a name (not a dot) and then you see the
// connections.. you click on the next... and that one is centered (and
// bigger) and you see the most valuable connection of that person... you can
// always go Back."*
//
// ── Why this moves when the overview does not ──────────────────────────────
//
// lib/map-layout.ts refuses a simulation (D38): in the overview, where
// everybody lives must never change, or spatial memory is worthless. This is
// the other view. It shows ONE neighbourhood at a time, and the movement IS
// the information — the person you clicked travelling to the centre is how you
// see that the whole picture is now about them. Stability here would mean a
// jump cut, which loses where you came from.
//
// ── The forces, all of them ────────────────────────────────────────────────
//
// ── Wide, because a screen is wide (Sjoerd, 2026-09-13) ────────────────────
//
// *"Make it more wide... spread out... Make it wide over the screen."* The
// cloud is an ELLIPSE, not a circle: the ring a name is pulled to is stretched
// horizontally by ASPECT, so the names use the width a monitor actually has
// instead of leaving two empty columns either side of a disc.
//
// ── Never fixed (same message) ─────────────────────────────────────────────
//
// *"by dragging, you could see people coming in... and moving out.. it is
// always a bit moving... not fixed.... so you can move it around, and make
// things visible that are a bit hidden."*
//
// Two things do that. A dragged name is `held`: it follows the pointer and
// every other name reacts, which is how you shake something out from behind a
// neighbour. And the cloud never fully freezes — a slow WANDER keeps it
// breathing, so it reads as alive rather than as a diagram.
//
// ── The middle leans toward your mouse (Sjoerd, 2026-09-13) ────────────────
//
// *"make the main name, follow the mouse in a delay"*. The name in the middle
// drifts after the pointer, softly and always behind it. It LEANS rather than
// follows: the pull is a fraction of the distance and capped, because the
// middle of a cloud that chases your cursor to the edge of the frame stops
// being the middle of anything, and the lines to every other name would
// stretch across the screen.
//
//   the centre      pulled toward where you are pointing, softly and capped
//
// ── And the rest follows, each on its own (Sjoerd, 2026-09-13) ─────────────
//
// *"when the center follows, the rest moves — again with a delay — ... some
// lines become longer, others shorter"*, and then: *"the following should be
// all independent connections... not as a block... so the connecting strings
// stretch and contract independent"*.
//
// So the ring is not pinned to the middle of the frame, and there is no single
// anchor either. EVERY NAME CARRIES ITS OWN, which trails the centre at its
// own rate. The centre leans after your mouse; each name comes after the
// centre at its own pace, some quick, some slow. The strings therefore stretch
// and contract independently rather than the cloud sliding as one piece — the
// first version used one shared anchor and moved exactly like a block.
//
// The rate is derived from the name's id, so it is that person's own lag: the
// same every time you visit them, never a random shimmer.
//   a neighbour     pulled to a ring whose radius is its weight: the most
//                   valuable connection sits closest
//   two linked      pulled together, so people who share something sit near
//   neighbours      each other and the web shows the community's own shape
//                   rather than a star
//   every name      steered toward its own direction around the ring
//
// ── Directions are assigned, not hoped for ─────────────────────────────────
//
// The forces alone do not spread the names. Link springs pull clusters
// together and the whole cloud slides onto one side of the centre, leaving the
// other half empty — seen twice in the browser, at two different sizes. So
// each name is given a slot around the ring and steered toward it
// (`assignBearings`), and the springs only refine what the slots decide.
// Emergent spreading looked elegant and did not work.
//
// A weak all-pairs push was tried first, against the same problem, and it is
// gone: measured with the slots in place it changed the widest empty wedge by
// at most one degree. Slots did the job; the push was a constant with a
// justification that had stopped being true.
//   two labels      pushed apart when their names would overlap
//   everything      damped, so it settles instead of orbiting
//
// ── The glide (Sjoerd, 2026-09-13) ──────────────────────────────────────────
//
// *"If you click on a related word: that word moves towards the center... the
// word you came from moves to the side (left, right, bottom, up... opposite
// to where the second word first was)."*
//
// That is one movement, not two: the whole cloud slides so the clicked name
// arrives at the middle. Everything else comes along, which puts the old
// centre exactly opposite the direction the clicked name came from, for free.
// `pan` carries the translation and how far through it we are. Moving the
// nodes individually would have them cross each other and lose the sense of
// travelling somewhere.
//
// The glide EASES IN AND OUT (Sjoerd, 2026-09-13: "make the movements a bit
// more ease in and out"). Spending a fixed FRACTION of what remains each frame
// — the obvious way — starts at full speed and crawls at the end, which reads
// as a lurch followed by a drift. A cubic ease over a fixed number of frames
// starts gently, travels fastest in the middle, and arrives gently.
//
// While it travels, the springs are turned down. Otherwise the cloud is being
// slid and rearranged at the same time: the old centre gets pulled off its
// bearing mid-flight and no longer lands opposite the name you clicked, which
// is the one thing the movement is supposed to show. So the glide is mostly a
// TRAVEL, and the settling happens when it arrives.
//
// Pure: no clock, no DOM. The component calls `step` once per frame until
// `energy` is small.

import { unitHash } from './map-layout';

export type WebNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The ring this node is drawn to. 0 for the centre. */
  targetR: number;
  /** Approximate label width, so names do not sit on top of each other. */
  width: number;
  centre: boolean;
  /**
   * Held by the pointer. It follows the finger exactly and feels no forces,
   * while everything else keeps reacting to it — that is what makes dragging
   * reveal a name hidden behind another.
   */
  held?: boolean;
  /**
   * Where THIS name's ring hangs from: its own anchor, trailing the centre at
   * its own rate. Set on the first frame it is seen.
   */
  hubX?: number;
  hubY?: number;
  /**
   * A direction this name would rather sit in, in radians, measured in the
   * squashed space the ellipse is round in.
   *
   * Used for ONE thing: the name you came from. The glide leaves it exactly
   * opposite the name you clicked, and then the settling — crowding, a wider
   * cloud, stiffer horizontal springs — rotates it away, far enough in the
   * worst case to land back on the side you clicked from. Since "it went to
   * the opposite side" is the whole point of the movement, it is held there
   * on purpose rather than left to emerge.
   */
  bearing?: number;
};

export const R_MIN = 250;
export const R_MAX = 365;

/** Closer for a stronger connection. `weight` is relative to the strongest. */
export function targetRadius(weight: number, maxWeight: number): number {
  const w = maxWeight > 0 ? Math.max(0, Math.min(1, weight / maxWeight)) : 0;
  return R_MIN + (1 - w) * (R_MAX - R_MIN);
}

/** A label's rough width in the SVG's units. Not measured: measuring text
 *  needs the DOM, and a layout that waits for fonts jitters on first paint. */
export function labelWidth(name: string, centre: boolean, strength = 0.5): number {
  const per = centre ? 11 : fontSize(strength, false) * 0.53;
  return Math.min(220, name.length * per + 16);
}

/**
 * Where a node that was not on screen appears: next to `from` (the person who
 * brought it in), on a bearing derived from its id, so the same web builds
 * the same way twice.
 */
export function seedPosition(id: string, from: { x: number; y: number }): { x: number; y: number } {
  const angle = unitHash(id, 3) * Math.PI * 2;
  return { x: from.x + Math.cos(angle) * 40, y: from.y + Math.sin(angle) * 40 };
}

/** How much wider than tall the cloud sits. A 16:9 screen wants about this. */
export const ASPECT = 1.75;
/** The slow breathing that keeps it from looking frozen. */
const WANDER = 0.035;
const WANDER_SPEED = 0.0007;

/** How firmly a name with a preferred direction is kept in it. */
const BEARING_PULL = 0.08;
/** The slowest and quickest a name follows the centre. Its own rate sits
 *  somewhere between, from its id. */
const LAG_SLOWEST = 0.012;
const LAG_QUICKEST = 0.075;

/** How fast this particular name trails the centre. Stable per person. */
export function lagOf(id: string): number {
  return LAG_SLOWEST + unitHash(id, 17) * (LAG_QUICKEST - LAG_SLOWEST);
}

/** How far the middle will lean from home, and how lazily it gets there. */
export const LEAN_MAX = 55;
const LEAN_FRACTION = 0.16;
const LEAN_PULL = 0.022;

const RADIAL = 0.06;
const CENTRING = 0.12;
const REPEL = 0.5;
const DAMPING = 0.82;
const ROW_HEIGHT = 34;
/** How long the glide takes, in frames. About 0.5s at 60fps. */
export const GLIDE_FRAMES = 30;
/** How much of the spring forces still act while the cloud is travelling. */
const GLIDE_SPRING = 0.15;
/** A link's pull, and how close it wants its two ends. */
const LINK_PULL = 0.012;
const LINK_REST = 150;

/** A tie between two people already on screen. */
export type WebLink = { a: string; b: string; weight: number };

/**
 * A glide in progress: the whole translation, how many frames in we are, and
 * how much of it has been spent so far.
 */
export type Pan = { dx: number; dy: number; t: number; done: number };

/** Start a glide that brings `from` to the middle. */
export function panTo(from: { x: number; y: number }): Pan {
  return { dx: -from.x, dy: -from.y, t: 0, done: 0 };
}

/** Cubic ease in and out: gentle at both ends, quickest in the middle. */
export function easeInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Is this glide still travelling? */
export function panning(pan?: Pan): boolean {
  return !!pan && pan.t < GLIDE_FRAMES;
}

/**
 * Advance one frame. Mutates and returns the nodes' total kinetic energy.
 *
 * `pan` is consumed as it is spent, so the caller can hand the same object
 * back each frame and stop when it is empty.
 */
export function step(
  nodes: WebNode[],
  links: WebLink[] = [],
  pan?: Pan,
  /** Where the pointer is, in the same units as the nodes. */
  pointer?: { x: number; y: number } | null,
): number {
  const lean = leanToward(pointer);
  // Springs are quiet while the cloud is travelling. See the header.
  const springs = panning(pan) ? GLIDE_SPRING : 1;
  // The glide first, so a node's forces this frame are computed where it has
  // actually arrived rather than where it was a frame ago.
  if (panning(pan) && pan) {
    pan.t += 1;
    const progress = easeInOut(pan.t / GLIDE_FRAMES);
    const spend = progress - pan.done;
    const dx = pan.dx * spend;
    const dy = pan.dy * spend;
    for (const n of nodes) {
      n.x += dx;
      n.y += dy;
    }
    // The anchors travel with the cloud; otherwise every ring stays behind for
    // the whole glide and drags its name across the frame afterwards.
    for (const n of nodes) {
      if (n.hubX !== undefined) n.hubX += dx;
      if (n.hubY !== undefined) n.hubY += dy;
    }
    pan.done = progress;
  }

  const middle = nodes.find((n) => n.centre);

  for (const n of nodes) {
    // A held name is wherever the pointer put it. Everything else still feels
    // it, through the repulsion and links below.
    if (n.held) {
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    if (n.centre) {
      // Home is (0, 0), or a little way toward the pointer. The soft pull is
      // what makes it arrive late, which is the whole effect.
      const k = lean ? LEAN_PULL : CENTRING;
      n.vx += ((lean?.x ?? 0) - n.x) * k * springs;
      n.vy += ((lean?.y ?? 0) - n.y) * k * springs;
      continue;
    }
    // Its own anchor comes after the centre, at its own rate. This is what
    // makes each string stretch and contract independently.
    if (n.hubX === undefined || n.hubY === undefined) {
      n.hubX = middle?.x ?? 0;
      n.hubY = middle?.y ?? 0;
    }
    if (middle) {
      const lag = lagOf(n.id);
      n.hubX += (middle.x - n.hubX) * lag;
      n.hubY += (middle.y - n.hubY) * lag;
    }
    const hx = n.hubX;
    const hy = n.hubY;

    // Measured from its anchor, in a space squashed horizontally, so the ring
    // it is pulled to is an ellipse: wide like the screen.
    const ex = (n.x - hx) / ASPECT;
    const ey = n.y - hy;
    let d = Math.hypot(ex, ey);
    if (d < 0.001) {
      // Exactly on the hub has no direction to be pushed in; give it one from
      // its id rather than from Math.random, so runs repeat.
      const a = unitHash(n.id, 5) * Math.PI * 2;
      n.x = hx + Math.cos(a) * ASPECT;
      n.y = hy + Math.sin(a);
      d = 1;
    }
    const pull = (n.targetR - d) * RADIAL * springs;
    n.vx += (ex / d) * pull * ASPECT;
    n.vy += (ey / d) * pull;

    // Keep a preferred direction, if it has one. Acts sideways only, so it
    // steers without arguing with the ring above about distance.
    if (n.bearing !== undefined) {
      const want = { x: Math.cos(n.bearing), y: Math.sin(n.bearing) };
      const off = { x: want.x * d - ex, y: want.y * d - ey };
      n.vx += off.x * BEARING_PULL * springs * ASPECT;
      n.vy += off.y * BEARING_PULL * springs;
    }
  }

  // Labels are wide and short, so overlap is tested as boxes, not circles.
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const overlapX = (a.width + b.width) / 2 - Math.abs(dx);
      const overlapY = ROW_HEIGHT - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;
      // Push along the axis that needs less movement to separate them.
      const alongX = overlapX < overlapY;
      const amount = (alongX ? overlapX : overlapY) * REPEL * 0.5;
      const sign = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
      // The centre does not get pushed around by its own neighbours, and a
      // held name does not get pushed off the pointer.
      let shareA = a.centre || a.held ? 0 : b.centre || b.held ? 1 : 0.5;
      let shareB = 1 - shareA;
      if (a.held) shareA = 0;
      if (b.held) shareB = 0;
      if (alongX) {
        a.vx -= sign * amount * shareA * 2;
        b.vx += sign * amount * shareB * 2;
      } else {
        a.vy -= sign * amount * shareA * 2;
        b.vy += sign * amount * shareB * 2;
      }
    }
  }

  // Links: two people who share something are drawn together, gently. Weaker
  // than the ring, so a strong connection never gets dragged out past a weak
  // one — the distance from the middle must keep meaning what it says.
  if (links.length) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const l of links) {
      const a = byId.get(l.a);
      const b = byId.get(l.b);
      if (!a || !b || a.centre || b.centre) continue;
      if (a.held && b.held) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - LINK_REST) * LINK_PULL * Math.min(1, l.weight) * springs;
      if (!a.held) {
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
      }
      if (!b.held) {
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    }
  }

  let energy = 0;
  for (const n of nodes) {
    if (n.held) continue; // the pointer owns this one
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    energy += n.vx * n.vx + n.vy * n.vy;
  }
  return energy;
}

/**
 * The breathing. A slow, tiny drift per name so the cloud is never a frozen
 * diagram — Sjoerd: *"it is always a bit moving... not fixed"*.
 *
 * Kept OUT of `step` on purpose: `step` must be able to come to rest, or
 * `settle` would never return and the tests could not measure anything. The
 * component calls this each frame instead, and skips it when the viewer asked
 * for reduced motion.
 *
 * Deterministic in `t`, so it is a drift and not a jitter: each name traces its
 * own slow circle, sized well under a letter's width.
 */
export function wander(nodes: WebNode[], t: number): void {
  for (const n of nodes) {
    if (n.held || n.centre) continue;
    const phase = unitHash(n.id, 11) * Math.PI * 2;
    const speed = 0.6 + unitHash(n.id, 13) * 0.8;
    n.x += Math.cos(t * WANDER_SPEED * speed + phase) * WANDER * ASPECT;
    n.y += Math.sin(t * WANDER_SPEED * speed * 1.3 + phase) * WANDER;
  }
}

/** Run until still, or `maxSteps`. For tests and for reduced motion. */
export function settle(
  nodes: WebNode[],
  maxSteps = 600,
  links: WebLink[] = [],
  pan?: Pan,
  pointer?: { x: number; y: number } | null,
): number {
  let e = Infinity;
  for (let i = 0; i < maxSteps && e > 0.01; i += 1) e = step(nodes, links, pan, pointer);
  return e;
}

/**
 * Font size for a name, from how strong its connection is. The centre is
 * always the largest; the rest range between these two so the cloud reads at
 * a glance (Sjoerd: "Some words are bigger and some are smaller, suggesting
 * stronger connections").
 */
export const CENTRE_FONT = 21;
const MIN_FONT = 11.5;
const MAX_FONT = 17;

export function fontSize(strength: number, centre: boolean): number {
  if (centre) return CENTRE_FONT;
  const s = Math.max(0, Math.min(1, strength));
  return Math.round((MIN_FONT + s * (MAX_FONT - MIN_FONT)) * 10) / 10;
}

/**
 * Give every name its own direction around the ring, evenly spaced.
 *
 * `anchor`, when given, is a direction that one node MUST keep — the name you
 * came from, which belongs exactly opposite the name you clicked. It takes the
 * first slot and everything else is spaced around from there.
 *
 * Order is by strength, so the arrangement is stable: the same neighbourhood
 * lays out the same way twice, and turning the density slider moves the names
 * that were added or removed rather than reshuffling the lot.
 */
export function assignBearings(
  nodes: WebNode[],
  anchor?: { id: string; bearing: number },
): void {
  const around = nodes.filter((n) => !n.centre);
  if (!around.length) return;
  const anchored = anchor ? around.find((n) => n.id === anchor.id) : undefined;
  const rest = around.filter((n) => n !== anchored);
  // Strongest first. targetR is smaller for stronger, so ascending targetR.
  rest.sort((a, b) => a.targetR - b.targetR || a.id.localeCompare(b.id));
  const ordered = anchored ? [anchored, ...rest] : rest;
  // With no anchor, start at the top so a small cloud looks deliberate.
  const base = anchor ? anchor.bearing : -Math.PI / 2;
  const step = (Math.PI * 2) / ordered.length;
  ordered.forEach((n, i) => {
    n.bearing = base + step * i;
  });
}

/**
 * Where the middle should lean, given the pointer: a fraction of the way
 * toward it, and never further than LEAN_MAX from home.
 *
 * Exported so the rule can be read and tested on its own. Null pointer — the
 * mouse has left, or never arrived — means home.
 */
export function leanToward(pointer?: { x: number; y: number } | null): { x: number; y: number } | null {
  if (!pointer) return null;
  const x = pointer.x * LEAN_FRACTION;
  const y = pointer.y * LEAN_FRACTION;
  const d = Math.hypot(x, y);
  if (d <= LEAN_MAX) return { x, y };
  return { x: (x / d) * LEAN_MAX, y: (y / d) * LEAN_MAX };
}
