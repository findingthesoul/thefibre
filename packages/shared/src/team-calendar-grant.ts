// The team-calendar grant's shape, and the one rule about its percentage.
//
// A `team_calendar` grant says: members on this product (or tier) get a
// percentage off every thread in this team's calendar. Two surfaces write
// one — the product dialog and the legacy tier Access dialog — and the API
// validates what arrives. Three places, one rule, or the form offers what the
// API refuses.
//
// WHY 0 IS NOT A DISCOUNT. A 0% grant is a promise with nothing behind it,
// which is the exact failure this area had once before: `thread` grants were
// offered with no worker, so a product said a member got something and the
// member silently got nothing for months. A tier that should not carry the
// calendar drops the grant; it does not grant nothing.
//
// WHY MISSING MEANS 100. The case somebody actually wants — "this calendar is
// included in the membership" — is 100, and a blank field should land there
// rather than on a number that charges full price. The API's zod schema has
// the same default, and a test asserts the two agree rather than hoping.
//
// Pure on purpose: no React, so the API can import it (apps/api already
// depends on @thefibre/shared) and the two sides can be tested against each
// other.

export type TeamCalendarGrantConfig = { team_id: string; discount_pct: number };

/** Why a percentage was refused. The caller translates; this names the case. */
export type TeamCalendarRefusal = 'team' | 'zero' | 'range' | 'not_a_number';

export type TeamCalendarGrantResult =
  | { ok: true; config: TeamCalendarGrantConfig }
  | { ok: false; reason: TeamCalendarRefusal };

/**
 * The config a team-calendar grant should be written with, or why not.
 *
 * `pct` takes whatever a form holds — a string from an input, a number, or
 * nothing at all. Empty means 100, deliberately; `0` does not, and neither
 * does `'0'`.
 */
export function teamCalendarGrantConfig(
  teamId: string | null | undefined,
  pct?: string | number | null,
): TeamCalendarGrantResult {
  const team = (teamId ?? '').trim();
  if (!team) return { ok: false, reason: 'team' };

  // An untouched field is the included-in-the-membership case.
  const raw = typeof pct === 'string' ? pct.trim() : pct;
  if (raw === '' || raw === null || raw === undefined) {
    return { ok: true, config: { team_id: team, discount_pct: 100 } };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, reason: 'not_a_number' };
  // A whole percentage: a grant at 12.5% is a price nobody can explain, and
  // the API stores an integer.
  if (!Number.isInteger(n)) return { ok: false, reason: 'range' };
  if (n === 0) return { ok: false, reason: 'zero' };
  if (n < 0 || n > 100) return { ok: false, reason: 'range' };
  return { ok: true, config: { team_id: team, discount_pct: n } };
}

/** Which sentence describes a percentage, so one surface cannot call 100
 *  "free for members" while another calls it "100% off". The CALLER supplies
 *  the words; this decides which of them applies. */
export function teamCalendarPctCase(pct?: string | number | null): 'free' | 'partial' | 'invalid' {
  const r = teamCalendarGrantConfig(TEAM_SENTINEL, pct);
  if (!r.ok) return 'invalid';
  return r.config.discount_pct === 100 ? 'free' : 'partial';
}

/** What is wrong with a percentage ALONE, with no opinion about the team —
 *  so a form can say why the number is refused before one is picked. */
export function teamCalendarPctRefusal(
  pct?: string | number | null,
): Exclude<TeamCalendarRefusal, 'team'> | null {
  const r = teamCalendarGrantConfig(TEAM_SENTINEL, pct);
  if (r.ok) return null;
  // 'team' cannot happen with the sentinel, and narrowing says so.
  return r.reason === 'team' ? 'range' : r.reason;
}

// Stands in for a team when only the percentage is being judged. Never
// stored: every caller that writes a grant passes a real id.
const TEAM_SENTINEL = 'percentage-only';
