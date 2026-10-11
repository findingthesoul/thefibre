import { Hono } from 'hono';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { userClient, adminClient } from '../db.js';
import { orIlike } from '../lib/postgrest-filter.js';
import { rows } from '../lib/rows.js';
import { callerWorkspaceRole, isAdminRole } from '../lib/workspace-roles.js';


/**
 * The search term, stripped the same way search_names is stored
 * (20260914191000): no accents, no apostrophes, lower-case. The two sides
 * must agree or a match fails silently — "bahai" found nothing in
 * "European Bahá'í Business Forum" until both did this.
 */
export function normaliseSearch(q: string): string {
  return (
    q
      .toLowerCase()
      // Letters NFD does not decompose but Postgres unaccent does rewrite.
      // Without these, "søren" typed would never meet "soren" stored.
      .replace(/ß/g, 'ss')
      .replace(/æ/g, 'ae')
      .replace(/œ/g, 'oe')
      .replace(/ø/g, 'o')
      .replace(/đ/g, 'd')
      .replace(/ł/g, 'l')
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .replace(/['’ʼ`]/g, '')
      .trim()
  );
}

export const organisationsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

organisationsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('organisation')
    .select('id, name, short_name, other_names, domain, country, sector, org_type, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  // search_names carries name, abbreviation, legal name, other names and
  // domain in one lower-cased string (trigger-maintained), so "ebbf" and the
  // name an organisation USED to have both find it.
  if (q) {
    const term = normaliseSearch(q);
    if (term) query = query.or(orIlike(['search_names'], term));
  }

  const [{ data, error }, ownId] = await Promise.all([query, workspaceOrganisationId(ctx.workspaceId)]);
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({
    items,
    next: hasMore ? items[items.length - 1]?.id : null,
    // The organisation this workspace IS (20260915060000). The list pins it
    // first; it is not reordered here because the cursor runs on id.
    workspace_organisation_id: ownId,
  });
});

/** The organisation the workspace itself is — null only before 20260915060000. */
async function workspaceOrganisationId(workspaceId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('workspace')
    .select('organisation_id')
    .eq('id', workspaceId)
    .maybeSingle();
  return (data?.organisation_id as string | null | undefined) ?? null;
}


// Trade names and former names (20260914190000). Trimmed, blanks dropped,
// duplicates removed case-insensitively, and never a copy of the current name
// — that is `name`, and repeating it here only adds noise to the card.
const OtherNames = z
  .array(z.string().max(200))
  .max(20)
  .transform((list) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
      const v = raw.trim();
      const key = v.toLowerCase();
      if (!v || seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  });

const OrgCreate = z.object({
  name: z.string().min(1).max(200),
  short_name: z.string().max(50).optional(),
  other_names: OtherNames.optional(),
  domain: z.string().max(255).optional(),
  country: z.string().length(2).optional(),
  sector: z.string().max(100).optional(),
  org_type: z.enum(['private', 'public', 'ngo', 'cooperative', 'government', 'education']).optional(),
  // Address + website at creation (Sjoerd, 2026-09-15: "No address").
  website: z.string().max(500).optional(),
  street: z.string().max(200).optional(),
  postal_code: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
});

organisationsRoutes.post('/', async (c) => {
  const body = OrgCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  // Create via adminClient with explicit workspace scoping — see the note
  // in persons.ts POST (same fix, 2026-07-08): insert-through-RLS failed
  // on the returning read even for admins; membership is guaranteed by
  // the middleware and reads stay RLS-gated.
  const { data, error } = await adminClient
    .from('organisation')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('*')
    .single();
  if (error) {
    console.error('[organisations POST] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code }, 500);
  }
  return c.json(data, 201);
});

// ---------------------------------------------------------------------------
// Duplicates: find them, merge them, undo the merge.
//
// The organisation half of the person routes above /persons/:id. Same gate,
// same tenancy check, same reasons — written here rather than shared because
// the two walk different tables, but the COMMENTS are deliberately the same
// so that the next person to add a third merge finds the warning twice.
//
// Registered BEFORE /:id — Hono matches in registration order, so a literal
// segment declared after a parameter one is unreachable: GET /duplicates
// would arrive as organisation id "duplicates" and answer 404 for a route
// that exists. Keep new literal segments above that line.
//
// Admin-gated throughout. Merging rewrites who owns a membership, a billing
// record and a verified domain; that is not an organiser-level act.
// ---------------------------------------------------------------------------

async function isWorkspaceAdmin(ctx: { userId: string; workspaceId: string }) {
  return isAdminRole(await callerWorkspaceRole(ctx));
}

const ADMINS_ONLY = { error: 'admins only' } as const;

/** Are BOTH ids live organisations of this workspace? The service-role RPCs
 *  below do not know who is asking, so the route has to.
 *
 *  This is the one function in this block worth reading twice.
 *  merge_organisation refuses only a merge ACROSS two workspaces, and it runs
 *  as the service role, so it cannot tell the caller's workspace from anybody
 *  else's: both ids are in one workspace, just not necessarily theirs. Without
 *  this check an admin of any workspace could merge — and, since
 *  20261011202050 copies content between them, read the content of — two
 *  organisations of another workspace by id. That exact hole was found in the
 *  person routes on 2026-09-25. */
async function bothOrgsInWorkspace(workspaceId: string, a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const { count, error } = await adminClient
    .from('organisation')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('id', [a, b]);
  if (error) throw new Error(`organisation lookup failed: ${error.message}`);
  return count === 2;
}

const OrgDuplicatesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// GET /organisations/duplicates — the review queue. Proposes; never acts.
organisationsRoutes.get('/duplicates', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const parsed = OrgDuplicatesQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { data, error } = await adminClient.rpc('organisation_duplicate_candidates', {
    p_workspace: ctx.workspaceId,
    p_limit: parsed.data.limit,
  });
  if (error) {
    console.error('[organisations/duplicates] rpc failed', error);
    return c.json({ error: error.message }, 500);
  }

  type Candidate = {
    a_id: string; a_name: string; a_domain: string | null; a_people: number;
    b_id: string; b_name: string; b_domain: string | null; b_people: number;
    reason: string; score: number;
  };
  const pairs = (data ?? []) as Candidate[];
  if (pairs.length === 0) return c.json({ items: [] });

  // The candidates function already carries name, domain and how many people
  // each side holds. These are the rest of the evidence somebody decides on —
  // one read for every organisation named, not one per pair. Thrown rather
  // than coalesced: a failed read here would draw both cards with no legal
  // name and no address, which is the comparison itself.
  const ids = [...new Set(pairs.flatMap((p) => [p.a_id, p.b_id]))];
  const extra = rows(
    'organisations/duplicates: compared fields',
    await adminClient
      .from('organisation')
      .select('id, legal_name, city, country, website, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .in('id', ids),
  );
  const byId = new Map(extra.map((o) => [o.id as string, o]));
  const side = (id: string, name: string, domain: string | null, people: number) => ({
    id,
    name,
    domain,
    people: Number(people),
    legal_name: byId.get(id)?.legal_name ?? null,
    city: byId.get(id)?.city ?? null,
    country: byId.get(id)?.country ?? null,
    website: byId.get(id)?.website ?? null,
    created_at: byId.get(id)?.created_at ?? null,
  });

  return c.json({
    items: pairs
      // A pair this workspace cannot see both halves of is not shown. The
      // candidates function is already workspace-scoped so it should not
      // happen — but a card drawn from a row that is not there is a card
      // somebody then presses Merge on.
      .filter((p) => byId.has(p.a_id) && byId.has(p.b_id))
      .map((p) => ({
        reason: p.reason,
        score: p.score,
        a: side(p.a_id, p.a_name, p.a_domain, p.a_people),
        b: side(p.b_id, p.b_name, p.b_domain, p.b_people),
      })),
  });
});

// GET /organisations/merge-conflicts?keep=&merge= — what the two records
// disagree about, which is the question a per-field merge has to ask.
//
// Its own endpoint rather than a field on /duplicates: the conflict VALUES
// only travel for the pair somebody actually opened, instead of shipping both
// records of every suggested pair to a browser that will look at one.
organisationsRoutes.get('/merge-conflicts', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const keep = c.req.query('keep');
  const merge = c.req.query('merge');
  if (!keep || !merge) return c.json({ error: 'keep and merge are required' }, 400);

  // See bothOrgsInWorkspace: the RPC knows only that the pair shares *a*
  // workspace, so without this an admin of any workspace could read the
  // compared values of two organisations of another by id.
  if (!(await bothOrgsInWorkspace(ctx.workspaceId, keep, merge))) {
    return c.json({ error: 'organisation not found' }, 404);
  }

  const { data, error } = await adminClient.rpc('organisation_merge_conflicts', {
    p_keep: keep,
    p_merge: merge,
  });
  if (error) {
    console.error('[organisations/merge-conflicts] failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ conflicts: data ?? [] });
});

const OrgMergeBody = z.object({
  keep_id: z.string().uuid(),
  merge_id: z.string().uuid(),
  /**
   * Per-column decisions: `{ "street": "merge", "city": "keep" }`.
   *
   * A SIDE, never a value — the same line the person merge draws. A merge
   * that accepted values would be an arbitrary field writer: whoever may
   * merge could set any fillable column of any organisation to anything,
   * through an endpoint that applies none of the validation the profile
   * routes do. Naming a side means it can only ever choose between two values
   * that already exist on the two records.
   *
   * Omitted = the behaviour since 20261011202050: blanks filled, keeper wins.
   */
  choices: z.record(z.string(), z.enum(['keep', 'merge'])).optional(),
});

// POST /organisations/merge — repoints every FK, soft-deletes the merged row.
// Returns the audit id, which is the handle for undoing it.
organisationsRoutes.post('/merge', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const body = OrgMergeBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  if (!(await bothOrgsInWorkspace(ctx.workspaceId, body.data.keep_id, body.data.merge_id))) {
    return c.json({ error: 'organisation not found' }, 404);
  }

  const { data, error } = await adminClient.rpc('merge_organisation', {
    p_keep: body.data.keep_id,
    p_merge: body.data.merge_id,
    p_actor: ctx.userId || null,
    // The function validates these too and raises on a column a merge may not
    // carry, or a value that is not keep/merge. Passed through rather than
    // filtered here: silently dropping a choice is how somebody's decision
    // disappears without anybody learning that it did, and a raise arrives as
    // a 400 with the column named.
    p_choices: body.data.choices ?? {},
  });
  if (error) {
    console.error('[organisations/merge] failed', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    // The function raises for the refusals a caller can act on — same
    // workspace, not already deleted, a column a merge may not carry — so
    // pass the wording through rather than flattening them all to 500.
    return c.json({ error: error.message }, 400);
  }
  return c.json({ merge_id: data as string }, 201);
});

// POST /organisations/merges/:id/undo — put it back.
organisationsRoutes.post('/merges/:id/undo', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  // The merge row has to be this workspace's BEFORE the RPC runs:
  // unmerge_organisation, as the service role, would happily put back another
  // workspace's merge. The audit row carries its own workspace, so this is
  // the whole tenancy check for an undo.
  const { count: owned } = await adminClient
    .from('organisation_merge')
    .select('id', { count: 'exact', head: true })
    .eq('id', c.req.param('id'))
    .eq('workspace_id', ctx.workspaceId);
  if (owned !== 1) return c.json({ error: 'merge not found' }, 404);

  const { error } = await adminClient.rpc('unmerge_organisation', {
    p_merge_id: c.req.param('id'),
    p_actor: ctx.userId || null,
  });
  if (error) {
    console.error('[organisations/merges/undo] failed', error);
    return c.json({ error: error.message }, 400);
  }
  return c.json({ ok: true });
});

// GET /organisations/merges — what has been merged, and what can still be undone.
organisationsRoutes.get('/merges', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json(ADMINS_ONLY, 403);

  const { data, error } = await adminClient
    .from('organisation_merge')
    .select('id, kept_org_id, merged_org_id, merged_at, merged_by, undone_at, dropped')
    .eq('workspace_id', ctx.workspaceId)
    .order('merged_at', { ascending: false })
    .limit(100);
  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    items: (data ?? []).map((m) => ({
      id: m.id,
      kept_org_id: m.kept_org_id,
      merged_org_id: m.merged_org_id,
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

organisationsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('organisation')
    .select('*, org_identity(*), org_system_context(*), org_relationship(*)')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  const ownId = await workspaceOrganisationId(ctx.workspaceId);
  return c.json({ ...data, is_workspace_organisation: ownId === data.id });
});

const OrgUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  legal_name: z.string().max(200).nullable().optional(),
  // The abbreviation column existed from phase 0 and nothing could write it.
  short_name: z.string().max(50).nullable().optional(),
  other_names: OtherNames.optional(),
  domain: z.string().max(255).nullable().optional(),
  // Accept any string (display layer prepends https://). Brief intent was a URL
  // but strict .url() validation rejects "thefibre.app" — bad UX.
  website: z.string().max(500).nullable().optional(),
  linkedin_url: z.string().max(500).nullable().optional(),
  vat_number: z.string().max(50).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  sector: z.string().max(100).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  org_type: z.enum(['private', 'public', 'ngo', 'cooperative', 'government', 'education']).nullable().optional(),
  size_band: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).nullable().optional(),
  logo_url: z.string().max(2000).nullable().optional(),
});

organisationsRoutes.patch('/:id', async (c) => {
  const body = OrgUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('organisation')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

organisationsRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // The workspace's own organisation stays: every internal member belongs to
  // it and a new one would only be recreated empty. Rename it instead.
  if ((await workspaceOrganisationId(ctx.workspaceId)) === c.req.param('id')) {
    return c.json({ error: 'This is the workspace\'s own organisation. Rename it; it cannot be deleted.' }, 409);
  }

  // Soft delete — brief §13.3.
  const { error } = await db
    .from('organisation')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .is('deleted_at', null);

  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

organisationsRoutes.get('/:id/members', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('org_membership')
    .select('id, title, department, is_primary, is_decision_maker, started_at, ended_at, person:person_id (id, first_name, last_name, email)')
    .eq('org_id', c.req.param('id'))
    .is('ended_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const MemberCreate = z.object({
  person_id: z.string().uuid(),
  title: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  employment_type: z.enum(['permanent', 'interim', 'consultant', 'board', 'volunteer']).nullable().optional(),
  influence_level: z.enum(['formal', 'informal', 'both']).nullable().optional(),
  is_primary: z.boolean().optional(),
  is_decision_maker: z.boolean().optional(),
  is_budget_holder: z.boolean().optional(),
  is_champion: z.boolean().optional(),
  started_at: z.string().date().nullable().optional(),
});

organisationsRoutes.post('/:id/members', async (c) => {
  const body = MemberCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('org_membership')
    .insert({ org_id: c.req.param('id'), ...body.data })
    .select('id')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// End an active membership by stamping ended_at. We never hard-delete —
// historical context is part of the contact graph (brief §5.D3).
organisationsRoutes.post('/members/:membership_id/end', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db
    .from('org_membership')
    .update({ ended_at: new Date().toISOString().slice(0, 10) })
    .eq('id', c.req.param('membership_id'))
    .is('ended_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ============================================================================
// Profile sub-resources — one row per organisation each.
// Same upsert-on-PATCH pattern as person profile tabs.
// ============================================================================

async function upsertOrgProfile<T extends Record<string, unknown>>(
  c: import('hono').Context,
  table: string,
  appSlug: 'fibre-platform' | 'fibre-meet' | 'the-thread' | 'fibre-sales' | 'fibre-learn',
  body: T,
) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: org, error: oErr } = await db
    .from('organisation')
    .select('id')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (oErr || !org) {
    console.error('[upsertOrgProfile] org not found', { table, orgId, oErr });
    return c.json({ error: 'organisation not found' }, 404);
  }

  // Resolve the owning app's uuid. RLS gates by app_id since v0.4.
  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', appSlug)
    .single();
  if (aErr || !app) {
    console.error('[upsertOrgProfile] app not found', { table, appSlug, aErr });
    return c.json({ error: `app not found: ${appSlug}` }, 500);
  }

  const { data, error } = await db
    .from(table)
    .upsert({ org_id: orgId, app_id: app.id, ...body }, { onConflict: 'org_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[upsertOrgProfile] upsert failed', { table, orgId, appSlug, body, error });
    return c.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, 500);
  }
  return c.json(data);
}

async function getOrgProfile(c: import('hono').Context, table: string) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('org_id', c.req.param('id'))
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? null);
}

// --- org_identity ----------------------------------------------------------
const GOVERNANCE = ['hierarchical', 'flat', 'matrix', 'holacracy', 'cooperative'] as const;
const OWNERSHIP = ['private', 'public', 'family', 'employee', 'state', 'ngo'] as const;
const DECISION_STYLE = ['top_down', 'consultative', 'consensus', 'delegated'] as const;
const MATURITY = ['startup', 'growth', 'established', 'legacy', 'transitioning'] as const;

const IdentityUpdate = z.object({
  mission_statement: z.string().max(2000).nullable().optional(),
  vision_statement: z.string().max(2000).nullable().optional(),
  stated_values: z.array(z.string().max(100)).nullable().optional(),
  cultural_descriptors: z.array(z.string().max(100)).nullable().optional(),
  governance_model: z.enum(GOVERNANCE).nullable().optional(),
  ownership_type: z.enum(OWNERSHIP).nullable().optional(),
  decision_making_style: z.enum(DECISION_STYLE).nullable().optional(),
  languages_of_operation: z.array(z.string().max(50)).nullable().optional(),
  maturity_stage: z.enum(MATURITY).nullable().optional(),
  identity_notes: z.string().max(5000).nullable().optional(),
});

organisationsRoutes.get('/:id/identity', (c) => getOrgProfile(c, 'org_identity'));
organisationsRoutes.patch('/:id/identity', async (c) => {
  const body = IdentityUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertOrgProfile(c, 'org_identity', 'fibre-platform', body.data);
});

// --- org_system_context (political_landscape is sensitive — brief §5.D3) --
const TRANSFORMATION_STAGE = ['pre_awareness', 'exploring', 'committed', 'in_programme', 'sustaining', 'alumni'] as const;
const LEADERSHIP_STABILITY = ['stable', 'transitioning', 'turbulent'] as const;
const CHANGE_READINESS = ['not_ready', 'cautious', 'open', 'ready', 'driving'] as const;

const SystemContextUpdate = z.object({
  transformation_stage: z.enum(TRANSFORMATION_STAGE).nullable().optional(),
  active_change_themes: z.array(z.string().max(100)).nullable().optional(),
  structural_tensions: z.array(z.string().max(200)).nullable().optional(),
  strategic_priorities: z.string().max(2000).nullable().optional(),
  current_challenges: z.string().max(2000).nullable().optional(),
  political_landscape: z.string().max(5000).nullable().optional(),
  leadership_stability: z.enum(LEADERSHIP_STABILITY).nullable().optional(),
  change_readiness: z.enum(CHANGE_READINESS).nullable().optional(),
  previous_interventions: z.array(z.string().max(200)).nullable().optional(),
  lessons_from_previous_work: z.string().max(2000).nullable().optional(),
  blockers: z.array(z.string().max(200)).nullable().optional(),
  enablers: z.array(z.string().max(200)).nullable().optional(),
});

organisationsRoutes.get('/:id/system-context', (c) => getOrgProfile(c, 'org_system_context'));
organisationsRoutes.patch('/:id/system-context', async (c) => {
  const body = SystemContextUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  return upsertOrgProfile(c, 'org_system_context', 'fibre-meet', {
    ...body.data,
    notes_updated_at: new Date().toISOString(),
    notes_updated_by: ctx.userId,
  });
});

// --- org_relationship ------------------------------------------------------
const RELATIONSHIP_STAGE = ['prospect', 'engaged', 'active_client', 'alumni', 'dormant', 'lost'] as const;
const HEALTH_STATUS = ['active', 'at_risk', 'dormant', 'lost', 'never_converted'] as const;
const ENGAGEMENT_TYPE = ['facilitation', 'learning', 'advisory', 'speaking', 'mixed'] as const;

const OrgRelationshipUpdate = z.object({
  primary_owner: z.string().uuid().nullable().optional(),
  secondary_owner: z.string().uuid().nullable().optional(),
  relationship_stage: z.enum(RELATIONSHIP_STAGE).nullable().optional(),
  health_status: z.enum(HEALTH_STATUS).nullable().optional(),
  engagement_type: z.enum(ENGAGEMENT_TYPE).nullable().optional(),
  programmes_completed: z.array(z.string().max(200)).nullable().optional(),
  total_participants_reached: z.number().int().min(0).nullable().optional(),
  touchpoints_count: z.number().int().min(0).nullable().optional(),
  relationship_history: z.string().max(5000).nullable().optional(),
  next_opportunity: z.string().max(1000).nullable().optional(),
  last_touchpoint_at: z.string().date().nullable().optional(),
  next_planned_contact: z.string().date().nullable().optional(),
});

organisationsRoutes.get('/:id/relationship', (c) => getOrgProfile(c, 'org_relationship'));
organisationsRoutes.patch('/:id/relationship', async (c) => {
  const body = OrgRelationshipUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertOrgProfile(c, 'org_relationship', 'fibre-sales', body.data);
});

// --- org_billing (fibre-sales) ---------------------------------------------
const OrgBillingUpdate = z.object({
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

organisationsRoutes.get('/:id/billing', (c) => getOrgProfile(c, 'org_billing'));
organisationsRoutes.patch('/:id/billing', async (c) => {
  const body = OrgBillingUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertOrgProfile(c, 'org_billing', 'fibre-sales', {
    ...body.data,
    updated_at: new Date().toISOString(),
  });
});

// Apps-discovery: which apps have data on this org?
organisationsRoutes.get('/:id/apps', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const [idQ, sysQ, relQ, billQ] = await Promise.all([
    db.from('org_identity').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_system_context').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_relationship').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_billing').select('app:app_id (slug)').eq('org_id', orgId),
  ]);

  const slugs = new Set<string>();
  for (const q of [idQ, sysQ, relQ, billQ]) {
    for (const row of (q.data ?? []) as unknown as { app: { slug?: string } | { slug?: string }[] | null }[]) {
      const app = Array.isArray(row.app) ? row.app[0] : row.app;
      if (app?.slug) slugs.add(app.slug);
    }
  }
  return c.json({ apps: Array.from(slugs).sort() });
});

// ===========================================================================
// Domain verification — TXT-challenge ownership proof.
//
// Flow:
//   1. Caller GETs /:id/domain-verification — returns existing challenge if
//      any, else null.
//   2. Caller POSTs /:id/domain-verification — generates (or rotates) a
//      challenge, returns { record_name, record_value }. UI shows these to
//      the user. User adds the TXT record to their DNS.
//   3. Caller POSTs /:id/domain-verification/check — server does
//      dns.resolveTxt(`_fibre-verify.<domain>`) and compares verbatim with
//      the stored challenge. On match: stamps domain_verified_at on the org
//      and verified_at on the challenge row, returns { verified: true }.
//
// The record lives under `_fibre-verify.<domain>` (not the root) so it
// doesn't clutter the org's apex TXT records (SPF/DKIM/etc) and is namespaced
// to us if multiple verification systems share the same DNS zone.
// ===========================================================================

const CHALLENGE_PREFIX = 'fibre-verify-';
const CHALLENGE_HOST = '_fibre-verify';

function newChallenge(): string {
  return CHALLENGE_PREFIX + randomBytes(24).toString('base64url');
}

organisationsRoutes.get('/:id/domain-verification', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  // Pull the org so we can return the current `domain` + `domain_verified_at`
  // alongside the challenge — saves the UI one round-trip.
  const { data: org, error: orgErr } = await db
    .from('organisation')
    .select('id, domain, domain_verified_at')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (orgErr || !org) return c.json({ error: 'org not found' }, 404);

  const { data: row } = await db
    .from('org_domain_verification')
    .select('domain, challenge, created_at, verified_at')
    .eq('org_id', orgId)
    .maybeSingle();

  return c.json({
    domain: org.domain,
    domain_verified_at: org.domain_verified_at,
    challenge: row && row.domain === org.domain
      ? {
          record_name: `${CHALLENGE_HOST}.${row.domain}`,
          record_value: row.challenge,
          created_at: row.created_at,
          verified_at: row.verified_at,
        }
      : null,
  });
});

organisationsRoutes.post('/:id/domain-verification', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: org, error: orgErr } = await db
    .from('organisation')
    .select('id, domain')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (orgErr || !org) return c.json({ error: 'org not found' }, 404);
  if (!org.domain || !org.domain.trim()) {
    return c.json(
      { error: 'org has no domain set — add one on the edit form first' },
      400,
    );
  }

  const challenge = newChallenge();
  const { error } = await db
    .from('org_domain_verification')
    .upsert(
      {
        org_id: orgId,
        workspace_id: ctx.workspaceId,
        domain: org.domain,
        challenge,
        created_at: new Date().toISOString(),
        verified_at: null,
      },
      { onConflict: 'org_id' },
    );
  if (error) {
    console.error('[org domain-verification] upsert failed', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    record_name: `${CHALLENGE_HOST}.${org.domain}`,
    record_value: challenge,
  });
});

