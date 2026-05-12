import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

/**
 * SSO callback — receives provider profile after Supabase Auth has verified
 * the OAuth flow. Resolves to a Fibre user.id by:
 *   1. provider_user_id match → user found, mark "matched"
 *   2. email match           → user found, link new provider, mark "linked"
 *   3. neither               → create person + user + provider link, "created"
 *
 * See: docs/fibre-technical-brief-v0.3.md §7
 *
 * The actual JWT issuance is handled by Supabase Auth — this endpoint
 * synchronises the platform-side user/person/identity records after auth.
 */
export const ssoRoutes = new Hono();

const SsoResolve = z.object({
  workspace_id: z.string().uuid(),
  provider: z.enum(['google', 'microsoft', 'linkedin', 'magic_link']),
  provider_user_id: z.string().min(1).max(255),
  provider_email: z.string().email(),
  provider_name: z.string().max(200).optional(),
  provider_avatar_url: z.string().url().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
});

ssoRoutes.post('/resolve', async (c) => {
  // This endpoint is callable only by trusted server-to-server flows.
  // For now, require a shared secret header.
  const secret = c.req.header('x-sso-secret');
  if (!secret || secret !== process.env.SSO_INTERNAL_SECRET) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const body = SsoResolve.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data, error } = await adminClient.rpc('resolve_sso_identity', {
    p_workspace_id: body.data.workspace_id,
    p_provider: body.data.provider,
    p_provider_user_id: body.data.provider_user_id,
    p_provider_email: body.data.provider_email,
    p_provider_name: body.data.provider_name ?? null,
    p_provider_avatar_url: body.data.provider_avatar_url ?? null,
    p_provider_metadata: body.data.provider_metadata ?? {},
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data?.[0] ?? null);
});
