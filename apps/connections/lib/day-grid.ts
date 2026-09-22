// Where a meeting sits on a day, and how wide it is when two of them clash.
//
// Sjoerd, 2026-09-22, with a screenshot of his calendar: *"Make the agenda
// look like this (time on the left... appointments over the time they take)."*
//
// A list says what is on. A day grid says what the day IS — an hour free
// between two meetings is a fact you can see and cannot read. That is the
// whole reason to draw it, and it is why the geometry has to be right: a
// block half an hour off is worse than no grid at all.
//
// Pure, and in minutes rather than pixels. Nothing here knows about the
// browser; the component multiplies by an hour's height. Minutes are measured
// from local midnight, which is the viewer's midnight — the component reads
// them off a Date, so it is their clock and their zone, not the server's.

export type Block = {
  id: string;
  /** Minutes from local midnight. */
  startMin: number;
  endMin: number;
};

export type Placed = Block & {
  /** Which column this block sits in, 0-based. */
  lane: number;
  /** How many columns its cluster needs. Width is 1/lanes of the track. */
  lanes: number;
};

/** The shortest a block may be drawn, in minutes. A ten-minute meeting still
 *  needs a title on it; below about this it is a line rather than a block. */
export const MIN_BLOCK_MIN = 30;

/** What a block occupies for the purpose of NOT overlapping its neighbours —
 *  its real length, or the minimum height, whichever is longer. Without this a
 *  five-minute meeting drawn 30 minutes tall would cover the one after it
 *  while the maths insisted they did not touch. */
function occupies(b: Block): { start: number; end: number } {
  return { start: b.startMin, end: Math.max(b.endMin, b.startMin + MIN_BLOCK_MIN) };
}

/**
 * Put every block in a column so that no two that overlap share one.
 *
 * Clusters first: a run of blocks connected by overlap, directly or through a
 * third. Every block in a cluster is drawn at the same width, which is what
 * makes a clash read as a clash — two half-width blocks side by side — rather
 * than as two unrelated widths.
 *
 * Greedy within a cluster, left to right: the first column whose last block
 * has ended. That is optimal for interval graphs, which is the one piece of
 * theory this needs.
 */
export function layoutDay(blocks: Block[]): Placed[] {
  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.id.localeCompare(b.id),
  );

  const out: Placed[] = [];
  let cluster: { block: Block; lane: number }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const lanes = Math.max(...cluster.map((c) => c.lane)) + 1;
    for (const c of cluster) out.push({ ...c.block, lane: c.lane, lanes });
    cluster = [];
    clusterEnd = -Infinity;
  };

  // The end of the last block in each column, for the cluster being built.
  let laneEnds: number[] = [];

  for (const b of sorted) {
    const o = occupies(b);
    if (o.start >= clusterEnd) {
      // Nothing in the cluster is still running: this starts a new one.
      flush();
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((end) => end <= o.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(o.end);
    } else {
      laneEnds[lane] = o.end;
    }
    cluster.push({ block: b, lane });
    clusterEnd = Math.max(clusterEnd, o.end);
  }
  flush();

  // Back into the caller's order-independent shape, newest logic aside: the
  // component maps over its own array, so return them by start for stability.
  return out.sort((a, b) => a.startMin - b.startMin || a.lane - b.lane);
}

/**
 * Which hours to draw.
 *
 * A working day at least — an empty grid that starts at 00:00 is mostly
 * nothing — widened to hold whatever is actually on, and to hold NOW, so the
 * line marking it is never off the top or the bottom of the drawing.
 */
export function hourRange(
  blocks: Block[],
  nowMin: number | null,
  floor = 7,
  ceil = 22,
): { from: number; to: number } {
  let from = floor;
  let to = ceil;
  for (const b of blocks) {
    from = Math.min(from, Math.floor(b.startMin / 60));
    to = Math.max(to, Math.ceil(Math.max(b.endMin, b.startMin + MIN_BLOCK_MIN) / 60));
  }
  if (nowMin !== null) {
    from = Math.min(from, Math.floor(nowMin / 60));
    to = Math.max(to, Math.ceil(nowMin / 60));
  }
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
}

/** Minutes from local midnight, on the viewer's own clock. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
