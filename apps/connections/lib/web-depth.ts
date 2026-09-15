// Depth for the moving web: what is near, what is far, and what the pointer
// brings forward.
//
// Sjoerd, 2026-09-14, after showing the map to somebody who was deeply
// interested: *"the 3D effect can also be more strong. Smaller and bigger.
// Bringing pieces to the foreground"*, and *"nodes are full (means: have
// content) or empty (they are unclear or there for overview purposes)"*.
//
// The picture is still flat SVG; depth is a number per node, 0 (far) to 1
// (near), and everything that SELLS depth is read from it:
//
//   size       near names are larger, far ones smaller
//   light      far names are fainter
//   focus      far names are slightly soft (a small blur)
//   parallax   as the pointer moves, near things move more than far things,
//              in opposite directions either side of the middle distance
//   order      near things are painted over far things
//
// What decides a node's depth is what it MEANS, so the effect carries
// information rather than decoration: the middle is nearest, a strong
// connection nearer than a weak one, a name with something written on it
// nearer than an empty one, and whatever you point at comes forward with
// everything it is connected to — the rest steps back.
//
// Pure: no clock, no DOM. The component eases each node's depth toward
// `targetDepth` a little every frame, so coming forward is a movement.

export type DepthInput = {
  centre: boolean;
  junction?: boolean;
  /** 0..1, how strong the connection to the middle is. */
  strength: number;
  /** Has content: a note, or how you know them. Empty names sit further back. */
  full?: boolean;
  /** The faded "way back" name. */
  trail?: boolean;
};

/** How a node relates to what the pointer is on: itself, connected to it, neither, or nothing is hovered. */
export type Focus = 'self' | 'related' | 'other' | null;

export const DEPTH_NEAR = 1;
export const DEPTH_FAR = 0;

/**
 * Where a node wants to be, 0 (far) to 1 (near).
 *
 * Hover wins: the thing you point at and what it connects to come forward,
 * everything else steps back — "bringing pieces to the foreground".
 */
export function targetDepth(n: DepthInput, focus: Focus): number {
  if (focus === 'self') return 1;
  if (focus === 'related') return n.centre ? 1 : 0.9;
  if (n.centre) return focus === 'other' ? 0.75 : 1;
  let d: number;
  if (n.trail) d = 0.2;
  else if (n.junction) d = 0.55;
  else d = 0.3 + 0.6 * clamp01(n.strength) + (n.full ? 0.1 : -0.1);
  d = clamp01(d);
  // Something else is being looked at: step back, but stay legible.
  return focus === 'other' ? d * 0.45 : d;
}

/** Ease a depth toward its target. `rate` is the fraction closed per frame. */
export function easeDepth(current: number | undefined, target: number, rate = 0.14): number {
  if (current === undefined) return target;
  const next = current + (target - current) * rate;
  return Math.abs(target - next) < 0.002 ? target : next;
}

/** The look a depth gives. The middle keeps its own size (scale 1 at depth 1 for a centre). */
export function depthStyle(depth: number, centre = false): { scale: number; opacity: number; blur: number } {
  const z = clamp01(depth);
  return {
    // 0.62x far to 1.22x near; the middle is drawn at its own large size already.
    scale: centre ? 0.9 + 0.1 * z : 0.62 + 0.6 * z,
    opacity: 0.38 + 0.62 * z,
    // Only the far third goes soft, and never much: a blurred NAME is unreadable.
    blur: z < 0.34 ? Math.round((0.34 - z) * 3.2 * 100) / 100 : 0,
  };
}

/**
 * How far a node shifts with the pointer. Near things move with the pointer,
 * far things against it, the middle distance stays put — which is what reads
 * as depth when the picture moves.
 */
export function parallax(depth: number, pointer: { x: number; y: number } | null, strength = 0.07): { dx: number; dy: number } {
  if (!pointer) return { dx: 0, dy: 0 };
  const k = (clamp01(depth) - 0.5) * strength;
  return { dx: pointer.x * k, dy: pointer.y * k };
}

/** Paint far things first so near things cover them. Stable for equal depths. */
export function byDepth<T extends { id: string }>(nodes: readonly T[], depthOf: (n: T) => number): T[] {
  return nodes
    .map((n, i) => ({ n, i, d: depthOf(n) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.n);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
