import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { resolvePerson, normaliseEmail } from '../lib/resolve-person.js';
import { callerWorkspaceRole, isAdminRole } from '../lib/workspace-roles.js';
import { orIlike } from '../lib/postgrest-filter.js';
import { ContactPointInput, cleanContactPoints, pairOrder, normaliseContactValue, CONTACT_LABELS } from '../lib/contact-points.js';

export const personsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

personsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('person')
    .select('id, first_name, last_name, email, country, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  if (q) query = query.or(orIlike(['first_name', 'last_name', 'email'], q));

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({
    items,
    next: hasMore ? items[items.length - 1]?.id : null,
  });
});

const PersonCreate = z.object({
  first_name: z.string().min(1).max(100),
  // OPTIONAL since 2026-09-22, both of them. A person you met at a festival
  // has a name and no address, and until now this route refused to record
  // them at all — so Connect could not answer "who was in the room" for any
  // meeting whose people are not already on file. Sjoerd: *"when typing...,
  // can I add people if they are not there?"*
  //
  // The table has allowed it since the first migration; every column on
  // `person` is nullable. This was the API being stricter than the domain.
  //
  // WIDENING, never narrowing: a caller sending all three is unaffected, and
  // /api/v1/apps/* is additive-only (hard rule 8). The duplicate check below
  // already skips when there is no address to check.
  //
  // What it costs, stated: an address is the only thing two records can be
  // matched on, so a person with none cannot be deduplicated. That is why the
  // interface searches before it offers to create, and why this is a
  // deliberate press rather than anything automatic.
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  preferred_name: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  // Full intake from moment one (Sjoerd, 2026-09-05: invoiced members need
  // phone/address/VAT when they are CREATED, not on a later edit).
  phone: z.string().max(50).optional(),
  street: z.string().max(200).optional(),
  postal_code: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  // Labels for the two addresses given at creation (20260915090000). Not
  // person columns — they land on the synced contact points below.
  email_label: z.enum(CONTACT_LABELS).optional(),
  phone_label: z.enum(CONTACT_LABELS).optional(),
});

