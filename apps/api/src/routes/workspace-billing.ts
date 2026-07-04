// Workspace-level payment settings — the SPoT's second half (the first is
// user_profile). Admin-or-above only; values live on the workspace row.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const workspaceBillingRoutes = new Hono();

async function isAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

workspaceBillingRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const { data } = await adminClient
    .from('workspace')
    .select('stripe_account_id, invoice_details')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  return c.json({
    stripe_account_id: data?.stripe_account_id ?? null,
    invoice_details: data?.invoice_details ?? null,
    editable: await isAdmin(ctx.userId, ctx.workspaceId),
  });
});

const BillingPatch = z.object({
  stripe_account_id: z
    .string()
    .max(64)
    .regex(/^(acct_[A-Za-z0-9]+)?$/, 'Must be a Stripe account id like acct_…')
    .nullable()
    .optional(),
  invoice_details: z
    .object({
      legal_name: z.string().max(200).optional(),
      address: z.string().max(500).optional(),
      tax_no: z.string().max(60).optional(),
    })
    .nullable()
    .optional(),
});

workspaceBillingRoutes.patch('/', async (c) => {
  const body = BillingPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'workspace payment settings need an admin role' }, 403);
  }
  const patch: Record<string, unknown> = { ...body.data };
  if (patch.stripe_account_id === '') patch.stripe_account_id = null;
  const { data, error } = await adminClient
    .from('workspace')
    .update(patch)
    .eq('id', ctx.workspaceId)
    .select('stripe_account_id, invoice_details')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