organisationsRoutes.post('/:id/domain-verification/check', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: row, error: rowErr } = await db
    .from('org_domain_verification')
    .select('domain, challenge')
    .eq('org_id', orgId)
    .single();
  if (rowErr || !row) {
    return c.json(
      { verified: false, error: 'no challenge issued — call POST first' },
      400,
    );
  }

  const host = `${CHALLENGE_HOST}.${row.domain}`;
  let txtRecords: string[][] = [];
  try {
    // dns.resolveTxt returns string[][] — one record can be split into
    // multiple chunks; we join each record's chunks before compare.
    txtRecords = await dns.resolveTxt(host);
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'unknown';
    return c.json({
      verified: false,
      error: `DNS lookup failed: ${code}`,
      record_name: host,
      record_value: row.challenge,
    });
  }

  const flat = txtRecords.map((parts) => parts.join(''));
  const matched = flat.some((v) => v.trim() === row.challenge);
  if (!matched) {
    return c.json({
      verified: false,
      error: 'TXT record found but value did not match',
      record_name: host,
      record_value: row.challenge,
      found: flat,
    });
  }

  const now = new Date().toISOString();
  // Stamp both rows: the challenge for audit, and the org for the live
  // "verified" badge.
  await db
    .from('org_domain_verification')
    .update({ verified_at: now })
    .eq('org_id', orgId);
  await db
    .from('organisation')
    .update({ domain_verified_at: now })
    .eq('id', orgId);

  return c.json({ verified: true, verified_at: now });
});

