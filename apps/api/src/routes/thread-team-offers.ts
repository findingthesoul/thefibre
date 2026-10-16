// A thread offered to more teams than its owner (Sjoerd, 2026-10-16: "Yes,
// build it"; docs in lib/thread-teams.ts, the one reader).
//
//   GET    /thread/threads/:id/team-offers           the owner, and the teams it is offered to
//   PUT    /thread/threads/:id/team-offers           set the list ({ team_ids })
//   GET    /thread/teams/:teamId/offered             threads offered TO this team
//   DELETE /thread/teams/:teamId/offered/:threadId   the receiving side takes one off
//
// WHO. The thread's side: its organiser, a lead of its owning team, or a
// workspace admin. The receiving side: a lead of THAT team, or a workspace
// admin — no accept step (Sjoerd), so removing is the brake.
//
// Every query filters workspace_id explicitly: the service role does not see
// RLS (handbook §2). The table's own guard also refuses a cross-workspace row.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { threadLocked } from './thread.js';

export const threadTeamOfferRoutes = new Hono();

type Ctx = { userId: string; workspaceId: string };

async function workspaceAdmin(ctx: Ctx): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

async function leadOf(teamId: string | null, userId: string): Promise<boolean> {
  if (!teamId) return false;
  const { data } = await adminClient
    .from('team_member')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('role', 'lead')
    .eq('status', 'active')
    .maybeSingle();
  return !!data;
}

async function loadThread(id: string, ctx: Ctx) {
  const { data } = await adminClient
    .from('thread_thread')
    .select('id, workspace_id, team_id, organiser:organiser_id (user_id)')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  return data as { id: string; workspace_id: string; team_id: string | null; organiser: unknown } | null;
}

/** The organiser, a lead of the owning team, or a workspace admin. */
async function mayOffer(t: { team_id: string | null; organiser: unknown }, ctx: Ctx): Promise<boolean> {
  const org = (Array.isArray(t.organiser) ? t.organiser[0] : t.organiser) as { user_id?: string | null } | null;
  if (org?.user_id && org.user_id === ctx.userId) return true;
  if (await leadOf(t.team_id, ctx.userId)) return true;
  return workspaceAdmin(ctx);
}

/** The offers of a thread, minus its current owner. The table's guard stops
 *  an owner-team offer at insert, but the owner can CHANGE later to a team
 *  that already had one; that row is the owner twice and is not shown. */
async function offersOf(t: { id: string; team_id: string | null }, ctx: Ctx) {
  const { data, error } = await adminClient
    .from('thread_team_offer')
    .select('team_id, created_at, team:team_id (name, slug, is_published)')
    .eq('workspace_id', ctx.workspaceId)
    .eq('thread_id', t.id)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => r.team_id !== t.team_id)
    .map((r) => {
      const team = (Array.isArray(r.team) ? r.team[0] : r.team) as { name?: string; slug?: string; is_published?: boolean } | null;
      return {
        team_id: r.team_id as string,
        name: team?.name ?? null,
        slug: team?.slug ?? null,
        is_published: team?.is_published ?? null,
        added_at: r.created_at as string,
      };
    });
}

threadTeamOfferRoutes.get('/threads/:id/team-offers', async (c) => {
  const ctx = c.get('ctx');
  const t = await loadThread(c.req.param('id'), ctx);
  if (!t) return c.json({ error: 'not found' }, 404);
  return c.json({ owner_team_id: t.team_id, offers: await offersOf(t, ctx), can_edit: await mayOffer(t, ctx) });
});

const PutOffers = z.object({ team_ids: z.array(z.string().uuid()).max(50) });