personsRoutes.post('/', async (c) => {
  const body = PersonCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');

  // Create via adminClient with explicit workspace scoping — the platform
  // pattern for contact creation (Meet/Thread enrolment does the same).
  // Insert-through-RLS kept failing here even after the 20260708150000
  // policy split (RLS violated on the returning read); the middleware
  // already guarantees the caller is a member of ctx.workspaceId.
  // Typing a contact in is a deliberate act, so this path still creates even
  // when the address is already on file — two real people can share one
  // (a couple, an info@ mailbox). But it says so, and the UI can offer the
  // existing record instead. Propose, don't block.
  const normalisedEmail = normaliseEmail(body.data.email as string | null | undefined);
  let duplicateOf: string | null = null;
  if (normalisedEmail) {
    const existing = await resolvePerson({
      workspaceId: ctx.workspaceId,
      email: normalisedEmail,
      source: 'manual',
      create: false,
    });
    if (existing.ok) {
      duplicateOf = existing.personId;
      console.warn('[persons POST] address already on file', {
        workspace_id: ctx.workspaceId,
        matches: existing.matches,
      });
    }
  }

  const { email_label: emailLabel, phone_label: phoneLabel, ...personFields } = body.data;
  const { data, error } = await adminClient
    .from('person')
    .insert({
      ...personFields,
      ...(normalisedEmail ? { email: normalisedEmail } : {}),
      workspace_id: ctx.workspaceId,
      created_via: 'manual',
    })
    .select('id, first_name, last_name, email, country, created_at')
    .single();

  if (error) {
    console.error('[persons POST] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code }, 500);
  }

  // The sync trigger made the contact points; give them their labels.
  for (const [kind, label, raw] of [
    ['email', emailLabel, data.email],
    ['phone', phoneLabel, personFields.phone],
  ] as const) {
    const value = normaliseContactValue(kind, raw as string | null | undefined);
    if (!label || !value) continue;
    await adminClient
      .from('person_contact_point')
      .update({ label })
      .eq('person_id', data.id)
      .eq('kind', kind)
      .eq('value', value);
  }

  // ---------------------------------------------------------------------
  // Verified-domain auto-attribution.
  //
  // If the new person's email domain matches a *verified* organisation
  // in this workspace, snap them to that org with an org_membership
  // row. Verified = domain_verified_at IS NOT NULL — i.e. someone
  // proved ownership of the domain via DNS challenge (v0.13.14).
  //
  // Why this is safe:
  //  - The org owner had to actively verify the domain via TXT record.
  //    Unverified domains are ignored, so a typoed/squatted org domain
  //    can't auto-attribute strangers.
  //  - Brand-new person → no existing primary org → we can mark this
  //    new membership as primary without conflict.
  //  - An activity row makes the auto-link auditable; the user can
  //    end the membership manually if it's wrong.
  //
  // Non-fatal: any failure here is logged and swallowed; the person
  // create itself stays successful.
  // ---------------------------------------------------------------------
  const db = userClient(ctx.jwt);
  let autoLinkedOrgId: string | null = null;
  let autoLinkedOrgName: string | null = null;
  try {
    const at = (data.email ?? '').lastIndexOf('@');
    const domain = at >= 0 ? data.email!.slice(at + 1).toLowerCase().trim() : '';
    if (domain) {
      const { data: org } = await db
        .from('organisation')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .ilike('domain', domain)
        .not('domain_verified_at', 'is', null)
        .is('deleted_at', null)
        .maybeSingle();
      if (org) {
        const { error: memErr } = await db
          .from('org_membership')
          .insert({
            person_id: data.id,
            org_id: org.id,
            is_primary: true,
            started_at: new Date().toISOString().slice(0, 10),
          });
        if (memErr) {
          console.warn('[person-create auto-link] insert failed', memErr);
        } else {
          autoLinkedOrgId = org.id;
          autoLinkedOrgName = org.name;
        }
      }
    }
  } catch (e) {
    console.warn('[person-create auto-link] error', (e as Error).message);
  }

  // Write a platform activity event. Non-fatal if it fails. When
  // auto-attribution happened, the subject line says so — useful when
  // auditing where a contact's org link came from.
  const { data: platformApp } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (platformApp) {
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email;
    const subject = autoLinkedOrgName
      ? `Added ${name} to the workspace · auto-linked to ${autoLinkedOrgName} (verified domain)`
      : `Added ${name} to the workspace`;
    await db.from('activity').insert({
      workspace_id: ctx.workspaceId,
      person_id: data.id,
      app_id: platformApp.id,
      type: 'user_created',
      subject,
      created_by: ctx.userId,
    });
  }

  return c.json(
    // duplicate_of: an existing person already holds this address. Additive,
    // advisory, and never a refusal — the caller decides whether to keep both.
    { ...data, auto_linked_org_id: autoLinkedOrgId, duplicate_of: duplicateOf },
    201,
  );
});

// ---------------------------------------------------------------------------
// Duplicates: find them, merge them, undo the merge.
//
// Registered BEFORE /:id — Hono matches in registration order, so a literal
// segment declared after a parameter one is unreachable.
//
// Admin-gated throughout. Merging rewrites who owns an enrolment, a booking,
// a payment and a certificate; that is not an organiser-level act.
// ---------------------------------------------------------------------------

async function isWorkspaceAdmin(ctx: { userId: string; workspaceId: string }) {
  return isAdminRole(await callerWorkspaceRole(ctx));
}

const ADMINS_ONLY = { error: 'admins only' } as const;

/** Are BOTH ids live persons of this workspace? The service-role RPCs below
 *  do not know who is asking, so the route has to. */
async function bothInWorkspace(workspaceId: string, a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const { count, error } = await adminClient
    .from('person')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('id', [a, b]);
  if (error) throw new Error(`person lookup failed: ${error.message}`);
  return count === 2;
}

/**
 * A person id plus anyone merged into them. Merges deliberately do NOT
 * repoint activity — it is append-only — so every read of a person's history
 * has to expand through merged_into or the history vanishes the moment a
 * duplicate is tidied away.
 */
async function personAndMerged(personId: string): Promise<string[]> {
  const { data, error } = await adminClient.rpc('person_and_merged', { p_person: personId });
  if (error || !data) return [personId];
  const rows = data as unknown as (string | { person_and_merged: string })[];
  const ids = rows.map((x) => (typeof x === 'string' ? x : x.person_and_merged)).filter(Boolean);
  return ids.length ? ids : [personId];
}



const DuplicatesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // Trigram threshold for the similar_name rule. Lower finds more and is
  // noisier; this is the knob to turn if the queue is empty or unusable.
  threshold: z.coerce.number().min(0.1).max(1).default(0.55),
});

