// Slot-generation engine. Pure: given a host's weekly schedule, a meeting
// type's constraints, and a list of busy intervals, returns the bookable
// slot start times within a date range.
//
// Steps:
//   1. Expand the host's working_hours into UTC intervals for each day in
//      the requested range, respecting their timezone (DST safe).
//   2. Slice each working block into `duration` chunks at fixed step.
//   3. Drop slots that violate min_notice / max_advance.
//   4. Drop slots that overlap (or buffer-overlap) any busy interval.
//
// What's NOT here yet (deferred to step 4b — Google Calendar):
//   - Reading the host's GCal freebusy
//   - max_invitees > 1 (group bookings: same slot shared across many bookings)
//   - Round-robin between multiple hosts
//   - Collective availability (intersection of multiple hosts' freebusy)

import { utcToZonedParts, zonedTimeToUtc } from './timezone.js';

export type Range = { start: string; end: string }; // 'HH:MM' wall-clock
export type Schedule = Partial<Record<DayKey, Range[]>>;
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Interval = { start: Date; end: Date };

const WEEKDAY_TO_KEY: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

type Args = {
  /** IANA timezone name, e.g. 'Europe/Amsterdam'. */
  hostTimezone: string;
  /** Host's weekly schedule. */
  workingHours: Schedule;
  /** Meeting type. */
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  /** Step between candidate starts within a working block (minutes). */
  stepMinutes?: number;
  /** Bounds of the search window (inclusive of `from`, exclusive of `to`). */
  from: Date;
  to: Date;
  /** Concrete busy intervals (existing bookings, eventually GCal freebusy). */
  busy: Interval[];
  /** Reference time for the min-notice cutoff. Defaults to `new Date()`. */
  now?: Date;
};

const DEFAULT_STEP_MINUTES = 15;

export function generateSlots(args: Args): Date[] {
  const now = args.now ?? new Date();
  const step = args.stepMinutes ?? DEFAULT_STEP_MINUTES;
  const noticeCutoff = new Date(now.getTime() + args.minNoticeMinutes * 60_000);

  const out: Date[] = [];
  const fromMs = args.from.getTime();
  const toMs = args.to.getTime();

  // Iterate calendar days in the host's local timezone.
  for (let cursor = fromMs; cursor < toMs; cursor += 24 * 60 * 60 * 1000) {
    const parts = utcToZonedParts(cursor, args.hostTimezone);
    const dayKey = WEEKDAY_TO_KEY[parts.weekday];
    if (!dayKey) continue;
    const ranges = args.workingHours[dayKey] ?? [];
    for (const r of ranges) {
      const [sh, sm] = r.start.split(':').map(Number);
      const [eh, em] = r.end.split(':').map(Number);
      if (
        sh === undefined ||
        sm === undefined ||
        eh === undefined ||
        em === undefined
      ) {
        continue;
      }
      const blockStart = zonedTimeToUtc(
        parts.year,
        parts.month,
        parts.day,
        sh,
        sm,
        args.hostTimezone,
      );
      const blockEnd = zonedTimeToUtc(
        parts.year,
        parts.month,
        parts.day,
        eh,
        em,
        args.hostTimezone,
      );

      // Walk candidate starts within this block.
      const stepMs = step * 60_000;
      const durMs = args.durationMinutes * 60_000;
      for (
        let s = blockStart.getTime();
        s + durMs <= blockEnd.getTime();
        s += stepMs
      ) {
        const slotStart = new Date(s);
        const slotEnd = new Date(s + durMs);

        // min-notice
        if (slotStart < noticeCutoff) continue;
        // within search window
        if (slotStart < args.from || slotEnd > args.to) continue;
        // conflict with any busy interval (with buffers)
        if (overlapsBusy(slotStart, slotEnd, args.busy, args.bufferBeforeMinutes, args.bufferAfterMinutes)) {
          continue;
        }

        out.push(slotStart);
      }
    }
  }

  return out;
}

function overlapsBusy(
  slotStart: Date,
  slotEnd: Date,
  busy: Interval[],
  bufferBefore: number,
  bufferAfter: number,
): boolean {
  const startWithBuffer = new Date(slotStart.getTime() - bufferBefore * 60_000);
  const endWithBuffer = new Date(slotEnd.getTime() + bufferAfter * 60_000);
  for (const b of busy) {
    if (b.start < endWithBuffer && b.end > startWithBuffer) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Multi-host slot composition. For round-robin we want the UNION across all
// eligible hosts (a slot is bookable if any host is free); for collective we
// want the INTERSECTION (every host must be free). Each host contributes a
// single-host slot set computed independently with their own working_hours
// and busy intervals.
// ---------------------------------------------------------------------------

export type MultiHostMode = 'round_robin' | 'collective';

export type PerHostArgs = Omit<Args, 'busy'> & {
  /** Stable identifier (e.g. user_id) — used to keep track of which host
   * each slot belongs to in round-robin mode. */
  hostKey: string;
  busy: Interval[];
};

export function generateMultiHostSlots(
  mode: MultiHostMode,
  hosts: PerHostArgs[],
): Date[] {
  if (hosts.length === 0) return [];
  // Compute each host's slot set as ms-since-epoch for set arithmetic.
  const perHostMs: Set<number>[] = hosts.map((h) => {
    const slots = generateSlots(h);
    return new Set(slots.map((s) => s.getTime()));
  });

  let resultMs: Set<number>;
  if (mode === 'round_robin') {
    resultMs = new Set<number>();
    for (const s of perHostMs) for (const t of s) resultMs.add(t);
  } else {
    // collective — intersection
    const first = perHostMs[0];
    if (!first) return [];
    resultMs = new Set(first);
    for (let i = 1; i < perHostMs.length; i++) {
      const next = perHostMs[i];
      if (!next) continue;
      for (const t of resultMs) if (!next.has(t)) resultMs.delete(t);
    }
  }
  return Array.from(resultMs)
    .sort((a, b) => a - b)
    .map((t) => new Date(t));
}

/** For round-robin booking: among the assignees who are free for the given
 *  slot (considering working hours + busy), return the keys sorted by
 *  least-loaded first. Caller supplies the load count per host. */
export function rankAssigneesForSlot(
  slotStart: Date,
  durationMinutes: number,
  hosts: PerHostArgs[],
  loadByKey: Record<string, number>,
): string[] {
  const durMs = durationMinutes * 60_000;
  const slotEnd = new Date(slotStart.getTime() + durMs);
  const free = hosts.filter((h) => {
    // Quick check: the slot must appear in this host's set.
    const set = new Set(generateSlots(h).map((s) => s.getTime()));
    if (!set.has(slotStart.getTime())) return false;
    // Defensive: re-check buffer-overlap against busy.
    return !overlapsBusy(
      slotStart,
      slotEnd,
      h.busy,
      h.bufferBeforeMinutes,
      h.bufferAfterMinutes,
    );
  });
  free.sort((a, b) => (loadByKey[a.hostKey] ?? 0) - (loadByKey[b.hostKey] ?? 0));
  return free.map((h) => h.hostKey);
}
