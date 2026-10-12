// Local shapes for the access surface (GET /api/v1/membership/grants).

// `team_calendar` (2026-10-12) is a TEAM's whole calendar at a percentage,
// and deliberately not a widening of `thread` — that kind means "enrol this
// member into THIS ONE named thread", it has a worker, and live grants are
// delivering through it. The API's vocabulary is the same list
// (routes/membership.ts GrantKind).
export const GRANT_KINDS = [
  'circle',
  'thread',
  'team_calendar',
  'fibre_seat',
  'google_user',
] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

// Grant-kind display labels moved into lib/i18n-ui.ts (grant_kind_* keys) —
// UI renders them per locale, so no English map lives here any more.

export type Grant = {
  id: string;
  tier_id: string | null;
  product_id: string | null;
  kind: GrantKind;
  // Non-secret targeting only: {space_id} for circle, {thread_slug} for
  // thread, {team_id, discount_pct} for team_calendar.
  config: Record<string, unknown>;
  created_at: string;
  // embeds can come back as object OR single-element array from PostgREST.
  tier: { name: string } | { name: string }[] | null;
  product: { name: string } | { name: string }[] | null;
};

// `unknown` lets callers pass a translated fallback (i18n P3).
export function grantTierName(t: Grant['tier'], unknown = 'Unknown tier'): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? unknown;
}

/** A team as the grant surfaces need it: the id to store, the name to show,
 *  and whether its calendar is published — an unpublished team's threads are
 *  not public at all, so a grant on one is a promise nobody can use yet.
 *  From GET /api/v1/thread/teams (a cross-app read, like threadOptions). */
export type TeamOption = { id: string; name: string; is_published?: boolean };
