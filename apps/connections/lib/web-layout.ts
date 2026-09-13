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
//   the centre      pulled to (0, 0)
//   a neighbour     pulled to a ring whose radius is its weight: the most
//                   valuable connection sits closest
//   two linked      pulled together, so people who share something sit near
//   neighbours      each other and the web shows the community's own shape
//                   rather than a star
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
};

export const R_MIN = 130;
export const R_MAX = 270;

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
export function step(nodes: WebNode[], links: WebLink[] = [], pan?: Pan): number {
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
    pan.done = progress;
  }

  for (const n of nodes) {
    if (n.centre) {
      n.vx += -n.x * CENTRING * springs;
      n.vy += -n.y * CENTRING * springs;
      continue;
    }
    let d = Math.hypot(n.x, n.y);
    if (d < 0.001) {
      // Exactly on the centre has no direction to be pushed in; give it one
      // from its id rather than from Math.random, so runs repeat.
      const a = unitHash(n.id, 5) * Math.PI * 2;
      n.x = Math.cos(a);
      n.y = Math.sin(a);
      d = 1;
    }
    const pull = (n.targetR - d) * RADIAL * springs;
    n.vx += (n.x / d) * pull;
    n.vy += (n.y / d) * pull;
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
      // The centre does not get pushed around by its own neighbours.
      const shareA = a.centre ? 0 : b.centre ? 1 : 0.5;
      const shareB = 1 - shareA;
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
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - LINK_REST) * LINK_PULL * Math.min(1, l.weight) * springs;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
  }

  let energy = 0;
  for (const n of nodes) {
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    energy += n.vx * n.vx + n.vy * n.vy;
  }
  return energy;
}

/** Run until still, or `maxSteps`. For tests and for reduced motion. */
export function settle(nodes: WebNode[], maxSteps = 600, links: WebLink[] = [], pan?: Pan): number {
  let e = Infinity;
  for (let i = 0; i < maxSteps && e > 0.01; i += 1) e = step(nodes, links, pan);
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
