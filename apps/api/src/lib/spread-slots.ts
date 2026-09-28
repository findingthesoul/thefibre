// Choosing which free times to OFFER, out of all the free times there are.
//
// A meeting poll asks people to compare options, so the options have to be
// genuinely different. Taking the first N free slots offers three times on one
// Tuesday morning — technically three choices, actually one. Lives in its own
// module because it is pure and worth testing: no database, no clock, no
// Google, just a list of instants and a time zone.

/**
 * Pick `count` starts spread across DIFFERENT DAYS, as far as the free slots
 * allow.
 *
 * One per day in date order first. Only once every day has been used does it
 * come back round for a second time on a day, and then it takes the slot
 * furthest from what that day already offers — so a day carrying two options
 * carries a morning and an afternoon rather than 09:00 and 09:30.
 *
 * The time zone is the HOST's: "different days" has to mean different days
 * where the host lives, not in UTC, or a late-evening slot lands on tomorrow
 * and the spread is computed against a calendar nobody is looking at.
 */
export function spreadAcrossDays(slots: Date[], count: number, timeZone: string): Date[] {
  if (count <= 0) return [];
  if (slots.length <= count) return [...slots].sort((a, b) => +a - +b);

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dayKey = (d: Date) => fmt.format(d);

  const byDay = new Map<string, Date[]>();
  for (const d of [...slots].sort((a, b) => +a - +b)) {
    const k = dayKey(d);
    const a = byDay.get(k) ?? [];
    a.push(d);
    byDay.set(k, a);
  }
  const days = [...byDay.keys()].sort();

  const chosen: Date[] = [];
  // Bounded rather than `while (chosen.length < count)`: if every day somehow
  // empties, an unbounded loop here would spin forever on a request thread.
  for (let round = 0; chosen.length < count && round < count + 1; round += 1) {
    for (const day of days) {
      if (chosen.length >= count) break;
      const available = byDay.get(day) ?? [];
      if (available.length === 0) continue;
      const alreadyToday = chosen.filter((c) => dayKey(c) === day);
      let pick = available[0]!;
      if (alreadyToday.length > 0) {
        let widest = -1;
        for (const cand of available) {
          const gap = Math.min(...alreadyToday.map((c) => Math.abs(+cand - +c)));
          if (gap > widest) {
            widest = gap;
            pick = cand;
          }
        }
      }
      chosen.push(pick);
      byDay.set(
        day,
        available.filter((d) => +d !== +pick),
      );
    }
  }
  return chosen.sort((a, b) => +a - +b);
}
