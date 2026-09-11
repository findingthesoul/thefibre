// When a thread is, in its own timezone.
//
// Extracted 2026-09-11 from the workspace check-in door, which was the first
// surface that had to answer "is this happening today" and is no longer the
// only one — the dashboard asks the same question, and asking it twice in two
// files is how the two answers drift.
//
// Everything here compares DATES, never instants. An event that starts at
// 09:00 in Amsterdam is today all day, wherever the phone holding the app
// happens to be, and a date-only comparison in the thread's own timezone is
// the only framing that says so.

import { one, type ThreadRow } from '@/lib/thread-types';

/** Today, as a 'YYYY-MM-DD' date in the given timezone. */
export function todayIn(timezone: string | null | undefined): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: timezone || 'Europe/Amsterdam',
  });
}

/** Is this thread running today? Draft and finished threads never are. */
export function happeningToday(thread: ThreadRow): boolean {
  const program = one(thread.program);
  if (!program || program.status !== 'active') return false;
  const starts = program.starts_on;
  if (!starts) return false;
  const today = todayIn(thread.timezone);
  const ends = program.ends_on ?? starts;
  return starts <= today && today <= ends;
}

/** Is this thread still ahead of us? Undated threads are not "coming up" —
 *  they are unscheduled, which is a different thing and belongs elsewhere. */
export function startsLater(thread: ThreadRow): boolean {
  const program = one(thread.program);
  if (!program || program.status === 'archived' || program.status === 'completed') return false;
  const starts = program.starts_on;
  return !!starts && starts > todayIn(thread.timezone);
}

/** Whole days between today and a 'YYYY-MM-DD' date, in that timezone.
 *  Both ends are read as midnight UTC so daylight saving cannot round the
 *  answer to 0.99 of a day and floor it to yesterday. */
export function daysUntil(date: string, timezone: string | null | undefined): number {
  const from = Date.parse(`${todayIn(timezone)}T00:00:00Z`);
  const to = Date.parse(`${date}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}