// GET /persons/duplicates — the review queue. Proposes; never acts.
personsRoutes.get('/duplicates', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const parsed = DuplicatesQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { data, error } = await adminClient.rpc('person_duplicate_candidates', {
    p_workspace: ctx.workspaceId,
    p_limit: parsed.data.limit,
    p_threshold: parsed.data.threshold,
  });
  if (error) {
    console.error('[persons/duplicates] rpc failed', error);
    return c.json({ error: error.message }, 500);
  }

  // A pair somebody already answered is not asked again: "different people"
  // is a dismissed finding, "same person" an accepted one. The nightly sweep
  // and this page read the same rows (proposal §D).
  const { data: answered } = await adminClient
    .from('hygiene_finding')
    .select('subject_id, related_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('kind', 'duplicate_person')
    .in('status', ['dismissed', 'accepted']);
  const done = new Set((answered ?? []).map((r) => pairOrder(r.subject_id as string, r.related_id as string).join(':')));

  const pairs = ((data ?? []) as { person_a: string; person_b: string; reason: string; score: number }[])
    .filter((p) => !done.has(pairOrder(p.person_a, p.person_b).join(':')));
  const ids = [...new Set(pairs.flatMap((p) => [p.person_a, p.person_b]))];
  const [{ data: people }, { data: points }, { data: orgs }] = ids.length
    ? await Promise.all([
        adminClient
          .from('person')
          .select('id, first_name, last_name, email, city, country, created_at, created_via')
          .in('id', ids),
        adminClient
          .from('person_contact_point')
          .select('person_id, kind, value, label, is_primary')
          .in('person_id', ids),
        adminClient
          .from('org_membership')
          .select('person_id, ended_at, organisation:org_id (name)')
          .in('person_id', ids)
          .is('ended_at', null),
      ])
    : [{ data: [] as Record<string, unknown>[] }, { data: [] as Record<string, unknown>[] }, { data: [] as Record<string, unknown>[] }];
  const byId = new Map(
    (people ?? []).map((p) => [
      p.id as string,
      {
        ...p,
        contact_points: (points ?? []).filter((x) => x.person_id === p.id),
        organisations: (orgs ?? [])
          .filter((x) => x.person_id === p.id)
          .map((x) => (x.organisation as unknown as { name: string } | null)?.name)
          .filter(Boolean),
      },
    ]),
  );

  return c.json({
    items: pairs.map((p) => ({
      reason: p.reason,
      score: p.score,
      a: byId.get(p.person_a) ?? { id: p.person_a },
      b: byId.get(p.person_b) ?? { id: p.person_b },
    })),
  });
});

const PairBody = z.object({
  a_id: z.string().uuid(),
  b_id: z.string().uuid(),
});

/** Record the answer to "same person, or two?" on the shared review queue. */
async function answerPair(
  ctx: { userId: string; workspaceId: string },
  a: string,
  b: string,
  status: 'dismissed' | 'accepted',
) {
  const [subject, related] = pairOrder(a, b);
  return adminClient.from('hygiene_finding').upsert(
    {
      workspace_id: ctx.workspaceId,
      kind: 'duplicate_person',
      subject_table: 'person',
      subject_id: subject,
      related_id: related,
      status,
      evidence: { answer: status === 'dismissed' ? 'different_people' : 'same_person' },
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.userId || null,
    },
    { onConflict: 'workspace_id,kind,subject_id,related_id' },
  );
}

// POST /persons/duplicates/distinct — "No, these are different people with
// the same name." Remembered; the pair is never proposed again.
personsRoutes.post('/duplicates/distinct', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);
  const body = PairBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { count } = await adminClient
    .from('person')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .in('id', [body.data.a_id, body.data.b_id]);
  if (count !== 2) return c.json({ error: 'person not found' }, 404);
  const { error } = await answerPair(ctx, body.data.a_id, body.data.b_id, 'dismissed');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

const MergeBody = z.object({
  keep_id: z.string().uuid(),
  merge_id: z.string().uuid(),
});

// POST /persons/merge — repoints every FK, soft-deletes the merged row.
// Returns the audit id, which is the handle for undoing it.
personsRoutes.post('/merge', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const body = MergeBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  // Both persons must be in the CALLER's workspace. merge_person only checks
  // that the two share *a* workspace, and the RPC runs as the service role,
  // so without this an admin of any workspace could merge — and, since
  // 20260925053333, copy the personal data between — two persons of another
  // workspace by id. Same shape as /duplicates/distinct above. (Stress round
  // 2026-09-25.)
  if (!(await bothInWorkspace(ctx.workspaceId, body.data.keep_id, body.data.merge_id))) {
    return c.json({ error: 'person not found' }, 404);
  }

  const { data, error } = await adminClient.rpc('merge_person', {
    p_keep: body.data.keep_id,
    p_merge: body.data.merge_id,
    p_actor: ctx.userId || null,
  });
  if (error) {
    console.error('[persons/merge] failed', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    // The function raises for the refusals a caller can act on — same
    // workspace, not already deleted, not two sign-in accounts — so pass the
    // wording through rather than flattening them all to 500.
    return c.json({ error: error.message }, 400);
  }
  // The merged person's addresses arrived still flagged primary.
  await adminClient.rpc('person_contact_point_remark', { p_person: body.data.keep_id });
  await answerPair(ctx, body.data.keep_id, body.data.merge_id, 'accepted');
  return c.json({ merge_id: data as string }, 201);
});

