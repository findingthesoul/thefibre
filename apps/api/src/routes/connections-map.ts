// The desktop map: everybody, and who is near somebody.
//
// docs/connections-desktop.md. Two reads, both derived, nothing stored.
//
//   GET /connections/map                       everyone, with what placement
//                                              needs: rung, last contact,
//                                              whether they need attention
//   GET /connections/map/:personId/neighbourhood   who is near one person, and
//                                              every reason why
//
// Placement itself is NOT here. It is a pure function in the web app
// (lib/map-layout.ts), because it has to be stable and cheap to recompute as
// the view pans, and because doing it server-side would mean a round trip per
// zoom. This returns facts; the browser decides where they go.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsMapRoutes);

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { rowInWorkspace } from '../lib/workspace-refs.js';

export const connectionsMapRoutes = new Hono();

type PersonRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

function nameOf(p: PersonRow): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Unnamed';
}

connectionsMapRoutes.get('/map', async (c) => {
  const ctx = c.get('ctx');

  // Four reads that do not depend on each other, in parallel.
  const [peopleRes, landscapeRes, attentionRes, notesRes] = await Promise.all([
    adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .limit(5000),
    // Rung and last_seen, from the one definition of the ladder.
    adminClient.rpc('connections_landscape', { p_workspace: ctx.workspaceId }),
    adminClient.rpc('connections_attention', { p_workspace: ctx.workspaceId, p_limit: 500 }),
    // The latest committed personal note per person. last_seen in the
    // landscape is built from activity and attendance; a conversation written
    // down is contact too, and the most deliberate kind.
    adminClient
      .from('flow_run_note')
      .select('person_id, happened_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('is_draft', false)
      .is('deleted_at', null)
      .not('person_id', 'is', null)
      .in('kind', ['call', 'meeting', 'message', 'note'])
      .order('happened_at', { ascending: false })
      .limit(5000),
  ]);

  if (peopleRes.error) return c.json({ error: peopleRes.error.message }, 500);

  const rung = new Map<string, string>();
  const seen = new Map<string, string>();
  for (const r of (landscapeRes.data ?? []) as { person_id: string; rung: string; last_seen: string | null }[]) {
    rung.set(r.person_id, r.rung);
    // -infinity comes back as a string PostgREST cannot turn into a date;
    // treat anything unparseable as "never" rather than as today.
    if (r.last_seen && !Number.isNaN(new Date(r.last_seen).getTime())) seen.set(r.person_id, r.last_seen);
  }

  for (const n of (notesRes.data ?? []) as { person_id: string; happened_at: string }[]) {
    const prev = seen.get(n.person_id);
    if (!prev || new Date(n.happened_at) > new Date(prev)) seen.set(n.person_id, n.happened_at);
  }

  const attention = new Set(
    ((attentionRes.data ?? []) as { person_id: string }[]).map((r) => r.person_id),
  );

  const people = ((peopleRes.data ?? []) as PersonRow[]).map((p) => ({
    id: p.id,
    name: nameOf(p),
    rung: rung.get(p.id) ?? null,
    lastContactAt: seen.get(p.id) ?? null,
    attention: attention.has(p.id),
  }));

  return c.json({ people });
});

connectionsMapRoutes.get('/map/:personId/neighbourhood', async (c) => {
  const ctx = c.get('ctx');
  const personId = c.req.param('personId');

  // The focus must live in this workspace. The SQL function is security
  // definer and scopes its OUTPUT to p_workspace, but asking it about a
  // foreign person should be refused outright rather than answered with an
  // empty list — the same 404 for "missing" and "elsewhere" that every
  // service-role route now gives (lib/workspace-refs.ts).
  if (!(await rowInWorkspace('person', personId, ctx.workspaceId))) {
    return c.json({ error: 'not found' }, 404);
  }

  const { data, error } = await adminClient.rpc('connections_neighbourhood', {
    p_workspace: ctx.workspaceId,
    p_person: personId,
    p_limit: 40,
  });
  if (error) return c.json({ error: error.message }, 500);

  const rows = (data ?? []) as { person_id: string; weight: number; reasons: { kind: string; label: string }[] }[];
  const ids = rows.map((r) => r.person_id);

  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', ids);
    for (const p of (people ?? []) as PersonRow[]) names.set(p.id, nameOf(p));
  }

  return c.json({
    neighbours: rows
      // A neighbour whose name could not be read was filtered by the workspace
      // above — drop it rather than show an anonymous dot.
      .filter((r) => names.has(r.person_id))
      .map((r) => ({
        id: r.person_id,
        name: names.get(r.person_id)!,
        weight: r.weight,
        reasons: r.reasons,
      })),
  });
});
