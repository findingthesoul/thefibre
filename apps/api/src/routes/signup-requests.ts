import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import { autoApproveSignups } from '../lib/platform-settings.js';
import { approveSignup } from '../lib/signup-approval.js';

export const signupRequestsRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/v1/signup-requests — public, no auth.
// The applicant has no account yet. RLS allows the insert from anon/auth role
// only when status='pending'. We use the admin client here to bypass JWT-less
// PostgREST quirks; the WITH CHECK still applies at SQL level.
// ---------------------------------------------------------------------------
const CreateBody = z.object({
  email: z.string().email().toLowerCase(),
  full_name: z.string().min(1).max(200),
  organisation_name: z.string().max(200).nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  /** The package picked on /pricing or the form. Advisory — see migration. */
  desired_plan: z.string().max(40).nullable().optional(),
});

signupRequestsRoutes.post('/', async (c) => {
  const body = CreateBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = c.req.header('user-agent') ?? null;

  // Validate the plan against the catalogue, but never fail a signup over it —
  // an unknown id (stale link, renamed plan) degrades to "not sure yet".
  let desiredPlan: string | null = null;
  if (body.data.desired_plan) {
    const { data: plan } = await adminClient
      .from('billing_plan')
      .select('id')
      .eq('id', body.data.desired_plan)
      .maybeSingle();
    desiredPlan = plan?.id ?? null;
  }

  const { data: created, error } = await adminClient
    .from('signup_request')
    .insert({
      ...body.data,
      desired_plan: desiredPlan,
      status: 'pending',
      ip_address: ip,
      user_agent: ua,
    })
    .select('id, email, full_name, organisation_name, desired_plan')
    .single();

  if (error) {
    // Unique-violation on the partial index means there's already a
    // pending or approved request for this email. Treat as idempotent success
    // so we don't leak that info to the caller.
    if (error.code === '23505') {
      return c.json({ ok: true, already_requested: true });
    }
    console.error('[signup-requests POST] insert failed', error);
    return c.json({ error: 'failed to create request' }, 500);
  }

  // Signup v2: with the door open (the default), approval happens right here —
  // workspace created, plan apps on, welcome email sent — and the form can
  // say "you're in, sign in now" instead of "we'll be in touch". The
  // super-admin toggle at /admin/access-requests restores the velvet rope.
  if (created && (await autoApproveSignups())) {
    const result = await approveSignup(created, null, 'auto-approved (signup v2)');
    if ('workspaceId' in result) {
      return c.json({ ok: true, approved: true });
    }
    // Approval hiccup: the request row still exists as pending — the admin
    // screen catches it, the applicant sees the classic "we'll be in touch".
    console.error('[signup-requests POST] auto-approve failed', result.error);
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin endpoints — RLS enforces is_platform_admin().
// ---------------------------------------------------------------------------
signupRequestsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const status = c.req.query('status') ?? 'pending';
  const { data, error } = await db
    .from('signup_request')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const DecideBody = z.object({
  action: z.enum(['approve', 'deny']),
  decision_notes: z.string().max(1000).nullable().optional(),
});

signupRequestsRoutes.patch('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const body = DecideBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { action, decision_notes } = body.data;

  // Load the request (RLS gates this — only admins see it)
  const { data: reqRow, error: rErr } = await db
    .from('signup_request')
    .select('*')
    .eq('id', id)
    .single();
  if (rErr || !reqRow) return c.json({ error: 'request not found' }, 404);
  if (reqRow.status !== 'pending') {
    return c.json({ error: `request is already ${reqRow.status}` }, 409);
  }

  if (action === 'deny') {
    const { error } = await db
      .from('signup_request')
      .update({
        status: 'denied',
        decided_by: ctx.userId,
        decided_at: new Date().toISOString(),
        decision_notes: decision_notes ?? null,
      })
      .eq('id', id);
    if (error) {
      console.error('[signup-requests PATCH deny]', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ ok: true });
  }

  // APPROVE — shared implementation with the auto-approve path
  // (lib/signup-approval.ts): workspace + plan apps + welcome email. The
  // user/person rows are still created at first sign-in via sso/resolve.
  const result = await approveSignup(reqRow, ctx.userId, decision_notes ?? null);
  if ('error' in result) return c.json({ error: result.error }, 500);
  return c.json({ ok: true, workspace_id: result.workspaceId });
});