// POST /persons/merges/:id/undo — put it back.
personsRoutes.post('/merges/:id/undo', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  // The merge row has to be this workspace's BEFORE the RPC runs: the lookup
  // further down only guards the post-processing, and unmerge_person, as the
  // service role, would happily put back another workspace's merge.
  const { count: owned } = await adminClient
    .from('person_merge')
    .select('id', { count: 'exact', head: true })
    .eq('id', c.req.param('id'))
    .eq('workspace_id', ctx.workspaceId);
  if (owned !== 1) return c.json({ error: 'merge not found' }, 404);

  const { error } = await adminClient.rpc('unmerge_person', {
    p_merge_id: c.req.param('id'),
    p_actor: ctx.userId || null,
  });
  if (error) {
    console.error('[persons/merges/undo] failed', error);
    return c.json({ error: error.message }, 400);
  }
  const { data: m } = await adminClient
    .from('person_merge')
    .select('kept_person_id, merged_person_id')
    .eq('id', c.req.param('id'))
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (m) {
    await Promise.all([
      adminClient.rpc('person_contact_point_remark', { p_person: m.kept_person_id }),
      adminClient.rpc('person_contact_point_remark', { p_person: m.merged_person_id }),
    ]);
    // Undone means unanswered again: back into the queue.
    const [subject, related] = pairOrder(m.kept_person_id as string, m.merged_person_id as string);
    await adminClient
      .from('hygiene_finding')
      .update({ status: 'open', resolved_at: null, resolved_by: null })
      .eq('workspace_id', ctx.workspaceId)
      .eq('kind', 'duplicate_person')
      .eq('subject_id', subject)
      .eq('related_id', related);
  }
  return c.json({ ok: true });
});

// GET /persons/merges — what has been merged, and what can still be undone.
personsRoutes.get('/merges', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const { data, error } = await adminClient
    .from('person_merge')
    .select('id, kept_person_id, merged_person_id, merged_at, merged_by, undone_at, dropped')
    .eq('workspace_id', ctx.workspaceId)
    .order('merged_at', { ascending: false })
    .limit(100);
  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    items: (data ?? []).map((m) => ({
      id: m.id,
      kept_person_id: m.kept_person_id,
      merged_person_id: m.merged_person_id,
      merged_at: m.merged_at,
      merged_by: m.merged_by,
      undone_at: m.undone_at,
      // How much a merge actually cost: rows a unique constraint would not
      // let move. Surfaced so nobody has to guess what was lost.
      dropped_rows: Array.isArray(m.dropped)
        ? (m.dropped as { rows?: unknown[] }[]).reduce(
            (n, d) => n + (Array.isArray(d.rows) ? d.rows.length : 0),
            0,
          )
        : 0,
    })),
  });
});

personsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('person')
    .select('*')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  const { data: points } = await db
    .from('person_contact_point')
    .select('id, kind, value, label, org_id, is_primary, verified_at, organisation:org_id (id, name)')
    .eq('person_id', data.id)
    .order('kind')
    .order('is_primary', { ascending: false })
    .order('created_at');
  return c.json({ ...data, contact_points: points ?? [] });
});

