// What this workspace's email looks like, and who it comes from.
//
// Sibling of workspace-billing.ts, and the same rule: admin-or-above, values
// on the workspace row, read everywhere through lib/workspace-brand.ts rather
// than by touching the columns.
//
// The two halves of the sender cost very different things, and the UI says so
// because the API does:
//   from_name     free. A mailbox shows the display name, and the address
//                 behind it can stay the platform's.
//   from_address  needs SPF and DKIM records on that domain, verified with
//                 the mail provider. Set before that is done, mail still
//                 arrives — client.ts falls back to the platform address and
//                 logs the refusal — but it will not be from you.
//   reply_to      free, and the cheap way to be reachable under your own
//                 domain while the DNS is pending.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { can, planFor, needsPlan } from '../lib/plan.js';

export const workspaceBrandRoutes = new Hono();

async function isAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

workspaceBrandRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const { data } = await adminClient
    .from('workspace')
    .select('name, brand_logo_url, email_from_name, email_from_address, email_reply_to, enrolment_note')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  return c.json({
    workspace_name: data?.name ?? null,
    brand_logo_url: data?.brand_logo_url ?? null,
    email_from_name: data?.email_from_name ?? null,
    email_from_address: data?.email_from_address ?? null,
    email_reply_to: data?.email_reply_to ?? null,
    enrolment_note: data?.enrolment_note ?? null,
    editable: await isAdmin(ctx.userId, ctx.workspaceId),
  });
});

// Empty string means "clear it", which is what an emptied input sends. Stored
// as null so every reader's `?? null` fallback keeps working.
const blankToNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

const BrandPatch = z.object({
  brand_logo_url: z.string().max(500).nullable().optional(),
  email_from_name: z.string().max(100).nullable().optional(),
  email_from_address: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .refine((v) => !v || !v.trim() || /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v.trim()), {
      message: 'Must be an email address, e.g. hello@festivaloftrust.com',
    }),
  email_reply_to: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .refine((v) => !v || !v.trim() || /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v.trim()), {
      message: 'Must be an email address',
    }),
  enrolment_note: z.string().max(4000).nullable().optional(),
});

workspaceBrandRoutes.patch('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'only a workspace admin can change how its email looks' }, 403);
  }
  const body = BrandPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  // Your logo and your name in the inbox come with any paid plan. Your own
  // sending DOMAIN is Pro: it is the one that costs us deliverability
  // reputation and support, since it only works once SPF and DKIM are right.
  const wantsBranding =
    body.data.brand_logo_url !== undefined ||
    body.data.email_from_name !== undefined ||
    body.data.email_reply_to !== undefined;
  if (wantsBranding && !(await can(ctx.workspaceId, 'email_branding'))) {
    const plan = await planFor(ctx.workspaceId);
    return c.json({ error: needsPlan('Your own logo and sender name on email', 'Starter'), plan: plan.name }, 402);
  }
  if (
    body.data.email_from_address !== undefined &&
    (body.data.email_from_address ?? '').trim() &&
    !(await can(ctx.workspaceId, 'custom_sender_domain'))
  ) {
    const plan = await planFor(ctx.workspaceId);
    return c.json({ error: needsPlan('Sending from your own domain', 'Pro'), plan: plan.name }, 402);
  }

  const patch: Record<string, unknown> = {};
  for (const key of [
    'brand_logo_url',
    'email_from_name',
    'email_from_address',
    'email_reply_to',
    'enrolment_note',
  ] as const) {
    if (body.data[key] !== undefined) patch[key] = blankToNull(body.data[key]);
  }
  if (!Object.keys(patch).length) return c.json({ ok: true, unchanged: true });

  const { error } = await adminClient.from('workspace').update(patch).eq('id', ctx.workspaceId);
  if (error) {
    console.error('[workspace-brand PATCH] update failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true });
});