threadTeamOfferRoutes.put('/threads/:id/team-offers', async (c) => {
  const ctx = c.get('ctx');
  const body = PutOffers.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const t = await loadThread(c.req.param('id'), ctx);
  if (!t) return c.json({ error: 'not found' }, 404);
  if (!(await mayOffer(t, ctx))) {
    return c.json({ error: 'only the thread’s organiser, a lead of its team or a workspace admin can offer it to teams' }, 403);
  }
  if (await threadLocked(t.id)) {
    return c.json({ error: 'this thread is locked. Unlock it in Settings to make changes.', code: 'thread_locked' }, 423);
  }
  // The owner is never "also offered to" itself; asking for it is a no-op.
  const wanted = [...new Set(body.data.team_ids)].filter((id) => id !== t.team_id);
  if (wanted.length) {
    const { data: teams } = await adminClient
      .from('team')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', wanted);
    if ((teams ?? []).length !== wanted.length) return c.json({ error: 'one of these teams is not in this workspace' }, 400);
  }
  const { data: current } = await adminClient
    .from('thread_team_offer')
    .select('team_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('thread_id', t.id);
  const have = new Set((current ?? []).map((r) => r.team_id as string));
  const add = wanted.filter((id) => !have.has(id));
  // Removing includes a stale row naming the CURRENT owner (owner changed
  // after the offer): the set the person saved is the truth.
  const drop = [...have].filter((id) => !wanted.includes(id));
  if (drop.length) {
    const { error } = await adminClient
      .from('thread_team_offer')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('thread_id', t.id)
      .in('team_id', drop);
    if (error) return c.json({ error: error.message }, 500);
  }
  if (add.length) {
    const { error } = await adminClient.from('thread_team_offer').insert(
      add.map((team_id) => ({ workspace_id: ctx.workspaceId, thread_id: t.id, team_id, added_by_user_id: ctx.userId })),
    );
    if (error) return c.json({ error: error.message }, error.code === '23514' ? 400 : 500);
  }
  return c.json({ owner_team_id: t.team_id, offers: await offersOf(t, ctx), can_edit: true });
});

/** The receiving side: a lead of that team, or a workspace admin. */
async function mayReceive(teamId: string, ctx: Ctx): Promise<boolean> {
  return (await leadOf(teamId, ctx.userId)) || workspaceAdmin(ctx);
}

threadTeamOfferRoutes.get('/teams/:teamId/offered', async (c) => {
  const ctx = c.get('ctx');
  const teamId = c.req.param('teamId');
  if (!z.string().uuid().safeParse(teamId).success) return c.json({ error: 'not found' }, 404);
  const { data: team } = await adminClient.from('team').select('id').eq('id', teamId).eq('workspace_id', ctx.workspaceId).maybeSingle();
  if (!team) return c.json({ error: 'not found' }, 404);
  const { data, error } = await adminClient
    .from('thread_team_offer')
    .select('thread_id, created_at, thread:thread_id (slug, team_id, team:team_id (name), program:program_id (title, starts_on))')
    .eq('workspace_id', ctx.workspaceId)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  const one = <T,>(v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null;
  const items = (data ?? [])
    .map((r) => {
      const th = one<{ slug: string; team_id: string | null; team: unknown; program: unknown }>(r.thread);
      const program = one<{ title?: string; starts_on?: string | null }>(th?.program);
      return {
        thread_id: r.thread_id as string,
        title: program?.title ?? th?.slug ?? null,
        starts_on: program?.starts_on ?? null,
        owner_team: one<{ name?: string }>(th?.team)?.name ?? null,
        owner_team_id: th?.team_id ?? null,
        added_at: r.created_at as string,
      };
    })
    // Owner twice (the owner changed after the offer): not "offered to" it.
    .filter((x) => x.owner_team_id !== teamId);
  return c.json({ items, can_remove: await mayReceive(teamId, ctx) });
});

threadTeamOfferRoutes.delete('/teams/:teamId/offered/:threadId', async (c) => {
  const ctx = c.get('ctx');
  const teamId = c.req.param('teamId');
  const threadId = c.req.param('threadId');
  if (!z.string().uuid().safeParse(teamId).success || !z.string().uuid().safeParse(threadId).success) {
    return c.json({ error: 'not found' }, 404);
  }
  if (!(await mayReceive(teamId, ctx))) return c.json({ error: 'only a lead of this team or a workspace admin can remove it' }, 403);
  const { data, error } = await adminClient
    .from('thread_team_offer')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .eq('team_id', teamId)
    .eq('thread_id', threadId)
    .select('id');
  if (error) return c.json({ error: error.message }, 500);
  if (!data?.length) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
