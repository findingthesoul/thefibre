// What the API adds to the shared team-calendar rule.
//
// The rule — blank means 100, 0 means nothing, whole numbers 1 to 100 — lives
// in @thefibre/shared/team-calendar-grant, because the FORM offers with it and
// the API must refuse exactly what the form refuses. Two statements of one
// rule is how a product comes to promise what the API rejects.
//
// Here is the half a browser cannot know: `team_id` is a foreign key, so a
// well-formed id that is not a uuid is a dangling reference nothing notices
// until a member gets no discount. And the words: a refusal travels back to a
// person, so it says which thing was wrong.

import {
  teamCalendarGrantConfig,
  type TeamCalendarRefusal,
} from '@thefibre/shared/team-calendar-grant';

export const TEAM_CALENDAR_REFUSAL: Record<TeamCalendarRefusal, string> = {
  team: 'a team calendar grant needs a team',
  zero: 'a 0% grant promises nothing — drop the grant instead',
  range: 'the discount must be a whole percentage between 1 and 100',
  not_a_number: 'the discount must be a number',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The config a `team_calendar` grant is stored with, or why not. */
export function parseTeamCalendarConfig(
  config: Record<string, unknown>,
): { ok: true; config: Record<string, unknown> } | { ok: false; message: string } {
  const r = teamCalendarGrantConfig(
    typeof config.team_id === 'string' ? config.team_id : null,
    config.discount_pct as string | number | null | undefined,
  );
  if (!r.ok) return { ok: false, message: TEAM_CALENDAR_REFUSAL[r.reason] };
  if (!UUID.test(r.config.team_id)) return { ok: false, message: TEAM_CALENDAR_REFUSAL.team };
  return { ok: true, config: r.config as unknown as Record<string, unknown> };
}