// PUT /persons/:id/contact-points — the whole list, as the editor holds it.
// Rows not in the list are removed, the rest upserted, and person.email /
// person.phone set to the primaries so every older reader stays right.
personsRoutes.put('/:id/contact-points', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  const body = z.object({ items: z.array(ContactPointInput).max(20) }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const cleaned = cleanContactPoints(body.data.items);
  if (!cleaned.ok) return c.json({ error: cleaned.error }, 400);

  // Visible to the caller (RLS), in this workspace, not deleted.
  const { data: person } = await db
    .from('person')
    .select('id, workspace_id')
    .eq('id', personId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!person) return c.json({ error: 'person not found' }, 404);

  const orgIds = [...new Set(cleaned.points.map((p) => p.org_id).filter(Boolean))] as string[];
  if (orgIds.length) {
    const { count } = await adminClient
      .from('organisation')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', person.workspace_id)
      .in('id', orgIds);
    if (count !== orgIds.length) return c.json({ error: 'unknown organisation' }, 400);
  }

  const { data: existing } = await adminClient
    .from('person_contact_point')
    .select('id, kind, value')
    .eq('person_id', personId);
  const keep = new Set(cleaned.points.map((p) => `${p.kind}:${p.value}`));
  const gone = (existing ?? []).filter((r) => !keep.has(`${r.kind}:${r.value}`)).map((r) => r.id as string);

  const { error: upErr } = await adminClient.from('person_contact_point').upsert(
    cleaned.points.map((p) => ({ ...p, person_id: personId, workspace_id: person.workspace_id })),
    { onConflict: 'person_id,kind,value' },
  );
  if (upErr) return c.json({ error: upErr.message }, 500);
  if (gone.length) {
    const { error: delErr } = await adminClient.from('person_contact_point').delete().in('id', gone);
    if (delErr) return c.json({ error: delErr.message }, 500);
  }

  // Primaries onto the person; the trigger would re-add a removed address if
  // it were still in email_secondary/phone_secondary, so those clear — the
  // table is where secondary addresses live now.
  const { error: pErr } = await adminClient
    .from('person')
    .update({
      email: cleaned.primaryEmail,
      phone: cleaned.primaryPhone,
      email_secondary: null,
      phone_secondary: null,
    })
    .eq('id', personId);
  if (pErr) return c.json({ error: pErr.message }, 500);
  await adminClient.rpc('person_contact_point_remark', { p_person: personId });

  const { data: points } = await db
    .from('person_contact_point')
    .select('id, kind, value, label, org_id, is_primary, verified_at, organisation:org_id (id, name)')
    .eq('person_id', personId)
    .order('kind')
    .order('is_primary', { ascending: false })
    .order('created_at');
  return c.json({ items: points ?? [] });
});

// GET /api/v1/persons/:id/memberships
// Platform-owned "where does this person belong" view:
//   - org_memberships  (which organisations + title/role/seniority)
//   - workspace_member (their role in this workspace, if they have a user
//     account here)
//   - app_memberships  (which apps they hold a seat for — empty for
//     non-user contacts)
// All visible to any workspace member; orgs + workspaces are platform-level
// contact-graph edges per brief §2 ("platform owns the edges").
personsRoutes.get('/:id/memberships', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Person + user_id linkage (a user record represents the same human when
  // they hold a Fibre account — meet_host, app_memberships etc. all live
  // under user.id, not person.id).
  const { data: person, error: pErr } = await db
    .from('person')
    .select('id, user_id, email')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) return c.json({ error: 'person not found' }, 404);

  // Current + historical org memberships.
  const { data: orgRows } = await db
    .from('org_membership')
    .select(
      'id, title, department, seniority_level, employment_type, is_primary, is_decision_maker, is_budget_holder, is_champion, started_at, ended_at, organisation:org_id (id, name, short_name, domain)',
    )
    .eq('person_id', personId)
    .order('is_primary', { ascending: false })
    .order('started_at', { ascending: false, nullsFirst: false });

  let workspaceMember:
    | {
        workspace_id: string;
        // The role tiers since 20260704090000; 'member' has not existed
        // since then and this type said it did for three months.
        workspace_role: 'super_admin' | 'admin' | 'organiser';
        relationship_type: 'internal' | 'external';
        joined_at: string;
        workspace: { id: string; name: string; slug: string } | null;
      }
    | null = null;
  let appMemberships: { app: { slug: string; name: string }; role: string }[] = [];

  if (person.user_id) {
    const { data: wm } = await db
      .from('workspace_member')
      .select(
        'workspace_id, workspace_role, relationship_type, joined_at, workspace:workspace_id (id, name, slug)',
      )
      .eq('user_id', person.user_id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (wm) {
      const ws = Array.isArray(wm.workspace) ? wm.workspace[0] : wm.workspace;
      workspaceMember = {
        workspace_id: wm.workspace_id,
        workspace_role: wm.workspace_role,
        relationship_type: wm.relationship_type,
        joined_at: wm.joined_at,
        workspace: ws ?? null,
      };
    }
    // Only list apps the workspace has activated (workspace_app row with
    // deactivated_at IS NULL). A leftover app_membership from before an
    // app was deactivated is not "access" today — it's dormant. Without
    // this filter the profile contradicts /settings/apps.
    const { data: activeApps } = await db
      .from('workspace_app')
      .select('app_id')
      .eq('workspace_id', ctx.workspaceId)
      .is('deactivated_at', null);
    const activeAppIds = new Set((activeApps ?? []).map((r) => r.app_id as string));

    const { data: ams } = await db
      .from('app_membership')
      .select('app_id, role, app:app_id (slug, name)')
      .eq('user_id', person.user_id);
    appMemberships = (ams ?? [])
      .filter((r) => {
        // fibre-platform is The Fibre itself — always present, even though
        // there's no workspace_app row for it (matches /api/v1/auth/me).
        const appRow = Array.isArray(r.app) ? r.app[0] : r.app;
        if (appRow?.slug === 'fibre-platform') return true;
        return activeAppIds.has(r.app_id as string);
      })
      .map((r) => ({
        app: Array.isArray(r.app) ? r.app[0]! : r.app!,
        role: r.role,
      }));
  }

  return c.json({
    org_memberships: orgRows ?? [],
    workspace_member: workspaceMember,
    app_memberships: appMemberships,
    has_account: !!person.user_id,
  });
});

