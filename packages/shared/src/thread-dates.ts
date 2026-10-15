// A thread's three dates, decided once (Sjoerd, 2026-10-16).
//
//   · the THREAD PERIOD — program starts_on / ends_on. Internal: when
//     preparation starts, when the thread is over.
//   · the EVENT DATES — public, from the sessions marked "key moment". One key
//     moment is a single event ("12 Jan"); several are a journey
//     ("12 Jan – 15 Jun · 6 sessions").
//   · when SIGN-UPS CLOSE — the start of a chosen session ("open until session
//     N"), else the first key moment's start, else the fallback below.
//
// Every surface that shows or decides on these reads THIS module, so a card,
// a message tag and the enrol route cannot disagree about when a thread is.
//
// Pure: the zone and `now` are arguments, so it behaves the same on a server,
// in a browser and in a test with a pinned clock.

export type ThreadDatesInput = {
  program: { starts_on: string | null; ends_on: string | null };
  /** The thread's sessions marked key moment, timed ones only, any order. */
  keyMoments: readonly { id: string; starts_at: string; ends_at: string | null }[];
  /** The session sign-ups close at ("open until session N"), when chosen and
   *  still timed; null otherwise. */
  closeSession: { starts_at: string } | null;
  /** The thread's first TIMED session (any type with a start), for the
   *  fallback; null when it has none. */
  firstSession: { starts_at: string } | null;
  /** On a team calendar — the membership agenda that calendarVisible and
   *  could-join list (team published, team-calendar entitlement). */
  onTeamCalendar: boolean;
  /** Named directly in a membership's `thread` grant (by id or slug) — e.g.
   *  "Community agenda 2026" on production (MEMBERSHIP_THREADS_KEEP_TODAYS_RULE). */
  inMembershipGrant?: boolean;
  /** The thread's IANA zone. */
  timeZone: string;
};

export type ThreadDates = {
  period: { start: string | null; end: string | null };
  /** Null when no session is a key moment. */
  event: { start: string; end: string; count: number } | null;
  /** ISO instant; null = never closes by date. */
  signupsCloseAt: string | null;
  /** Which rule produced signupsCloseAt, for the editor's explanation. */
  closeRule: 'session' | 'first_key_moment' | 'fallback' | 'none';
};

/**
 * WHEN SIGN-UPS CLOSE FOR A THREAD WITH NO KEY MOMENT AND NO CHOSEN SESSION.
 *
 * Deliberately ONE function, so the rule is a change here and nowhere else.
 * Sjoerd's choice, 2026-10-16 (option A):
 *   · when its first timed session starts —
 *   · EXCEPT a thread on a team calendar (a year agenda such as "Community
 *     agenda 2026" must not close after its first session, against his own
 *     could-join decision): today's rule, open through its last day (ends_on,
 *     else starts_on), to the end of that day in the THREAD's zone;
 *   · off a team calendar with no timed session, or with no dates at all =
 *     never closes by date ("an undated thread stays open, as today").
 */
/** DECIDED (Sjoerd, 2026-10-15: "stay open"): the exception covers ANY
 *  thread a membership gives access to — a team calendar OR a `thread` grant
 *  by id or slug — so a year agenda granted by a tier ("Community agenda
 *  2026") keeps today's rule and never closes after its first session. */
export const MEMBERSHIP_THREADS_KEEP_TODAYS_RULE = true;

export function fallbackSignupsCloseAt(
  input: Pick<ThreadDatesInput, 'program' | 'firstSession' | 'onTeamCalendar' | 'inMembershipGrant' | 'timeZone'>,
): string | null {
  const membershipAgenda = input.onTeamCalendar || (MEMBERSHIP_THREADS_KEEP_TODAYS_RULE && !!input.inMembershipGrant);
  if (!membershipAgenda) {
    if (input.firstSession && !Number.isNaN(Date.parse(input.firstSession.starts_at))) {
      return new Date(input.firstSession.starts_at).toISOString();
    }
    return null;
  }
  const lastDay = input.program.ends_on ?? input.program.starts_on;
  if (!lastDay) return null;
  return startOfDayAfter(lastDay, input.timeZone);
}

