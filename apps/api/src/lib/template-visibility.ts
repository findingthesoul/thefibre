// Who may see a template — the one answer, for every kind of template.
//
// Scope rules (Sjoerd 2026-07-02): personal = the owner only; team = that
// team's members; workspace = everyone, UNLESS grants exist — then only the
// granted users and teams, plus whoever made it.
//
// Lifted out of routes/thread.ts on 2026-09-23, when to-do lists became a
// third kind of template. It had been a private function beside the
// certificate routes, so a third caller would have meant a third copy of a
// rule that is genuinely one rule. `kind` is the template_kind stored on
// thread_template_share.

import { adminClient } from '../db.js';

/** Every team this user belongs to, by id. */
export async function userTeamIds(userId: string): Promise<Set<string>> {
  const { data, error } = await adminClient
    .from('team_member')
    .select('team_id')
    .eq('user_id', userId);
  // An error here is not "you are in no teams" — it would silently narrow
  // every team-scoped template out of somebody's list, which looks exactly
  // like the templates not existing (docs/testing-approach.md §1.7).
  if (error) console.warn('[templates] user teams', error.message);
  return new Set((data ?? []).map((r) => r.team_id));
}

export type ScopedTemplate = {
  id: string;
  scope: string;
  owner_user_id: string | null;
  owner_team_id: string | null;
  created_by: string | null;
};

export type TemplateKind = 'certificate' | 'thread' | 'todo';

export async function filterVisibleTemplates<T extends ScopedTemplate>(
  rows: T[],
  kind: TemplateKind,
  userId: string,
): Promise<T[]> {
  const teamIds = await userTeamIds(userId);
  const workspaceScoped = rows.filter((r) => r.scope === 'workspace').map((r) => r.id);
  const sharesByTemplate = new Map<string, { users: Set<string>; teams: Set<string> }>();
  if (workspaceScoped.length) {
    const { data: shares, error } = await adminClient
      .from('thread_template_share')
      .select('template_id, grantee_user_id, grantee_team_id')
      .eq('template_kind', kind)
      .in('template_id', workspaceScoped);
    if (error) console.warn('[templates] shares', error.message);
    for (const s of shares ?? []) {
      const e = sharesByTemplate.get(s.template_id) ?? { users: new Set(), teams: new Set() };
      if (s.grantee_user_id) e.users.add(s.grantee_user_id);
      if (s.grantee_team_id) e.teams.add(s.grantee_team_id);
      sharesByTemplate.set(s.template_id, e);
    }
  }
  return rows.filter((r) => {
    if (r.scope === 'personal') return r.owner_user_id === userId || r.created_by === userId;
    if (r.scope === 'team') return !!r.owner_team_id && teamIds.has(r.owner_team_id);
    // workspace
    const share = sharesByTemplate.get(r.id);
    if (!share) return true; // no grants = the whole workspace
    if (r.created_by === userId) return true;
    if (share.users.has(userId)) return true;
    return [...share.teams].some((t) => teamIds.has(t));
  });
}
