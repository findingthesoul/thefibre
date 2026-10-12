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
import { adminClient } from '../db.js';

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

/**
 * Does this team belong to the workspace writing the grant?
 *
 * A uuid is well formed and still somebody else's. Nothing downstream pays
 * out on a foreign team — `memberDiscountFor` resolves the member inside the
 * THREAD's workspace, so the ids can never meet — but a row that can only
 * ever be wrong should not be written, and the write is where the question
 * can be answered.
 *
 * Service-role on purpose: the caller has already been authorised for this
 * workspace, and the lookup must be able to see a team in ANY workspace in
 * order to say no to it. RLS would hide the foreign row and make a tenancy
 * breach look like a typo.
 */
export async function teamIsInWorkspace(
  teamId: string,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await adminClient
    .from('team')
    .select('id, workspace_id, is_active')
    .eq('id', teamId)
    .maybeSingle();
  if (error) return { ok: false, message: 'could not check the team' };
  // Deliberately ONE message for "no such team", "not yours" and "switched
  // off": a writer who may not have this team has no business learning
  // whether it exists. (`team` has no deleted_at — it is deactivated with
  // is_active, asked of the database rather than assumed.)
  if (!data || data.workspace_id !== workspaceId || data.is_active === false) {
    return { ok: false, message: 'no such team in this workspace' };
  }
  return { ok: true };
}