export function threadDates(input: ThreadDatesInput): ThreadDates {
  const moments = [...input.keyMoments]
    .filter((m) => !Number.isNaN(Date.parse(m.starts_at)))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const event = moments.length
    ? {
        start: moments[0]!.starts_at,
        end: moments.reduce((latest, m) => {
          const e = m.ends_at ?? m.starts_at;
          return Date.parse(e) > Date.parse(latest) ? e : latest;
        }, moments[0]!.ends_at ?? moments[0]!.starts_at),
        count: moments.length,
      }
    : null;

  let signupsCloseAt: string | null;
  let closeRule: ThreadDates['closeRule'];
  if (input.closeSession && !Number.isNaN(Date.parse(input.closeSession.starts_at))) {
    signupsCloseAt = new Date(input.closeSession.starts_at).toISOString();
    closeRule = 'session';
  } else if (event) {
    signupsCloseAt = new Date(event.start).toISOString();
    closeRule = 'first_key_moment';
  } else {
    signupsCloseAt = fallbackSignupsCloseAt(input);
    closeRule = signupsCloseAt ? 'fallback' : 'none';
  }

  return {
    period: { start: input.program.starts_on, end: input.program.ends_on },
    event,
    signupsCloseAt,
    closeRule,
  };
}

/** Are sign-ups still open by date? (Status and the organiser's own switch
 *  are separate questions, asked by the caller.) Closes AT the moment. */
export function signupsOpenAt(dates: Pick<ThreadDates, 'signupsCloseAt'>, now: Date): boolean {
  return !dates.signupsCloseAt || now.getTime() < Date.parse(dates.signupsCloseAt);
}

// ---------------------------------------------------------------------------
// Words, for the message tags and (later) the cards.
// ---------------------------------------------------------------------------

function fmtDay(isoOrDate: string, timeZone: string, intlLocale: string, withYear = true): string {
  // A bare date (YYYY-MM-DD) is a calendar day, not an instant: format it in
  // UTC so no zone can move it to the day before.
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate);
  const d = new Date(bare ? `${isoOrDate}T00:00:00Z` : isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: bare ? 'UTC' : timeZone,
      day: 'numeric',
      month: 'long',
      ...(withYear ? { year: 'numeric' } : {}),
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }
}

function fmtRange(start: string, end: string | null, timeZone: string, intlLocale: string): string {
  const a = fmtDay(start, timeZone, intlLocale);
  const b = end ? fmtDay(end, timeZone, intlLocale) : '';
  return !b || a === b ? a : `${a} – ${b}`;
}

/** The values of the date tags, by canonical key of the merge-token registry.
 *  `sessions` is a number as text ("6"); every value is '' when unknown. */
export function threadDateTokens(
  dates: ThreadDates,
  timeZone: string,
  intlLocale: string,
): {
  thread_dates: string;
  thread_start: string;
  event_dates: string;
  first_event: string;
  sessions: string;
  signups_close: string;
} {
  const p = dates.period;
  return {
    thread_dates: p.start ? fmtRange(p.start, p.end, timeZone, intlLocale) : '',
    thread_start: p.start ? fmtDay(p.start, timeZone, intlLocale) : '',
    event_dates: dates.event ? fmtRange(dates.event.start, dates.event.end, timeZone, intlLocale) : '',
    first_event: dates.event ? fmtDay(dates.event.start, timeZone, intlLocale) : '',
    sessions: dates.event ? String(dates.event.count) : '',
    signups_close: dates.signupsCloseAt ? fmtDay(dates.signupsCloseAt, timeZone, intlLocale) : '',
  };
}

// ---------------------------------------------------------------------------
// Zone arithmetic, without a library.
// ---------------------------------------------------------------------------

/** How far `timeZone` is ahead of UTC at `instant`, in ms. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - instant;
}

/** The instant local midnight begins on the day AFTER `day` (YYYY-MM-DD) in
 *  `timeZone`. An unknown zone is treated as UTC. */
export function startOfDayAfter(day: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1);
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  // Two passes settle a DST change between the guess and the answer.
  let t = wall - zoneOffsetMs(wall, tz);
  t = wall - zoneOffsetMs(t, tz);
  return new Date(t).toISOString();
}
