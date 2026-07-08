import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { recordPurchase } from '../lib/purchases.js';
import { sendEmail } from '../lib/email/client.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import {
  ensurePipelineFlow,
  ensureOpportunityRuns,
  syncOpportunityRun,
  syncStagesFromFlow,
} from '../lib/pulse-pipeline.js';

// ===========================================================================
// Fibre Pulse — P1: the planner API.
//
// Pulse is the forward view of money: opportunities (commitments) from
// contacts, recurring budget lines, user-defined reservation rules, bank
// balance snapshots — projected into a running-balance timeline. Actuals
// arrive from the platform purchase ledger (P4). docs/fibre-pulse-proposal.md
// is the spec.
//
// RLS does the heavy lifting: money surfaces are admin+, commitments are
// admin-or-owner. Every query runs through userClient(jwt). Full Postgres
// errors go to stderr (feedback_api_logs_first).
// ===========================================================================

export const pulseRoutes = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const Granularity = z.enum(['week', 'fortnight', 'month']);

const PutSettings = z.object({
  currency: z.string().length(3).optional(),
  default_granularity: Granularity.optional(),
  period_anchor_date: z.string().date().optional().nullable(),
  fiscal_year_start_month: z.number().int().min(1).max(12).optional(),
  horizon_months: z.number().int().min(1).max(60).optional(),
  include_ledger: z.boolean().optional(),
  ledger_terms_days: z.number().int().min(0).max(120).optional(),
  snapshot_cadence_days: z.number().int().min(1).max(90).optional().nullable(),
  vat_tariffs: z
    .array(z.object({ label: z.string().min(1).max(60), pct: z.number().min(0).max(100) }))
    .max(12)
    .optional(),
  invoice_prefix: z.string().max(20).optional(),
  invoice_auto_send: z.boolean().optional(),
});

const CreateAccount = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['bank', 'reserve']).default('bank'),
  parent_account_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().optional(),
});
const PatchAccount = CreateAccount.partial().extend({
  archived: z.boolean().optional(),
});

const CreateSnapshot = z.object({
  balance_cents: z.number().int(),
  as_of_date: z.string().date(),
});

const CreateOffering = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  default_amount_cents: z.number().int().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
const PatchOffering = CreateOffering.partial().extend({
  archived: z.boolean().optional(),
});