const PersonUpdate = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  preferred_name: z.string().max(100).nullable().optional(),
  pronouns: z.string().max(50).nullable().optional(),
  email: z.string().email().optional(),
  email_secondary: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  // Accept any string; display layer prepends https:// if needed.
  linkedin_url: z.string().max(500).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  preferred_language: z.string().max(10).nullable().optional(),
});

personsRoutes.patch('/:id', async (c) => {
  const body = PersonUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('person')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

personsRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Soft delete only — brief §13.3.
  const { error } = await db
    .from('person')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .is('deleted_at', null);

  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ============================================================================
// Profile sub-resources — one row per person each.
// All four use the same upsert-on-PATCH pattern: if no row exists, create one;
// otherwise update. GET returns the row or null.
// ============================================================================

async function upsertProfile<T extends Record<string, unknown>>(
  c: import('hono').Context,
  table: string,
  appSlug: string,
  body: T,
) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Confirm the person exists in this workspace.
  const { data: person, error: pErr } = await db
    .from('person')
    .select('id')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) {
    console.error('[upsertProfile] person not found', { table, personId, pErr });
    return c.json({ error: 'person not found' }, 404);
  }

  // Resolve the owning app's uuid. Required since v0.4 — the row must declare
  // who owns it. RLS checks the user has membership for that app.
  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', appSlug)
    .single();
  if (aErr || !app) {
    console.error('[upsertProfile] app not found', { table, appSlug, aErr });
    return c.json({ error: `app not found: ${appSlug}` }, 500);
  }

  const { data, error } = await db
    .from(table)
    .upsert({ person_id: personId, app_id: app.id, ...body }, { onConflict: 'person_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[upsertProfile] upsert failed', { table, personId, appSlug, body, error });
    return c.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, 500);
  }
  return c.json(data);
}

async function getProfile(c: import('hono').Context, table: string) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('person_id', c.req.param('id'))
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? null);
}

// --- person_professional ---------------------------------------------------
const SENIORITY = ['junior', 'mid', 'senior', 'lead', 'executive', 'board'] as const;
const CAREER_STAGE = ['early', 'established', 'senior', 'transitioning', 'portfolio'] as const;

const ProfessionalUpdate = z.object({
  current_title: z.string().max(200).nullable().optional(),
  current_department: z.string().max(200).nullable().optional(),
  seniority_level: z.enum(SENIORITY).nullable().optional(),
  sector: z.string().max(200).nullable().optional(),
  expertise_areas: z.array(z.string().max(100)).nullable().optional(),
  industries_worked_in: z.array(z.string().max(100)).nullable().optional(),
  years_of_experience: z.number().int().min(0).max(80).nullable().optional(),
  career_stage: z.enum(CAREER_STAGE).nullable().optional(),
  is_independent: z.boolean().nullable().optional(),
  certifications: z.array(z.string().max(200)).nullable().optional(),
  spoken_at_events: z.array(z.string().max(200)).nullable().optional(),
});

personsRoutes.get('/:id/professional', (c) => getProfile(c, 'person_professional'));
personsRoutes.patch('/:id/professional', async (c) => {
  const body = ProfessionalUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_professional', 'fibre-platform', body.data);
});

// --- person_relationship_context -------------------------------------------
const REL_SOURCE = ['event_attendee', 'referral', 'cold_outreach', 'client_contact', 'inbound'] as const;
const REL_STRENGTH = ['weak', 'warm', 'strong', 'advocate'] as const;
const REL_COMM = ['email', 'phone', 'linkedin', 'in_person'] as const;

