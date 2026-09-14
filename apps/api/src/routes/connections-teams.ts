// Teams, as a way to organise what people record and to run an update meeting.
//
// Sjoerd, 2026-09-14 — the full ask is in the header of
// 20260914090000_teams_organise_notes.sql. In short: file what happened under
// one of your teams, with a default preselected; then pick a team and a
// period and see every update by everyone in it.
//
// ── A filter, not a wall ───────────────────────────────────────────────────
//
// Nothing here narrows who can see a note. A team update is a question —
// "what did this team record this fortnight" — asked of notes that stay as
// visible as they already were. That is why the update read below needs no
// team membership of the asker: anybody in the workspace could read the same
// notes one person at a time today.
//
// ── Service client, so every filter is ours ────────────────────────────────
//
// Every query names the workspace or reaches it through the team's own row,
// per the rule for adminClient (and the sweep of 2026-09-13).
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsTeamsRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const connectionsTeamsRoutes = new Hono();

type TeamRow = { id: string; name: string; workspace_id: string };

/**
 * The teams I am an active member of, in this workspace, and which is my
 * default. A person with no teams gets an empty list — the composer then
 * simply shows no team picker, which is the normal state for most workspaces.
 */
connectionsTeamsRoutes.get('/my-teams', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ teams: [] });

  const { data, error } = await adminClient
    .from('team_member')
    .select('is_default, created_at, team:team_id!inner(id, name, workspace_id, is_active)')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .eq('team.workspace_id', ctx.workspaceId)
    .eq('team.is_active', true);
  if (error) return c.json({ error: error.message }, 500);

  const rows = ((data ?? []) as unknown as {
    is_default: boolean;
    created_at: string;
    team: TeamRow | TeamRow[];
  }[]).map((r) => ({ ...r, team: Array.isArray(r.team) ? r.team[0]! : r.team }));

  // At most one default. Should two ever coexist (the API is the only writer
  // and prevents it, but a hand edit could not), the earliest-joined wins, so
  // the answer is stable rather than whichever the database returned first.
  const defaults = rows.filter((r) => r.is_default).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const defaultId = defaults[0]?.team.id ?? null;

  return c.json({
    teams: rows
      .map((r) => ({ id: r.team.id, name: r.team.name, is_default: r.team.id === defaultId }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
});

const DefaultBody = z.object({ team_id: z.string().uuid().nullable() });

/**
 * Make one of my teams my default, or clear it.
 *
 * Clears every OTHER default of mine in this workspace first, then sets the
 * new one — which is how "one default per person per workspace" is kept
 * without a constraint the schema cannot express (see the migration).
 */
connectionsTeamsRoutes.put('/my-teams/default', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);
  const parsed = DefaultBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);

  // My active teams in this workspace — the set a default may be chosen from
  // and the set whose other defaults are cleared.
  const { data: mine, error } = await adminClient
    .from('team_member')
    .select('team_id, team:team_id!inner(workspace_id)')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .eq('team.workspace_id', ctx.workspaceId);
  if (error) return c.json({ error: error.message }, 500);
  const teamIds = ((mine ?? []) as { team_id: string }[]).map((r) => r.team_id);

  const target = parsed.data.team_id;
  if (target && !teamIds.includes(target)) return c.json({ error: 'team_id not found' }, 404);

  if (teamIds.length) {
    const { error: clearErr } = await adminClient
      .from('team_member')
      .update({ is_default: false })
      .eq('user_id', ctx.userId)
      .in('team_id', teamIds);
    if (clearErr) return c.json({ error: clearErr.message }, 500);
  }
  if (target) {
    const { error: setErr } = await adminClient
      .from('team_member')
      .update({ is_default: true })
      .eq('user_id', ctx.userId)
      .eq('team_id', target);
    if (setErr) return c.json({ error: setErr.message }, 500);
  }
  return c.json({ ok: true });
});

const UpdatesQuery = z.object({
  team_id: z.string().uuid(),
  since_days: z.coerce.number().int().min(1).max(366).default(14),
});

/**
 * A team's update: everybody in it, and what each filed under it in the period.
 *
 * Sjoerd: *"everybody part of the team is then listed. And this way, we can do
 * an update meeting"*. So every active member is returned, INCLUDING those who
 * filed nothing — somebody with nothing to report is part of the meeting, and
 * a list that silently dropped them would read as if they were not in the
 * team at all.
 *
 * Notes only, for now: they are what is filed under a team. Stage changes and
 * relationship edits carry no team, so they cannot honestly be put in a team's
 * update yet, and are not.
 */
connectionsTeamsRoutes.get('/team-updates', async (c) => {
  const ctx = c.get('ctx');
  const parsed = UpdatesQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: 'invalid query' }, 400);
  const { team_id, since_days } = parsed.data;

  const { data: team } = await adminClient
    .from('team')
    .select('id, name')
    .eq('id', team_id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  // Missing and elsewhere answer the same, as everywhere.
  if (!team) return c.json({ error: 'not found' }, 404);

  const since = new Date(Date.now() - since_days * 86_400_000).toISOString();

  const [membersRes, notesRes] = await Promise.all([
    adminClient
      .from('team_member')
      .select('user_id, role, user:user_id(id, full_name, email)')
      .eq('team_id', team_id)
      .eq('status', 'active'),
    adminClient
      .from('flow_run_note')
      .select('id, body, kind, happened_at, follow_up_at, created_by, person_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('team_id', team_id)
      .eq('is_draft', false)
      .is('deleted_at', null)
      .gte('happened_at', since)
      .order('happened_at', { ascending: false })
      .limit(500),
  ]);
  const failed = membersRes.error ?? notesRes.error;
  if (failed) return c.json({ error: failed.message }, 500);

  const notes = (notesRes.data ?? []) as {
    id: string;
    body: string;
    kind: string;
    happened_at: string;
    follow_up_at: string | null;
    created_by: string | null;
    person_id: string | null;
  }[];

  // Names for the people the notes are about, in one read, workspace-scoped.
  const personIds = [...new Set(notes.map((n) => n.person_id).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (personIds.length) {
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', personIds);
    for (const p of (people ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]) {
      names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || '');
    }
  }

  type UserRow = { id: string; full_name: string | null; email: string | null };
  const members = ((membersRes.data ?? []) as unknown as { user_id: string; role: string; user: UserRow | UserRow[] | null }[])
    .map((m) => {
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      return {
        user_id: m.user_id,
        role: m.role,
        name: u?.full_name?.trim() || u?.email || '',
        updates: notes
          .filter((n) => n.created_by === m.user_id)
          .map((n) => ({
            id: n.id,
            body: n.body,
            kind: n.kind,
            happened_at: n.happened_at,
            follow_up_at: n.follow_up_at,
            person: n.person_id ? { id: n.person_id, name: names.get(n.person_id) ?? '' } : null,
          })),
      };
    })
    // Busiest first, so the meeting starts where there is most to say.
    .sort((a, b) => b.updates.length - a.updates.length || a.name.localeCompare(b.name));

  return c.json({ team, since_days, members });
});
