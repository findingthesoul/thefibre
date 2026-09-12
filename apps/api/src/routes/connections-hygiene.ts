// The hygiene review queue, as an interface can read it.
//
// docs/connections-data-integrity.md §9.3. The sweep in lib/hygiene.ts writes
// findings; this is where a person sees them and decides.
//
// TWO VERBS ONLY: accept and dismiss. There is deliberately no "fix
// everything" — the whole point of a queue is that a person looked. A bulk
// accept would recreate the silent repair this design refuses, with an extra
// click of ceremony in front of it.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsHygieneRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';

export const connectionsHygieneRoutes = new Hono();

const ListQuery = z.object({
  status: z.enum(['open', 'fixed', 'accepted', 'dismissed']).default('open'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * The queue, with the people named.
 *
 * A finding says `subject_id`; a person reading it needs a name. Resolved
 * here rather than in SQL because `subject_table` varies — a finding can be
 * about a person, a note or a flow run — and a join per shape inside the
 * sweep would push interface concerns into the thing that has to stay a
 * cheap scheduled query.
 */
connectionsHygieneRoutes.get('/hygiene', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const parsed = ListQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'invalid query' }, 400);

  // Through the USER's client: the policy is admin-only, and re-deriving that
  // here would be a second copy of an authorisation rule free to drift from
  // the first. A member simply gets an empty list.
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('hygiene_finding')
    .select('id, kind, subject_table, subject_id, related_id, evidence, status, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', parsed.data.status)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit);
  if (error) return c.json({ error: error.message }, 500);

  const personIds = [
    ...new Set(
      (data ?? [])
        .flatMap((f) => [
          f.subject_table === 'person' ? (f.subject_id as string) : null,
          f.related_id as string | null,
        ])
        .filter(Boolean) as string[],
    ),
  ];

  const names = new Map<string, string>();
  if (personIds.length) {
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', personIds);
    for (const p of people ?? []) {
      names.set(
        p.id as string,
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
          (p.email as string) ||
          (p.id as string).slice(0, 8),
      );
    }
  }

  return c.json({
    items: (data ?? []).map((f) => ({
      ...f,
      subject_name: names.get(f.subject_id as string) ?? null,
      related_name: f.related_id ? (names.get(f.related_id as string) ?? null) : null,
    })),
  });
});

const ActBody = z.object({ action: z.enum(['accept', 'dismiss']) });

/**
 * Accept or dismiss one finding.
 *
 * **Accept does not mean "apply".** For `duplicate_person` it would mean
 * merging two people, which is a real, consequential operation with its own
 * reversible implementation (`merge_person()`), its own confirmation and its
 * own view of which record survives. Wiring it behind a one-tap accept in a
 * cleanup list would be the most dangerous button in the product.
 *
 * So accept records the JUDGEMENT — somebody looked and agreed this is real —
 * and the finding leaves the open queue. Doing the thing stays where it
 * belongs. Dismiss records the opposite, and the sweep's unique index means a
 * dismissed finding is never raised again.
 */
connectionsHygieneRoutes.post('/hygiene/:id', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const id = c.req.param('id');
  const parsed = ActBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);

  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('hygiene_finding')
    .update({
      status: parsed.data.action === 'accept' ? 'accepted' : 'dismissed',
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.userId || null,
    })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id');
  if (error) return c.json({ error: error.message }, 403);
  // RLS refusing a non-admin looks like zero rows, not like an error.
  if (!data?.length) return c.json({ error: 'not found or not allowed' }, 403);

  return c.json({ ok: true });
});