const CreateProject = z.object({
  name: z.string().min(1).max(200),
  team_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
const PatchProject = CreateProject.partial().extend({
  archived: z.boolean().optional(),
});

// Stages are data (pulse_stage — the workspace's pipeline flow), not an
// enum. `kind` carries projection semantics; see the stages routes below.
const StageKind = z.enum(['open', 'committed', 'won', 'lost']);
const PatchStage = z.object({
  kind: StageKind.optional(),
  default_probability: z.number().int().min(0).max(100).optional().nullable(),
});

const CreateCommitment = z.object({
  direction: z.enum(['in', 'out']),
  label: z.string().min(1).max(200),
  person_id: z.string().uuid().optional().nullable(),
  organisation_id: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  offering_id: z.string().uuid().optional().nullable(),
  owner_user_id: z.string().uuid().optional().nullable(),
  stage: z.string().min(1).max(64).default('lead'),
  // Optional: when omitted, the stage's default_probability applies.
  probability: z.number().int().min(0).max(100).optional(),
  quantity: z.number().positive().max(1_000_000).default(1),
  unit_amount_cents: z.number().int().optional().nullable(),
  // Recurring is a characteristic: cadence + window; occurrences expand at
  // projection time from quantity × unit price.
  repeat_cadence: z
    .enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'])
    .optional()
    .nullable(),
  repeat_starts_on: z.string().date().optional().nullable(),
  repeat_until: z.string().date().optional().nullable(),
  vat_pct: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
const PatchCommitment = CreateCommitment.partial();

const CreateItem = z.object({
  offering_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  quantity: z.number().positive().max(1_000_000).default(1),
  unit_amount_cents: z.number().int(),
  repeat_cadence: z
    .enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'])
    .optional()
    .nullable(),
  sort_order: z.number().int().optional(),
});
const PatchItem = CreateItem.partial();

// Stage metadata for a workspace, keyed by stage key. Unknown keys degrade
// to 'open' so a half-migrated row never crashes the projection.
type StageMeta = { kind: string; default_probability: number | null };
async function stageKinds(db: ReturnType<typeof userClient>): Promise<Map<string, StageMeta>> {
  const { data } = await db.from('pulse_stage').select('key, kind, default_probability');
  return new Map(
    (data ?? []).map((s) => [s.key, { kind: s.kind, default_probability: s.default_probability }]),
  );
}
// Row probability on entering a stage: explicit value wins; otherwise the
// stage's default; committed/won always force 100.
function stageProbability(meta: StageMeta | undefined, explicit: number | undefined): number {
  if (meta && (meta.kind === 'committed' || meta.kind === 'won')) return 100;
  if (explicit !== undefined) return explicit;
  return meta?.default_probability ?? 50;
}

const CreateLine = z.object({
  expected_date: z.string().date(),
  amount_cents: z.number().int(),
  invoice_ref: z.string().max(200).optional().nullable(),
  invoiced_at: z.string().date().optional().nullable(),
  settled_at: z.string().date().optional().nullable(),
});
const PatchLine = CreateLine.partial();

const CreateBudgetLine = z.object({
  label: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  direction: z.enum(['in', 'out']).default('out'),
  amount_cents: z.number().int(),
  cadence: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  starts_on: z.string().date().optional().nullable(),
  ends_on: z.string().date().optional().nullable(),
  included: z.boolean().default(true),
  owner_user_id: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
});
const PatchBudgetLine = CreateBudgetLine.partial().extend({
  archived: z.boolean().optional(),
});

const CreateRule = z.object({
  label: z.string().min(1).max(200),
  percentage: z.number().min(0).max(100),
  basis: z.enum(['revenue', 'net_revenue']).default('revenue'),
  target_account_id: z.string().uuid().optional().nullable(),
  included: z.boolean().default(true),
  sort_order: z.number().int().optional(),
});
const PatchRule = CreateRule.partial();

function fail(c: any, where: string, error: { message: string; code?: string }) {
  console.error(`[pulse] ${where}`, error);
  return c.json({ error: error.message, code: error.code }, 500);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
pulseRoutes.get('/settings', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_settings')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (error) return fail(c, 'get settings', error);
  return c.json({ settings: data });
});

pulseRoutes.put('/settings', async (c) => {
  const body = PutSettings.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_settings')
    .upsert(
      { workspace_id: ctx.workspaceId, ...body.data, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' },
    )
    .select('*')
    .single();
  if (error) return fail(c, 'put settings', error);
  return c.json({ settings: data });
});

// ---------------------------------------------------------------------------
// Involved teams
// ---------------------------------------------------------------------------
pulseRoutes.get('/involved-teams', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_involved_team')
    .select('id, team_id, added_at, team:team_id (id, name)')
    .order('added_at', { ascending: true });
  if (error) return fail(c, 'list involved teams', error);
  return c.json({ items: data ?? [] });
});

pulseRoutes.post('/involved-teams', async (c) => {
  const body = z
    .object({ team_id: z.string().uuid() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_involved_team')
    .upsert(
      { workspace_id: ctx.workspaceId, team_id: body.data.team_id },
      { onConflict: 'workspace_id,team_id' },
    )
    .select('id, team_id, added_at')
    .single();
  if (error) return fail(c, 'add involved team', error);
  return c.json({ item: data });
});

pulseRoutes.delete('/involved-teams/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('pulse_involved_team').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'remove involved team', error);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Accounts + snapshots
// ---------------------------------------------------------------------------
pulseRoutes.get('/accounts', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: accounts, error } = await db
    .from('pulse_account')
    .select('id, name, kind, parent_account_id, sync_mode, sort_order, archived_at, created_at')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list accounts', error);

  // Latest snapshot per account — one query, newest-first, first-wins.
  const latest: Record<string, { balance_cents: number; as_of_date: string }> = {};
  const ids = (accounts ?? []).map((a) => a.id);
  if (ids.length) {
    const { data: snaps, error: sErr } = await db
      .from('pulse_balance_snapshot')
      .select('account_id, balance_cents, as_of_date')
      .in('account_id', ids)
      .order('as_of_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (sErr) return fail(c, 'list snapshots', sErr);
    for (const s of snaps ?? []) {
      if (!latest[s.account_id]) {
        latest[s.account_id] = { balance_cents: s.balance_cents, as_of_date: s.as_of_date };
      }
    }
  }
  const items = (accounts ?? []).map((a) => ({ ...a, latest_snapshot: latest[a.id] ?? null }));
  return c.json({ items });
});

pulseRoutes.post('/accounts', async (c) => {
  const body = CreateAccount.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_account')
    .insert({ workspace_id: ctx.workspaceId, ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create account', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/accounts/:id', async (c) => {
  const body = PatchAccount.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await db
    .from('pulse_account')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch account', error);
  return c.json({ item: data });
});

pulseRoutes.post('/accounts/:id/snapshots', async (c) => {
  const body = CreateSnapshot.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_balance_snapshot')
    .insert({ account_id: c.req.param('id'), created_by: ctx.userId, ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create snapshot', error);
  return c.json({ item: data }, 201);
});

// ---------------------------------------------------------------------------
// Offerings
// ---------------------------------------------------------------------------
pulseRoutes.get('/offerings', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_offering')
    .select('id, name, category, default_amount_cents, notes, created_at')
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) return fail(c, 'list offerings', error);
  return c.json({ items: data ?? [] });
});

pulseRoutes.post('/offerings', async (c) => {
  const body = CreateOffering.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_offering')
    .insert({ workspace_id: ctx.workspaceId, ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create offering', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/offerings/:id', async (c) => {
  const body = PatchOffering.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await db
    .from('pulse_offering')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch offering', error);
  return c.json({ item: data });
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
pulseRoutes.get('/projects', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_project')
    .select('id, name, team_id, notes, created_at, team:team_id (id, name)')
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) return fail(c, 'list projects', error);
  return c.json({ items: data ?? [] });
});

pulseRoutes.post('/projects', async (c) => {
  const body = CreateProject.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_project')
    .insert({ workspace_id: ctx.workspaceId, ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create project', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/projects/:id', async (c) => {
  const body = PatchProject.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await db
    .from('pulse_project')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch project', error);
  return c.json({ item: data });
});

// ---------------------------------------------------------------------------
// Stages — the pipeline flow. Seeded with the default sales flow on Pulse
// activation (is_system, undeletable — RLS enforces); custom stages can be
// added around it. Keys are stable; labels/order are free.
// ---------------------------------------------------------------------------
pulseRoutes.get('/stages', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // Refresh the mirror from the Pipeline flow first — Flow authors, Pulse
  // reads. Self-healing: workspaces the migration backfill skipped (no
  // super-admin user to own the flow) get it created on first read.
  let { pipeline_flow_id } = await syncStagesFromFlow(ctx.workspaceId);
  if (!pipeline_flow_id) {
    await ensurePipelineFlow(ctx.workspaceId, ctx.userId);
    ({ pipeline_flow_id } = await syncStagesFromFlow(ctx.workspaceId));
  }
  // Mirror every live opportunity into a flow_run (idempotent backfill).
  await ensureOpportunityRuns(ctx.workspaceId);
  const { data, error } = await db
    .from('pulse_stage')
    .select('id, key, label, kind, sort_order, is_system, default_probability')
    .order('sort_order', { ascending: true });
  if (error) return fail(c, 'list stages', error);
  return c.json({ items: data ?? [], pipeline_flow_id });
});

const AUTHOR_IN_FLOW =
  'the pipeline is authored in Fibre Flow — edit the Pipeline flow there; Pulse mirrors it';

pulseRoutes.post('/stages', async (c) => c.json({ error: AUTHOR_IN_FLOW }, 409));
pulseRoutes.delete('/stages/:id', async (c) => c.json({ error: AUTHOR_IN_FLOW }, 409));

// Only the money-semantics overlay is Pulse's to edit. Labels and order
// mirror the flow; won/lost are re-imposed from terminal steps on next sync.
pulseRoutes.patch('/stages/:id', async (c) => {
  const body = PatchStage.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  if (body.data.kind === undefined && body.data.default_probability === undefined) {
    return c.json({ error: 'only kind/default_probability are editable here — ' + AUTHOR_IN_FLOW }, 400);
  }
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_stage')
    .update({
      ...(body.data.kind !== undefined ? { kind: body.data.kind } : {}),
      ...(body.data.default_probability !== undefined
        ? { default_probability: body.data.default_probability }
        : {}),
    })
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch stage', error);
  return c.json({ item: data });
});

// ---------------------------------------------------------------------------
// Commitments (the pipeline) + lines
// ---------------------------------------------------------------------------
const COMMITMENT_SELECT =
  'id, direction, label, stage, probability, quantity, unit_amount_cents, repeat_cadence, repeat_starts_on, repeat_until, vat_pct, invoice_no, invoice_issued_at, purchase_id, notes, created_at, updated_at, ' +
  'person_id, organisation_id, team_id, project_id, offering_id, owner_user_id, ' +
  'person:person_id (id, first_name, last_name, email), ' +
  'organisation:organisation_id (id, name), ' +
  'project:project_id (id, name), ' +
  'offering:offering_id (id, name), ' +
  'lines:pulse_commitment_line (id, expected_date, amount_cents, invoice_ref, invoiced_at, purchase_id, settled_at), ' +
  'items:pulse_commitment_item (id, offering_id, name, quantity, unit_amount_cents, repeat_cadence, sort_order)';

pulseRoutes.get('/commitments', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  let q = db
    .from('pulse_commitment')
    .select(COMMITMENT_SELECT)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  const direction = c.req.query('direction');
  const stage = c.req.query('stage');
  const teamId = c.req.query('team_id');
  const projectId = c.req.query('project_id');
  if (direction) q = q.eq('direction', direction);
  if (stage) q = q.eq('stage', stage);
  if (teamId) q = q.eq('team_id', teamId);
  if (projectId) q = q.eq('project_id', projectId);
  if (c.req.query('mine') === '1') q = q.eq('owner_user_id', ctx.userId);
  const { data, error } = await q;
  if (error) return fail(c, 'list commitments', error);
  return c.json({ items: data ?? [] });
});

pulseRoutes.post('/commitments', async (c) => {
  const body = CreateCommitment.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const kinds = await stageKinds(db);
  if (!kinds.has(body.data.stage)) return c.json({ error: `unknown stage '${body.data.stage}'` }, 400);
  const row = {
    workspace_id: ctx.workspaceId,
    owner_user_id: body.data.owner_user_id ?? ctx.userId,
    ...body.data,
    probability: stageProbability(kinds.get(body.data.stage), body.data.probability),
  };
  const { data, error } = await db
    .from('pulse_commitment')
    .insert(row)
    .select(COMMITMENT_SELECT)
    .single();
  if (error) return fail(c, 'create commitment', error);
  await syncOpportunityRun(ctx.workspaceId, data as any);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/commitments/:id', async (c) => {
  const body = PatchCommitment.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (body.data.stage) {
    const kinds = await stageKinds(db);
    if (!kinds.has(body.data.stage)) return c.json({ error: `unknown stage '${body.data.stage}'` }, 400);
    // Entering a stage applies its default unless the caller pinned a value.
    patch.probability = stageProbability(kinds.get(body.data.stage), body.data.probability);
  }
  const { data, error } = await db
    .from('pulse_commitment')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select(COMMITMENT_SELECT)
    .single();
  if (error) return fail(c, 'patch commitment', error);
  await syncOpportunityRun(ctx.workspaceId, data as any);
  return c.json({ item: data });
});

// Soft delete — hard rule #4. Visibility check runs through RLS (userClient
// SELECT: workspace + membership + admin-or-owner); the deleted_at stamp
// itself runs on adminClient — the RLS UPDATE path 500'd for a super_admin
// owner on 2026-07-08 (same phantom as contact creation); verify-then-act
// is the established platform pattern for it.
pulseRoutes.delete('/commitments/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: visible, error: vErr } = await db
    .from('pulse_commitment')
    .select('id')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .maybeSingle();
  if (vErr) return fail(c, 'delete commitment (visibility)', vErr);
  if (!visible) return c.json({ error: 'not found' }, 404);
  const { error } = await adminClient
    .from('pulse_commitment')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', visible.id)
    .eq('workspace_id', ctx.workspaceId);
  if (error) return fail(c, 'delete commitment', error);
  await syncOpportunityRun(ctx.workspaceId, {
    id: c.req.param('id'),
    label: '',
    stage: '',
    person_id: null,
    organisation_id: null,
    owner_user_id: null,
    deleted: true,
  });
  return c.body(null, 204);
});

pulseRoutes.post('/commitments/:id/lines', async (c) => {
  const body = CreateLine.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_commitment_line')
    .insert({ commitment_id: c.req.param('id'), ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create line', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.post('/commitments/:id/items', async (c) => {
  const body = CreateItem.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_commitment_item')
    .insert({ commitment_id: c.req.param('id'), ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create item', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/items/:id', async (c) => {
  const body = PatchItem.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_commitment_item')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch item', error);
  return c.json({ item: data });
});

pulseRoutes.delete('/items/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('pulse_commitment_item').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete item', error);
  return c.body(null, 204);
});

// POST /lines/duplicate — ⌥-drag copies expected payments to another period
// (Sjoerd 2026-07-09: "Select + option = duplicate in the same row").
pulseRoutes.post('/lines/duplicate', async (c) => {
  const body = z
    .object({ ids: z.array(z.string().uuid()).min(1).max(100), expected_date: z.string().date() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // RLS scopes what the caller may read; copies carry amount + parent only
  // (a duplicate is a new expectation — invoice/settle state never copies).
  const { data: lines, error: lErr } = await db
    .from('pulse_commitment_line')
    .select('id, commitment_id, amount_cents')
    .in('id', body.data.ids);
  if (lErr) return fail(c, 'duplicate read', lErr);
  if (!lines?.length) return c.json({ error: 'nothing to duplicate' }, 404);
  const { error: iErr } = await db.from('pulse_commitment_line').insert(
    lines.map((l) => ({
      commitment_id: l.commitment_id,
      expected_date: body.data.expected_date,
      amount_cents: l.amount_cents,
    })),
  );
  if (iErr) return fail(c, 'duplicate insert', iErr);
  return c.json({ duplicated: lines.length }, 201);
});

pulseRoutes.patch('/lines/:id', async (c) => {
  const body = PatchLine.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_commitment_line')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch line', error);
  return c.json({ item: data });
});

pulseRoutes.delete('/lines/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('pulse_commitment_line').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete line', error);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// POST /commitments/:id/invoice — transfer an opportunity into an invoice
// (proposal §2.8): next number from the workspace sequence, stage →
// invoiced, a purchase-ledger row (SPoT — the Invoices area shows it,
// include_ledger feeds it back as a receivable), and the receipt-styled
// email — sent when ?send=1 or the auto-send setting is on.
// ---------------------------------------------------------------------------
pulseRoutes.post('/commitments/:id/invoice', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const explicitSend = c.req.query('send') === '1';

  const { data: cm, error: cmErr } = await db
    .from('pulse_commitment')
    .select(COMMITMENT_SELECT)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (cmErr || !cm) return c.json({ error: 'opportunity not found' }, 404);
  if ((cm as any).invoice_no) {
    return c.json({ error: `already invoiced as ${(cm as any).invoice_no}` }, 409);
  }

  // Total: items win over legacy qty × unit; VAT on top when set.
  const items = ((cm as any).items ?? []) as {
    name: string;
    quantity: number;
    unit_amount_cents: number;
  }[];
  const netCents = items.length
    ? items.reduce((a, i) => a + Math.round(Number(i.quantity) * i.unit_amount_cents), 0)
    : Math.round(Number((cm as any).quantity ?? 1) * ((cm as any).unit_amount_cents ?? 0));
  if (!netCents) return c.json({ error: 'nothing to invoice — no items or deal size' }, 400);
  const vatPct = Number((cm as any).vat_pct ?? 0);
  const totalCents = Math.round(netCents * (1 + vatPct / 100));

  // Number from the workspace sequence (adminClient: single-row bump).
  const { data: settings } = await adminClient
    .from('pulse_settings')
    .select('invoice_prefix, invoice_next_number, invoice_auto_send, currency')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  const seq = settings?.invoice_next_number ?? 1;
  const invoiceNo = `${settings?.invoice_prefix ?? ''}${String(seq).padStart(4, '0')}`;
  await adminClient
    .from('pulse_settings')
    .update({ invoice_next_number: seq + 1 })
    .eq('workspace_id', ctx.workspaceId);

  // Ledger row — the SPoT for money events.
  const person = Array.isArray((cm as any).person) ? (cm as any).person[0] : (cm as any).person;
  const org = Array.isArray((cm as any).organisation)
    ? (cm as any).organisation[0]
    : (cm as any).organisation;
  await recordPurchase({
    appSlug: 'fibre-pulse',
    workspaceId: ctx.workspaceId,
    itemRef: (cm as any).id,
    personId: (cm as any).person_id ?? null,
    payerName: org?.name ?? [person?.first_name, person?.last_name].filter(Boolean).join(' '),
    payerEmail: person?.email ?? null,
    itemLabel: `${invoiceNo} · ${(cm as any).label}`,
    organiserUserId: (cm as any).owner_user_id ?? ctx.userId,
    teamId: (cm as any).team_id ?? null,
    amountCents: totalCents,
    currency: (settings?.currency ?? 'EUR').toLowerCase(),
    method: 'invoice',
    status: 'pending',
  });
  const { data: purchaseRow } = await adminClient
    .from('purchase')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('item_ref', (cm as any).id)
    .maybeSingle();

  // Stamp the opportunity; invoiced stage exists in every pipeline.
  const kinds = await stageKinds(db);
  const targetStage = kinds.has('invoiced') ? 'invoiced' : (cm as any).stage;
  const { data: updated, error: upErr } = await db
    .from('pulse_commitment')
    .update({
      invoice_no: invoiceNo,
      invoice_issued_at: new Date().toISOString(),
      purchase_id: purchaseRow?.id ?? null,
      stage: targetStage,
      probability: 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', (cm as any).id)
    .select(COMMITMENT_SELECT)
    .single();
  if (upErr) return fail(c, 'invoice stamp', upErr);
  await syncOpportunityRun(ctx.workspaceId, updated as any);

  // Send — explicit or auto. No recipient email = saved unsent, said plainly.
  let sent = false;
  let sendNote: string | null = null;
  if (explicitSend || settings?.invoice_auto_send) {
    const to = person?.email ?? null;
    if (!to) {
      sendNote = 'no counterparty email — invoice saved, not sent';
    } else {
      const fmt = (cents: number) =>
        new Intl.NumberFormat('nl-NL', {
          style: 'currency',
          currency: settings?.currency ?? 'EUR',
        }).format(cents / 100);
      const rows = (items.length
        ? items
        : [{ name: (cm as any).label, quantity: (cm as any).quantity ?? 1, unit_amount_cents: (cm as any).unit_amount_cents ?? netCents }]
      )
        .map(
          (i) =>
            `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(i.name)}</td>` +
            `<td style="padding:4px 12px;text-align:right">${Number(i.quantity)}</td>` +
            `<td style="padding:4px 0;text-align:right">${fmt(Math.round(Number(i.quantity) * i.unit_amount_cents))}</td></tr>`,
        )
        .join('');
      const body =
        `<p>Invoice <strong>${escapeHtml(invoiceNo)}</strong></p>` +
        `<table style="border-collapse:collapse">${rows}</table>` +
        `<p style="margin-top:12px">Net ${fmt(netCents)}` +
        (vatPct ? ` · VAT ${vatPct}% · <strong>Total ${fmt(totalCents)}</strong>` : ` · <strong>Total ${fmt(totalCents)}</strong>`) +
        `</p>`;
      try {
        await sendEmail({
          to,
          subject: `Invoice ${invoiceNo} — ${(cm as any).label}`,
          text: `Invoice ${invoiceNo}. Total ${fmt(totalCents)}.`,
          html: shell(`Invoice ${invoiceNo}`, body),
        });
        sent = true;
      } catch (e) {
        console.error('[pulse] invoice email failed', e);
        sendNote = 'email failed — invoice saved; resend from the Invoices area';
      }
    }
  }

  return c.json({ item: updated, invoice_no: invoiceNo, sent, note: sendNote });
});

// GET /snapshots — stored projection overviews (metadata only; ?id= returns
// one payload). The comparison view consumes these.
pulseRoutes.get('/snapshots', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const one = c.req.query('id');
  if (one) {
    const { data, error } = await db
      .from('pulse_projection_snapshot')
      .select('*')
      .eq('id', one)
      .maybeSingle();
    if (error) return fail(c, 'snapshot get', error);
    return c.json({ item: data });
  }
  const { data, error } = await db
    .from('pulse_projection_snapshot')
    .select('id, taken_at, granularity')
    .order('taken_at', { ascending: false })
    .limit(120);
  if (error) return fail(c, 'snapshot list', error);
  return c.json({ items: data ?? [] });
});

// ---------------------------------------------------------------------------
// Budget lines
// ---------------------------------------------------------------------------
pulseRoutes.get('/budget-lines', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  let q = db
    .from('pulse_budget_line')
    .select('*')
    .is('archived_at', null);
  const teamId = c.req.query('team_id');
  if (teamId) q = q.eq('team_id', teamId);
  const { data, error } = await q
    .order('category', { ascending: true })
    .order('label', { ascending: true });
  if (error) return fail(c, 'list budget lines', error);
  return c.json({ items: data ?? [] });
});

pulseRoutes.post('/budget-lines', async (c) => {
  const body = CreateBudgetLine.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_budget_line')
    .insert({ workspace_id: ctx.workspaceId, ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create budget line', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/budget-lines/:id', async (c) => {
  const body = PatchBudgetLine.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await db
    .from('pulse_budget_line')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch budget line', error);
  return c.json({ item: data });
});

// ---------------------------------------------------------------------------
// Reservation rules
// ---------------------------------------------------------------------------
pulseRoutes.get('/reservation-rules', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_reservation_rule')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list rules', error);
  return c.json({ items: data ?? [] });
});

pulseRoutes.post('/reservation-rules', async (c) => {
  const body = CreateRule.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_reservation_rule')
    .insert({ workspace_id: ctx.workspaceId, ...body.data })
    .select('*')
    .single();
  if (error) return fail(c, 'create rule', error);
  return c.json({ item: data }, 201);
});

pulseRoutes.patch('/reservation-rules/:id', async (c) => {
  const body = PatchRule.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('pulse_reservation_rule')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return fail(c, 'patch rule', error);
  return c.json({ item: data });
});

pulseRoutes.delete('/reservation-rules/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db
    .from('pulse_reservation_rule')
    .delete()
    .eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete rule', error);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// GET /projection — the headline computation (proposal §2.2).
//
// Anchor: latest balance snapshots. Layers per period:
//   committed = stage committed/done lines + invoiced-but-unpaid lines
//   expected  = committed + open opportunities weighted by probability
//   best      = everything at 100%
// Budget lines expand into dated occurrences by cadence. Reservation rules
// reduce *available* cash by % of the period's income per layer.
// Settled lines are excluded — they're already in the bank anchor.
// ---------------------------------------------------------------------------
type Period = {
  start: string;
  end: string;
  committed_in: number;
  committed_out: number;
  expected_in: number;
  expected_out: number;
  best_in: number;
  best_out: number;
  reserved_committed: number;
  reserved_expected: number;
  balance_committed: number;
  balance_expected: number;
  balance_best: number;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

pulseRoutes.get('/projection', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: settings } = await db
    .from('pulse_settings')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  // Display granularity — settings store week|fortnight|month, but the view
  // may also ask for quarter (calendar quarters).
  const requested = c.req.query('granularity');
  const granularity = (['week', 'fortnight', 'month', 'quarter'].includes(requested ?? '')
    ? requested
    : (settings?.default_granularity ?? 'fortnight')) as
    | 'week'
    | 'fortnight'
    | 'month'
    | 'quarter';
  const horizonMonths = settings?.horizon_months ?? 12;

  // Period boundaries. Fortnights/weeks count from the anchor date; months
  // are calendar months. The current period starts at the boundary at-or-
  // before today.
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const horizonEnd = addMonths(today, horizonMonths);
  const starts: Date[] = [];
  if (granularity === 'month' || granularity === 'quarter') {
    const monthStep = granularity === 'quarter' ? 3 : 1;
    const startMonth =
      granularity === 'quarter'
        ? Math.floor(today.getUTCMonth() / 3) * 3
        : today.getUTCMonth();
    let cur = new Date(Date.UTC(today.getUTCFullYear(), startMonth, 1));
    while (cur < horizonEnd) {
      starts.push(cur);
      cur = addMonths(cur, monthStep);
    }
  } else {
    const step = granularity === 'week' ? 7 : 14;
    const anchor = settings?.period_anchor_date
      ? new Date(settings.period_anchor_date + 'T00:00:00Z')
      : today;
    // Walk the anchor grid to the boundary at-or-before today.
    const msPerDay = 86400000;
    const daysFromAnchor = Math.floor((today.getTime() - anchor.getTime()) / msPerDay);
    const offset = ((daysFromAnchor % step) + step) % step;
    let cur = addDays(today, -offset);
    while (cur < horizonEnd) {
      starts.push(cur);
      cur = addDays(cur, step);
    }
  }
  const periods: Period[] = starts.map((s, i) => ({
    start: isoDate(s),
    end: isoDate(addDays(starts[i + 1] ?? horizonEnd, -1)),
    committed_in: 0,
    committed_out: 0,
    expected_in: 0,
    expected_out: 0,
    best_in: 0,
    best_out: 0,
    reserved_committed: 0,
    reserved_expected: 0,
    balance_committed: 0,
    balance_expected: 0,
    balance_best: 0,
  }));
  const bucketFor = (dateStr: string): Period | null => {
    const first = periods[0];
    if (!first) return null;
    if (dateStr < first.start) return first; // overdue → current period
    for (let i = periods.length - 1; i >= 0; i--) {
      const p = periods[i];
      if (p && dateStr >= p.start) return p;
    }
    return null;
  };

  // Anchor: bank balances minus reserve buckets = available.
  const { data: accounts, error: aErr } = await db
    .from('pulse_account')
    .select('id, kind')
    .is('archived_at', null);
  if (aErr) return fail(c, 'projection accounts', aErr);
  let bankTotal = 0;
  let reserveTotal = 0;
  const ids = (accounts ?? []).map((a) => a.id);
  if (ids.length) {
    const { data: snaps, error: sErr } = await db
      .from('pulse_balance_snapshot')
      .select('account_id, balance_cents, as_of_date, created_at')
      .in('account_id', ids)
      .order('as_of_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (sErr) return fail(c, 'projection snapshots', sErr);
    const seen = new Set<string>();
    const kindById = new Map((accounts ?? []).map((a) => [a.id, a.kind]));
    for (const s of snaps ?? []) {
      if (seen.has(s.account_id)) continue;
      seen.add(s.account_id);
      if (kindById.get(s.account_id) === 'reserve') reserveTotal += s.balance_cents;
      else bankTotal += s.balance_cents;
    }
  }

  // Scope (Sjoerd: "cashflow per team... or per person or per workspace,
  // and workspace only visible to the ones who have access"): the Invoices
  // Me/Team/Workspace pattern. Workspace = unscoped (RLS already gates the
  // projection to admin+; organisers' commitment reads are self-scoped).
  // Bank anchor stays workspace-level; scoped views read as net flows.
  const teamId = c.req.query('team_id') || null;
  const mine = c.req.query('owner') === 'me';

  // Commitment lines (open, unsettled, in horizon or overdue). Stage kinds
  // drive the layers: lost is excluded, committed/won count in full, open is
  // probability-weighted. An invoiced line is committed regardless of stage.
  const kinds = await stageKinds(db);
  let cq = db
    .from('pulse_commitment')
    .select(
      'id, direction, stage, probability, quantity, unit_amount_cents, repeat_cadence, repeat_starts_on, repeat_until, lines:pulse_commitment_line (expected_date, amount_cents, invoiced_at, settled_at)',
    )
    .is('deleted_at', null);
  if (teamId) cq = cq.eq('team_id', teamId);
  if (mine) cq = cq.eq('owner_user_id', ctx.userId);
  const { data: commitments, error: cErr } = await cq;
  if (cErr) return fail(c, 'projection commitments', cErr);

  for (const cm of commitments ?? []) {
    const kind = kinds.get(cm.stage)?.kind ?? 'open';
    if (kind === 'lost') continue;
    const sign = cm.direction === 'in' ? 'in' : 'out';

    // Recurring commitment: occurrences from the deal amount replace lines.
    if (cm.repeat_cadence && cm.unit_amount_cents != null) {
      const occAmt = Math.round(Number(cm.quantity ?? 1) * cm.unit_amount_cents);
      const from = cm.repeat_starts_on
        ? new Date(cm.repeat_starts_on + 'T00:00:00Z')
        : today;
      const until = cm.repeat_until ? new Date(cm.repeat_until + 'T00:00:00Z') : horizonEnd;
      const advance = (d: Date): Date =>
        cm.repeat_cadence === 'weekly'
          ? addDays(d, 7)
          : cm.repeat_cadence === 'fortnightly'
            ? addDays(d, 14)
            : cm.repeat_cadence === 'monthly'
              ? addMonths(d, 1)
              : cm.repeat_cadence === 'quarterly'
                ? addMonths(d, 3)
                : addMonths(d, 12);
      let cur = new Date(from);
      while (cur < today) cur = advance(cur);
      while (cur <= until && cur < horizonEnd) {
        const p = bucketFor(isoDate(cur));
        if (p) {
          const isCommitted = kind === 'committed' || kind === 'won';
          if (isCommitted) {
            p[`committed_${sign}`] += occAmt;
            p[`expected_${sign}`] += occAmt;
          } else {
            p[`expected_${sign}`] += Math.round((occAmt * cm.probability) / 100);
          }
          p[`best_${sign}`] += occAmt;
        }
        cur = advance(cur);
      }
      continue;
    }

    for (const line of (cm as any).lines ?? []) {
      if (line.settled_at) continue; // already in the bank anchor
      const p = bucketFor(line.expected_date);
      if (!p) continue;
      const amt = line.amount_cents;
      const isCommitted = kind === 'committed' || kind === 'won' || !!line.invoiced_at;
      if (isCommitted) {
        p[`committed_${sign}`] += amt;
        p[`expected_${sign}`] += amt;
      } else {
        p[`expected_${sign}`] += Math.round((amt * cm.probability) / 100);
      }
      p[`best_${sign}`] += amt;
    }
  }

  // Budget lines → dated occurrences.
  let bq = db
    .from('pulse_budget_line')
    .select('*')
    .is('archived_at', null)
    .eq('included', true);
  if (teamId) bq = bq.eq('team_id', teamId);
  if (mine) bq = bq.eq('owner_user_id', ctx.userId);
  const { data: budgetLines, error: bErr } = await bq;
  if (bErr) return fail(c, 'projection budget lines', bErr);

  for (const bl of budgetLines ?? []) {
    const from = bl.starts_on ? new Date(bl.starts_on + 'T00:00:00Z') : today;
    const until = bl.ends_on ? new Date(bl.ends_on + 'T00:00:00Z') : horizonEnd;
    let cur = new Date(from);
    // Advance into the visible window without drifting the cadence grid.
    const advance = (d: Date): Date =>
      bl.cadence === 'weekly'
        ? addDays(d, 7)
        : bl.cadence === 'fortnightly'
          ? addDays(d, 14)
          : bl.cadence === 'monthly'
            ? addMonths(d, 1)
            : bl.cadence === 'quarterly'
              ? addMonths(d, 3)
              : addMonths(d, 12);
    while (cur < today) cur = advance(cur);
    while (cur <= until && cur < horizonEnd) {
      const p = bucketFor(isoDate(cur));
      if (p) {
        const sign = bl.direction === 'in' ? 'in' : 'out';
        p[`committed_${sign}`] += bl.amount_cents;
        p[`expected_${sign}`] += bl.amount_cents;
        p[`best_${sign}`] += bl.amount_cents;
      }
      cur = advance(cur);
    }
  }

  // P4: open purchase-ledger rows as receivables (opt-in via settings).
  // A pending Stripe/invoice purchase is committed money expected at
  // created_at + payment terms; paid rows are in the bank anchor already.
  let ledgerOpenTotal = 0;
  if (settings?.include_ledger && !mine) {
    let pq = db
      .from('purchase')
      .select('amount_cents, created_at, team_id, status')
      .eq('status', 'pending');
    if (teamId) pq = pq.eq('team_id', teamId);
    const { data: open, error: pErr } = await pq;
    if (pErr) {
      console.error('[pulse] projection ledger read', pErr);
    } else {
      const terms = settings?.ledger_terms_days ?? 14;
      for (const row of open ?? []) {
        const due = addDays(new Date(String(row.created_at).slice(0, 10) + 'T00:00:00Z'), terms);
        const p = bucketFor(isoDate(due));
        if (p) {
          p.committed_in += row.amount_cents;
          p.expected_in += row.amount_cents;
          p.best_in += row.amount_cents;
          ledgerOpenTotal += row.amount_cents;
        }
      }
    }
  }

  // Reservation rules: % of the period's income, per layer.
  const { data: rules, error: rErr } = await db
    .from('pulse_reservation_rule')
    .select('id, label, percentage, included, sort_order, target_account_id')
    .eq('included', true)
    .order('sort_order', { ascending: true });
  if (rErr) return fail(c, 'projection rules', rErr);
  const totalPct = (rules ?? []).reduce((acc, r) => acc + Number(r.percentage), 0);

  // Running balances.
  const start = bankTotal; // available cash (reserves shown separately)
  let balC = start;
  let balE = start;
  let balB = start;
  for (const p of periods) {
    p.reserved_committed = Math.round((p.committed_in * totalPct) / 100);
    p.reserved_expected = Math.round((p.expected_in * totalPct) / 100);
    balC += p.committed_in - p.committed_out - p.reserved_committed;
    balE += p.expected_in - p.expected_out - p.reserved_expected;
    balB += p.best_in - p.best_out - Math.round((p.best_in * totalPct) / 100);
    p.balance_committed = balC;
    p.balance_expected = balE;
    p.balance_best = balB;
  }

  // The runway sentence: first period each layer dips below zero.
  const dipCommitted = periods.find((p) => p.balance_committed < 0)?.start ?? null;
  const dipExpected = periods.find((p) => p.balance_expected < 0)?.start ?? null;

  // History capture (proposal follow-up, Sjoerd 2026-07-09): when a cadence
  // is set and the last overview is older than it, store this projection
  // (workspace scope only — comparisons compare the whole picture) and
  // prune anything older than two years. Lazy-on-read: fires when someone
  // looks at the cashflow, which in practice is daily.
  if (
    settings?.snapshot_cadence_days &&
    !mine &&
    !teamId &&
    (!settings.snapshot_last_at ||
      Date.now() - new Date(settings.snapshot_last_at).getTime() >
        settings.snapshot_cadence_days * 86400000)
  ) {
    const payload = {
      granularity,
      anchor: { bank_cents: bankTotal, reserve_cents: reserveTotal },
      reservation_pct: totalPct,
      dips_below_zero: { committed: dipCommitted, expected: dipExpected },
      periods,
    };
    const { error: snapErr } = await adminClient.from('pulse_projection_snapshot').insert({
      workspace_id: ctx.workspaceId,
      granularity,
      payload,
    });
    if (snapErr) console.error('[pulse] snapshot capture failed', snapErr);
    else {
      await adminClient
        .from('pulse_settings')
        .update({ snapshot_last_at: new Date().toISOString() })
        .eq('workspace_id', ctx.workspaceId);
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86400000).toISOString();
      await adminClient
        .from('pulse_projection_snapshot')
        .delete()
        .eq('workspace_id', ctx.workspaceId)
        .lt('taken_at', twoYearsAgo);
    }
  }

  return c.json({
    granularity,
    team_id: teamId,
    scope: mine ? 'me' : teamId ? 'team' : 'workspace',
    ledger_open_cents: ledgerOpenTotal,
    currency: settings?.currency ?? 'EUR',
    anchor: { bank_cents: bankTotal, reserve_cents: reserveTotal },
    reservation_pct: totalPct,
    reservation_rules: (rules ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      percentage: Number(r.percentage),
      target_account_id: r.target_account_id ?? null,
    })),
    dips_below_zero: { committed: dipCommitted, expected: dipExpected },
    periods,
  });
});
