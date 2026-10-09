// Who may change which apps a team confers.
//
// ONE rule, exported, called by both the screen's offer and the route's
// refusal. Not because duplication is untidy — because a screen that offers
// an edit the route then answers with a 402 is two implementations of one
// rule, and they drift. That exact shape cost a release on 2026-10-09: the
// publish switch said a page was off while the link beside it still offered
// to open the page, each half right about its own question and wrong
// together.
//
// ---------------------------------------------------------------------------
// The rule (Sjoerd, 2026-10-09)
// ---------------------------------------------------------------------------
// The two AUTOMATIC teams are editable on EVERY plan. They are not a feature
// somebody bought; they are how a workspace decides what a new person gets.
// Everyone's grants ARE the baseline — a workspace on the Free plan that
// cannot edit them cannot answer "what does a newcomer get?" at all, and the
// answer would be frozen at whatever the first activation happened to set.
//
// CUSTOM teams stay Pro. Making a team to give one group of people a
// different set of apps is the access-control feature, and it is the one that
// is sold. Nothing about that changes.
//
// So the question is never "does this workspace have the feature?" alone. It
// is always about a PARTICULAR team, which is why this takes the team.

/** The part of a team this rule needs. `automatic` is 'admins' | 'everyone'
 *  for the two maintained teams and null for every team a person made. */
export type TeamForEditing = { automatic?: string | null };

/**
 * May the apps of THIS team be edited, given what the plan allows?
 *
 * @param team       the team in question — only `automatic` is read
 * @param planAllows what `can(workspaceId, 'team_access_groups')` answered
 *
 * Callers must still check that the caller is a workspace admin; this answers
 * the plan question only, and says nothing about who is asking.
 */
export function mayEditTeamApps(team: TeamForEditing, planAllows: boolean): boolean {
  return isAutomatic(team) || planAllows;
}

/**
 * Why the edit was refused, for the 402 body — or null when it is allowed.
 *
 * Lives here so the sentence cannot say "Pro" about a team this very file
 * considers editable on any plan.
 */
export function teamAppsRefusal(team: TeamForEditing, planAllows: boolean): string | null {
  return mayEditTeamApps(team, planAllows) ? null : 'Giving teams app access';
}

function isAutomatic(team: TeamForEditing): boolean {
  return team.automatic === 'admins' || team.automatic === 'everyone';
}