// ===========================================================================
// Backfill: snap existing persons to a verified-domain org.
//
// New persons are auto-linked on POST /persons (see persons.ts). This
// endpoint handles the back-population case: an org's domain was just
// verified, and several persons with @<domain> emails already exist in
// the workspace without an org_membership for that org.
//
// We add a membership row for each match that doesn't already have one.
// is_primary is set only when the person has *no other* primary org
// (single-org common case); we don't fight existing primaries.
// ===========================================================================

organisationsRoutes.post('/:id/domain-verification/backfill', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: org, error: orgErr } = await db
    .from('organisation')
    .select('id, name, domain, domain_verified_at')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (orgErr || !org) return c.json({ error: 'org not found' }, 404);
  if (!org.domain_verified_at) {
    return c.json(
      { error: 'org domain is not verified — run /check first' },
      400,
    );
  }
  if (!org.domain) return c.json({ error: 'org has no domain' }, 400);

  // Find candidate persons: same workspace, email ends with @<domain>,
  // not soft-deleted, and not already linked to this org.
  const domain = org.domain.toLowerCase();
  const { data: candidates, error: candErr } = await db
    .from('person')
    .select('id, email')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .ilike('email', `%@${domain}`);
  if (candErr) return c.json({ error: candErr.message }, 500);

  if (!candidates || candidates.length === 0) {
    return c.json({ linked: 0, skipped: 0, total: 0 });
  }

  // Existing memberships for this org so we don't double-insert.
  const candidateIds = candidates.map((p) => p.id);
  const { data: existing } = await db
    .from('org_membership')
    .select('person_id')
    .eq('org_id', orgId)
    .in('person_id', candidateIds);
  const linkedSet = new Set((existing ?? []).map((r) => r.person_id));

  // Which candidates already have *any* primary org? Those we link as
  // non-primary so we don't fight existing curation.
  const toLink = candidates.filter((p) => !linkedSet.has(p.id));
  if (toLink.length === 0) {
    return c.json({ linked: 0, skipped: candidates.length, total: candidates.length });
  }

  const { data: primaries } = await db
    .from('org_membership')
    .select('person_id')
    .in('person_id', toLink.map((p) => p.id))
    .is('ended_at', null)
    .eq('is_primary', true);
  const hasPrimary = new Set((primaries ?? []).map((r) => r.person_id));

  const today = new Date().toISOString().slice(0, 10);
  const rows = toLink.map((p) => ({
    person_id: p.id,
    org_id: orgId,
    is_primary: !hasPrimary.has(p.id),
    started_at: today,
  }));

  const { error: insErr } = await db.from('org_membership').insert(rows);
  if (insErr) {
    console.error('[org backfill] insert failed', insErr);
    return c.json({ error: insErr.message }, 500);
  }

  // Audit activity rows — one per linked person, batched insert.
  const { data: platformApp } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (platformApp) {
    const acts = toLink.map((p) => ({
      workspace_id: ctx.workspaceId,
      person_id: p.id,
      app_id: platformApp.id,
      type: 'user_created' as const,
      subject: `Backfill: linked to ${org.name} (verified domain ${domain})`,
      created_by: ctx.userId,
    }));
    await db.from('activity').insert(acts);
  }

  return c.json({
    linked: toLink.length,
    skipped: candidates.length - toLink.length,
    total: candidates.length,
  });
});