const RelationshipUpdate = z.object({
  source: z.enum(REL_SOURCE).nullable().optional(),
  source_detail: z.string().max(500).nullable().optional(),
  introduced_by: z.string().uuid().nullable().optional(),
  /** The company you met them through, for source = client_contact. An id,
   *  never a name — see the migration header. */
  via_organisation_id: z.string().uuid().nullable().optional(),
  relationship_strength: z.enum(REL_STRENGTH).nullable().optional(),
  communication_preference: z.enum(REL_COMM).nullable().optional(),
  best_time_to_reach: z.string().max(200).nullable().optional(),
  is_key_contact: z.boolean().nullable().optional(),
  is_ambassador: z.boolean().nullable().optional(),
  first_contact_notes: z.string().max(2000).nullable().optional(),
  first_contact_at: z.string().datetime().nullable().optional(),
});

personsRoutes.get('/:id/relationship', (c) => getProfile(c, 'person_relationship_context'));
personsRoutes.patch('/:id/relationship', async (c) => {
  const body = RelationshipUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_relationship_context', 'fibre-sales', body.data);
});

// --- person_change_context (facilitator_notes is sensitive — brief §5.D2) --
const CHANGE_ROLE = ['sponsor', 'champion', 'implementer', 'sceptic', 'bystander', 'gatekeeper'] as const;
const CHANGE_STANCE = ['driving', 'supporting', 'ambivalent', 'resistant'] as const;
const READINESS = ['not_ready', 'cautious', 'open', 'ready', 'driving'] as const;

const ChangeUpdate = z.object({
  role_in_change: z.enum(CHANGE_ROLE).nullable().optional(),
  stance_on_change: z.enum(CHANGE_STANCE).nullable().optional(),
  change_themes: z.array(z.string().max(100)).nullable().optional(),
  leadership_style: z.string().max(200).nullable().optional(),
  blockers: z.array(z.string().max(200)).nullable().optional(),
  motivators: z.array(z.string().max(200)).nullable().optional(),
  current_challenge: z.string().max(2000).nullable().optional(),
  facilitator_notes: z.string().max(5000).nullable().optional(),
  readiness_level: z.enum(READINESS).nullable().optional(),
});

personsRoutes.get('/:id/change', (c) => getProfile(c, 'person_change_context'));
personsRoutes.patch('/:id/change', async (c) => {
  const body = ChangeUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  return upsertProfile(c, 'person_change_context', 'fibre-meet', {
    ...body.data,
    notes_updated_at: new Date().toISOString(),
    notes_updated_by: ctx.userId,
  });
});

// --- person_meet_profile — what Meet actually justifies on a person -------
// Replaces the change-facilitation fields on the contact's Fibre Meet tab.
// GET returns the profile + the person's upcoming + past meet_bookings so
// the platform's contact page can show the full Meet picture in one fetch.
const MeetProfileUpdate = z.object({
  host_notes: z.string().max(5000).nullable().optional(),
  vip: z.boolean().optional(),
  blocked: z.boolean().optional(),
  invitee_timezone: z.string().max(100).nullable().optional(),
});

personsRoutes.get('/:id/meet', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  const { data: person, error: pErr } = await db
    .from('person')
    .select('id, email')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) return c.json({ error: 'person not found' }, 404);

  // Profile row — may not exist yet for a new contact.
  const { data: profile } = await db
    .from('person_meet_profile')
    .select('host_notes, vip, blocked, invitee_timezone, updated_at')
    .eq('person_id', personId)
    .maybeSingle();

  // Bookings the person has been an invitee on. Use email to match — that's
  // the join key Meet uses on the booking side (a single canonical contact
  // may have multiple aliased invitee_emails over time; v1 ignores that).
  const nowIso = new Date().toISOString();
  const baseSelect =
    'id, starts_at, ends_at, status, meet_url, alternative_location, meeting_type:meeting_type_id (id, name, slug, host:host_id (slug, user:user_id (full_name)))';
  const { data: upcoming } = await db
    .from('meet_booking')
    .select(baseSelect)
    .eq('invitee_email', person.email ?? '')
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(50);
  const { data: past } = await db
    .from('meet_booking')
    .select(baseSelect)
    .eq('invitee_email', person.email ?? '')
    .lt('ends_at', nowIso)
    .order('starts_at', { ascending: false })
    .limit(50);

  return c.json({
    profile: profile ?? null,
    upcoming_bookings: upcoming ?? [],
    past_bookings: past ?? [],
  });
});

personsRoutes.patch('/:id/meet', async (c) => {
  const body = MeetProfileUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  const { data: person, error: pErr } = await db
    .from('person')
    .select('id, workspace_id')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) return c.json({ error: 'person not found' }, 404);

  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  if (aErr || !app) return c.json({ error: 'fibre-meet app not found' }, 500);

  const { data, error } = await db
    .from('person_meet_profile')
    .upsert(
      {
        workspace_id: person.workspace_id,
        person_id: personId,
        app_id: app.id,
        ...body.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,person_id' },
    )
    .select('*')
    .single();
  if (error) {
    console.error('[persons/meet PATCH] upsert failed', {
      personId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code, details: error.details }, 500);
  }
  return c.json(data);
});

