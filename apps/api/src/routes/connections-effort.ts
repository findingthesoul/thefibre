// How long things take, per workspace. connections-overview.md §3.
//
//   GET /connections/effort   every kind: its default, this workspace's
//                             override if any, and whether you may edit
//   PUT /connections/effort   replace overrides; a null puts the default back
//
// Shaped like connections-labels.ts on purpose: sparse rows, reads through the
// service client with an explicit workspace filter, writes through the USER's
// client so RLS alone decides who may change a shared default.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsEffortRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import {
  DEFAULT_MINUTES,
  EFFORT_KINDS,
  PER_PERSON,
  isEffortKind,
  type EffortOverrides,
} from '../lib/effort.js';

export const connectionsEffortRoutes = new Hono();

/** This workspace's overrides. Never throws: Today must still render with the
 *  shipped defaults if this read fails. */
export async function loadEffortOverrides(workspaceId: string): Promise<EffortOverrides> {
  const { data, error } = await adminClient
    .from('connections_effort_default')
    .select('kind, minutes')
    .eq('workspace_id', workspaceId);
  if (error) {
    console.error('[connections/effort] overrides read failed', error.message);
    return {};
  }
  const out: EffortOverrides = {};
  for (const r of (data ?? []) as { kind: string; minutes: number }[]) {
    if (isEffortKind(r.kind)) out[r.kind] = r.minutes;
  }
  return out;
}

connectionsEffortRoutes.get('/effort', async (c) => {
  const ctx = c.get('ctx');
  const overrides = await loadEffortOverrides(ctx.workspaceId);

  // The same "may I edit" answer the band names give, for the same reason:
  // one screen's question, asked of the endpoint that screen already calls.
  let canEdit = false;
  if (ctx.auth === 'user') {
    const { data: member } = await adminClient
      .from('workspace_member')
      .select('workspace_role')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    canEdit = member?.workspace_role === 'admin' || member?.workspace_role === 'super_admin';
  }

  return c.json({
    kinds: EFFORT_KINDS.map((kind) => ({
      kind,
      default_minutes: DEFAULT_MINUTES[kind],
      minutes: overrides[kind] ?? null,
      per_person: PER_PERSON.has(kind),
    })),
    can_edit: canEdit,
  });
});

const PutBody = z.object({
  // null = "use the shipped default again", which deletes the row. Storing
  // the default as an override would freeze it against later improvements.
  minutes: z.record(z.string(), z.number().int().min(0).max(1440).nullable()),
});

connectionsEffortRoutes.put('/effort', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const parsed = PutBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);

  const unknown = Object.keys(parsed.data.minutes).filter((k) => !isEffortKind(k));
  if (unknown.length) return c.json({ error: `unknown kind: ${unknown.join(', ')}` }, 400);

  const db = userClient(ctx.jwt);
  const now = new Date().toISOString();
  const upserts: { workspace_id: string; kind: string; minutes: number; updated_at: string; updated_by: string | null }[] = [];
  const clears: string[] = [];
  for (const [kind, minutes] of Object.entries(parsed.data.minutes)) {
    if (minutes === null) clears.push(kind);
    else upserts.push({ workspace_id: ctx.workspaceId, kind, minutes, updated_at: now, updated_by: ctx.userId || null });
  }

  // A non-admin's delete matches nothing under RLS and reports no error, and
  // an upsert is refused as a policy violation. Ask RLS's own question up
  // front instead, so both paths answer 403 rather than one of them claiming
  // success for a change that never happened.
  const { data: member } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (member?.workspace_role !== 'admin' && member?.workspace_role !== 'super_admin') {
    return c.json({ error: 'only an admin can change the defaults' }, 403);
  }

  if (clears.length) {
    const { error } = await db
      .from('connections_effort_default')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .in('kind', clears);
    if (error) return c.json({ error: error.message }, 403);
  }
  if (upserts.length) {
    const { error } = await db
      .from('connections_effort_default')
      .upsert(upserts, { onConflict: 'workspace_id,kind' });
    if (error) return c.json({ error: error.message }, 403);
  }
  return c.json({ ok: true });
});
