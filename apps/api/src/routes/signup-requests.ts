import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import { sendEmail } from '../lib/email/client.js';
import { renderWorkspaceReadyEmail } from '../lib/email/platform-templates.js';

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
});

signupRequestsRoutes.post('/', async (c) => {
  const body = CreateBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = c.req.header('user-agent') ?? null;

  const { error } = await adminClient.from('signup_request').insert({
    ...body.data,
    status: 'pending',
    ip_address: ip,
    user_agent: ua,
  });

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

  // APPROVE — create the workspace, then mark the request as approved with
  // its workspace_id. The user/person rows themselves are created at first
  // sign-in via the existing sso/resolve flow (which now uses this workspace
  // when an approved request exists for the email).
  //
  // Done with the admin client so we don't depend on JWT-scoped RLS for
  // cross-tenant writes (we're creating a brand-new workspace, by definition
  // outside the admin's own workspace).
  const slugBase = (reqRow.organisation_name ?? reqRow.email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
  const wsName = reqRow.organisation_name ?? reqRow.full_name ?? reqRow.email;

  // No `plan` here: the text column is legacy (the authoritative plan is
  // workspace_subscription, created by the on-insert trigger) and writing it
  // kept it looking alive.
  const { data: ws, error: wsErr } = await adminClient
    .from('workspace')
    .insert({ slug, name: wsName })
    .select('id')
    .single();
  if (wsErr || !ws) {
    console.error('[signup-requests PATCH approve] workspace create failed', wsErr);
    return c.json({ error: wsErr?.message ?? 'workspace create failed' }, 500);
  }

  const { error: uErr } = await adminClient
    .from('signup_request')
    .update({
      status: 'approved',
      workspace_id: ws.id,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
      decision_notes: decision_notes ?? null,
    })
    .eq('id', id);
  if (uErr) {
    console.error('[signup-requests PATCH approve] update failed', uErr);
    return c.json({ error: uErr.message }, 500);
  }

  // The welcome. /request-access and /access-pending have promised "we'll
  // email you when your workspace is ready" since v0.14 — this is that email.
  // Fire-and-forget: the approval already happened, and a mail hiccup must
  // not make the button look like it failed (the applicant can still sign in).
  const welcome = renderWorkspaceReadyEmail({
    fullName: reqRow.full_name ?? '',
    workspaceName: wsName,
  });
  void sendEmail({ to: reqRow.email, ...welcome }).catch((e) =>
    console.error('[signup-requests PATCH approve] welcome email failed', e),
  );

  return c.json({ ok: true, workspace_id: ws.id });
});
