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

function requireSsoSecret(c: import('hono').Context) {
  const secret = c.req.header('x-sso-secret');
  return secret && secret === process.env.SSO_INTERNAL_SECRET;
}

ssoRoutes.post('/resolve', async (c) => {
  if (!requireSsoSecret(c)) return c.json({ error: 'forbidden' }, 403);

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
  if (error) {
    // Log it. This route failing is invisible from the outside: the auth
    // callback deliberately treats a resolve failure as non-fatal, so the user
    // lands in the app with a valid Supabase session, no public.user row, and
    // every subsequent API call 401s. Without this line the only trace is a
    // bare "500" in the access log.
    //
    // That is exactly how a 42702 in resolve_sso_identity went unnoticed from
    // 2026-05-16 until the first new workspace was created. See CLAUDE.md,
    // "Reviewer's note".
    console.error('[sso/resolve] resolve_sso_identity failed', {
      workspace_id: body.data.workspace_id,
      provider: body.data.provider,
      email: body.data.provider_email,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message }, 500);
  }
  return c.json(data?.[0] ?? null);
});

// ---------------------------------------------------------------------------
// POST /sso/access-check — given an email, returns one of:
//   { status: 'existing',  workspace_id }      user.email already exists
//   { status: 'approved',  workspace_id }      signup_request approved
//   { status: 'pending'   }                    signup_request awaiting review
//   { status: 'denied'    }                    signup_request denied
//   { status: 'unknown'   }                    no record at all
//
// Called by the web auth callback to decide whether to (a) call /sso/resolve
// into the right workspace, or (b) bounce the user to /access-pending.
// ---------------------------------------------------------------------------
const AccessCheck = z.object({ email: z.string().email().toLowerCase() });

ssoRoutes.post('/access-check', async (c) => {
  if (!requireSsoSecret(c)) return c.json({ error: 'forbidden' }, 403);
  const body = AccessCheck.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const email = body.data.email;

  // 1. Does a user already exist for this email? (returning user)
  //
  // ORDERED, LIMIT 1 — not maybeSingle(). Since v0.19.1 one person can hold a
  // user row in several workspaces, and maybeSingle() treats more than one row
  // as an ERROR: `data` comes back null, this reads as "no account", and a
  // returning member is shown the request-access form. That is precisely what
  // happened to the first person to gain a second membership.
  //
  // Which workspace is returned barely matters, and deliberately so: the
  // callback resolves the identity into it, then refreshes the session, and the
  // access-token hook is what actually decides the active workspace — applying
  // the person's own choice. This only has to name a workspace they really
  // belong to, and the earliest is the same fallback the hook uses, so the two
  // never disagree about where someone lands on a first sign-in.
  const { data: user } = await adminClient
    .from('user')
    .select('workspace_id')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (user?.workspace_id) {
    return c.json({ status: 'existing', workspace_id: user.workspace_id });
  }

  // 2. Most recent signup_request for this email (any status)
  const { data: req } = await adminClient
    .from('signup_request')
    .select('status, workspace_id')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) return c.json({ status: 'unknown' });
  if (req.status === 'approved' && req.workspace_id) {
    return c.json({ status: 'approved', workspace_id: req.workspace_id });
  }
  if (req.status === 'pending') return c.json({ status: 'pending' });
  if (req.status === 'denied') return c.json({ status: 'denied' });
  return c.json({ status: 'unknown' });
});
