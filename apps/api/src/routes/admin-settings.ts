// /api/v1/admin/settings — operator switches, super-admin only.
// Today exactly one: auto_approve_signups (the signup door). Keys are
// allow-listed so a typo can't create a phantom setting.

import { Hono } from 'hono';
import { z } from 'zod';
import { getSetting, setSetting } from '../lib/platform-settings.js';
import { isSuperAdminUser } from '../lib/super-admin.js';

export const adminSettingsRoutes = new Hono();

const KNOWN = ['auto_approve_signups'] as const;

adminSettingsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const settings: Record<string, unknown> = {};
  for (const key of KNOWN) settings[key] = await getSetting(key, key === 'auto_approve_signups');
  return c.json({ settings });
});

const PatchBody = z.object({
  key: z.enum(KNOWN),
  value: z.boolean(),
});

adminSettingsRoutes.patch('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const body = PatchBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  await setSetting(body.data.key, body.data.value);
  return c.json({ ok: true, [body.data.key]: body.data.value });
});