// --- person_learning -------------------------------------------------------
const LEARNING_STYLE = ['visual', 'auditory', 'reading', 'kinaesthetic', 'reflective'] as const;
const GROUP_ROLE = ['connector', 'challenger', 'synthesiser', 'anchor', 'observer'] as const;

const LearningUpdate = z.object({
  learning_interests: z.array(z.string().max(100)).nullable().optional(),
  prior_programmes: z.array(z.string().max(200)).nullable().optional(),
  learning_style: z.enum(LEARNING_STYLE).nullable().optional(),
  group_role_tendency: z.enum(GROUP_ROLE).nullable().optional(),
  development_goals: z.string().max(2000).nullable().optional(),
  post_programme_reflection: z.string().max(5000).nullable().optional(),
  open_to_coaching: z.boolean().nullable().optional(),
  open_to_peer_exchange: z.boolean().nullable().optional(),
});

personsRoutes.get('/:id/learning', (c) => getProfile(c, 'person_learning'));

// --- person_billing (fibre-sales) ------------------------------------------
const BillingUpdate = z.object({
  legal_name: z.string().max(200).nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  billing_email: z.string().email().nullable().optional(),
  billing_street: z.string().max(200).nullable().optional(),
  billing_postal_code: z.string().max(20).nullable().optional(),
  billing_city: z.string().max(100).nullable().optional(),
  billing_region: z.string().max(100).nullable().optional(),
  billing_country: z.string().length(2).nullable().optional(),
  payment_terms_days: z.number().int().min(0).max(365).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  po_required: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

personsRoutes.get('/:id/billing', (c) => getProfile(c, 'person_billing'));
personsRoutes.patch('/:id/billing', async (c) => {
  const body = BillingUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_billing', c.get('ctx').appId, {
    ...body.data,
    updated_at: new Date().toISOString(),
  });
});

// Apps-discovery: which apps have any data on this person?
// Union of: (a) any curator-profile row exists, (b) any activity event written
// for this person by that app. Returns a list of app slugs in stable order.
personsRoutes.get('/:id/apps', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Apps with curator-profile rows (these are RLS-gated, so we'll only see ones
  // the caller has membership for).
  const [profQ, relQ, chgQ, lrnQ, billQ, meetProfQ, actQ] = await Promise.all([
    db.from('person_professional').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_relationship_context').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_change_context').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_learning').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_billing').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_meet_profile').select('app:app_id (slug)').eq('person_id', personId),
    db.from('activity').select('app:app_id (slug)').in('person_id', await personAndMerged(personId)),
  ]);

  const slugs = new Set<string>();
  for (const q of [profQ, relQ, chgQ, lrnQ, billQ, meetProfQ, actQ]) {
    for (const row of (q.data ?? []) as unknown as { app: { slug?: string } | { slug?: string }[] | null }[]) {
      const app = Array.isArray(row.app) ? row.app[0] : row.app;
      if (app?.slug) slugs.add(app.slug);
    }
  }

  // Meet also surfaces when the person has been a booking invitee even
  // without curator data. Match on email to mirror the contact-list rule.
  const { data: person } = await db
    .from('person')
    .select('email')
    .eq('id', personId)
    .maybeSingle();
  if (person?.email) {
    const { count } = await db
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_email', person.email);
    if ((count ?? 0) > 0) slugs.add('fibre-meet');
  }

  // Membership's curator data IS the member row (no separate profile table —
  // tier/status/renewal live on membership_member). RLS-gated like the rest:
  // callers without the app see nothing, so no slug appears.
  const { count: memberCount } = await db
    .from('membership_member')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', personId);
  if ((memberCount ?? 0) > 0) slugs.add('membership');

  return c.json({ apps: Array.from(slugs).sort() });
});
// Membership tab data — bespoke like /:id/meet: the curator data is the
// member row itself (tier, status, renewal), not an upsertProfile table.
// Writes stay on the membership routes; this is the profile-tab read.
personsRoutes.get('/:id/membership', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_member')
    .select(
      'id, status, started_at, renews_at, lapsed_at, notes, tier:tier_id (id, name, price_cents_year, price_cents_month, currency)',
    )
    .eq('person_id', c.req.param('id'))
    .maybeSingle();
  if (error) {
    console.error('[persons GET membership]', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ member: data ?? null });
});

personsRoutes.patch('/:id/learning', async (c) => {
  const body = LearningUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_learning', 'fibre-learn', body.data);
});
