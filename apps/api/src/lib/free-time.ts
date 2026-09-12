// How much unbooked working time a stretch of days holds. Step 6b, second half.
//
// connections-overview.md §3: *"Next week holds fourteen hours of preparation
// and nine hours of unbooked time. Nothing in Fibre can say this today, and for
// a facilitator it is the single most useful sentence a tool could produce."*
// The estimates are in lib/effort.ts; this is the other number in that
// sentence.
//
// ── Working hours are a default, named as one ──────────────────────────────
//
// Monday to Friday, nine to five, in the person's own timezone. Google's API
// does not expose the working hours somebody set in Calendar, and asking for
// them would be a settings screen before the sentence has earned one. A
// facilitator who works weekends will see weekends as unavailable; that is
// the first thing to make configurable if the sentence proves useful.
//
// ── What counts as busy ─────────────────────────────────────────────────────
//
// A timed event you have not declined and have not marked "free". All-day
// entries are NOT busy: they are holidays, birthdays and "Athens week"
// banners, and counting them would make most weeks look fully booked. An
// all-day holiday should arguably remove the day — named, not done.
//
// Pure, with no clock and no network, so the arithmetic is tested directly.

export type Interval = { start: number; end: number };

export type Workday = {
  startHour: number;
  endHour: number;
  /** ISO weekdays: Monday 1 … Sunday 7. */
  days: readonly number[];
};

export const DEFAULT_WORKDAY: Workday = { startHour: 9, endHour: 17, days: [1, 2, 3, 4, 5] };

export type CalendarEntry = {
  start: Date;
  end: Date;
  allDay: boolean;
  transparent: boolean;
  declined: boolean;
};

const MINUTE = 60_000;

/** The wall-clock parts of an instant in a timezone. */
function partsIn(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday as string) + 1;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    dow,
  };
}

/** How far a timezone is ahead of UTC at an instant, in ms. */
function offsetAt(ms: number, tz: string): number {
  const p = partsIn(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant a wall-clock time happens in a timezone. Two passes, because
 * the offset at the guess can differ from the offset at the answer on a
 * daylight-saving day.
 */
export function zonedInstant(year: number, month: number, day: number, hour: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour);
  const first = guess - offsetAt(guess, tz);
  return guess - offsetAt(first, tz);
}

/** Working-hour intervals that overlap [from, to), clipped to it. */
export function workingIntervals(
  from: Date,
  to: Date,
  tz: string,
  workday: Workday = DEFAULT_WORKDAY,
): Interval[] {
  const out: Interval[] = [];
  const a = from.getTime();
  const b = to.getTime();
  if (b <= a) return out;
  const start = partsIn(a, tz);
  // Walk calendar dates in the person's zone. Date.UTC normalises day overflow
  // (31 + 1 → the 1st of next month), which is all the date arithmetic needs.
  for (let i = 0; ; i += 1) {
    const d = new Date(Date.UTC(start.year, start.month - 1, start.day + i));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dayStart = zonedInstant(y, m, day, 0, tz);
    if (dayStart >= b) break;
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (!workday.days.includes(dow)) continue;
    const s = Math.max(a, zonedInstant(y, m, day, workday.startHour, tz));
    const e = Math.min(b, zonedInstant(y, m, day, workday.endHour, tz));
    if (e > s) out.push({ start: s, end: e });
  }
  return out;
}

/** Merge overlapping intervals. */
function union(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((x, y) => x.start - y.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/** Whether an entry takes time out of the day. */
export function isBusy(e: CalendarEntry): boolean {
  return !e.allDay && !e.transparent && !e.declined && e.end > e.start;
}

/**
 * Unbooked working minutes in [from, to).
 *
 * Overlapping meetings count once — two invitations for the same hour are one
 * hour gone, not two — which is why busy time is merged before subtracting.
 */
export function freeMinutes(
  from: Date,
  to: Date,
  entries: CalendarEntry[],
  tz: string,
  workday: Workday = DEFAULT_WORKDAY,
): number {
  const busy = union(
    entries.filter(isBusy).map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
  );
  let total = 0;
  for (const w of workingIntervals(from, to, tz, workday)) {
    let free = w.end - w.start;
    for (const x of busy) {
      const s = Math.max(w.start, x.start);
      const e = Math.min(w.end, x.end);
      if (e > s) free -= e - s;
    }
    total += free;
  }
  return Math.round(total / MINUTE);
}

/** A timezone name Intl accepts, or the fallback. A bad value in a profile
 *  must not take Today down. */
export function safeTimeZone(tz: string | null | undefined, fallback = 'Europe/Amsterdam'): string {
  if (!tz) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}
