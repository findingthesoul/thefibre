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
//   two labels      pushed apart when their names would overlap
//   everything      damped, so it settles instead of orbiting
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
export function labelWidth(name: string, centre: boolean): number {
  return Math.min(220, name.length * (centre ? 11 : 7.5) + 16);
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
const DAMPING = 0.78;
const ROW_HEIGHT = 34;

/** Advance one frame. Mutates and returns the nodes' total kinetic energy. */
export function step(nodes: WebNode[]): number {
  for (const n of nodes) {
    if (n.centre) {
      n.vx += -n.x * CENTRING;
      n.vy += -n.y * CENTRING;
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
    const pull = (n.targetR - d) * RADIAL;
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
export function settle(nodes: WebNode[], maxSteps = 600): number {
  let e = Infinity;
  for (let i = 0; i < maxSteps && e > 0.01; i += 1) e = step(nodes);
  return e;
}
