// Supabase Auth "Send Email" webhook handler.
//
// When configured in Supabase Auth → Hooks → Send Email Hook, every auth
// email Supabase would have sent (signup confirm, magic link / OTP, invite,
// password recovery, email change, reauthentication) is delegated here.
// We render it with our branding from packages/shared and send via Resend.
//
// Signature verification: Supabase signs with the "standard webhooks" spec.
// We verify HMAC-SHA256(secret, "<webhook-id>.<webhook-timestamp>.<body>")
// against the value in the `webhook-signature` header. Supabase displays the
// secret as `v1,whsec_<base64>` — we accept any of:
//   v1,whsec_<base64>
//   whsec_<base64>
//   <base64>
// so it's safe to copy-paste from the dashboard.

import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { sendEmail } from '../lib/email/client.js';
import { renderAuthEmail, type AuthEmailBrand } from '../lib/email/auth-templates.js';
import { platformEmailLocale } from '../lib/email/platform-i18n.js';
import { adminClient } from '../db.js';
import { getWorkspaceBrand } from '../lib/workspace-brand.js';

// Whose email is this? A platform user signs in to The Fibre — platform
// brand. An address that is ONLY a person (member/participant) in exactly
// one workspace belongs to that COMMUNITY — its brand fronts the email
// (Sjoerd, 2026-09-06). Ambiguous (several workspaces) or unknown →
// platform. Never fatal: branding must not block a sign-in code.
async function resolveAuthBrand(
  email: string,
): Promise<{ brand: AuthEmailBrand | null; from: { fromName?: string; fromAddress?: string; replyTo?: string } }> {
  try {
    const lower = email.toLowerCase();
    const { data: platformUser } = await adminClient
      .from('user')
      .select('id')
      .ilike('email', lower)
      .is('deleted_at', null)
      .maybeSingle();
    if (platformUser) return { brand: null, from: {} };
    const { data: persons } = await adminClient
      .from('person')
      .select('workspace_id')
      .ilike('email', lower)
      .is('deleted_at', null)
      .limit(5);
    const workspaceIds = [...new Set((persons ?? []).map((p) => p.workspace_id))];
    if (workspaceIds.length !== 1) return { brand: null, from: {} };
    const wb = await getWorkspaceBrand(workspaceIds[0]);
    const { data: ws } = await adminClient
      .from('workspace')
      .select('name')
      .eq('id', workspaceIds[0])
      .maybeSingle();
    return {
      brand: { name: wb.fromName ?? ws?.name ?? null, logoUrl: wb.logoUrl ?? null },
      from: {
        ...(wb.fromName ? { fromName: wb.fromName } : {}),
        ...(wb.fromAddress ? { fromAddress: wb.fromAddress } : {}),
        ...(wb.replyTo ? { replyTo: wb.replyTo } : {}),
      },
    };
  } catch (e) {
    console.warn('[auth-hook] brand resolution failed — platform brand', e);
    return { brand: null, from: {} };
  }
}

export const authHookRoutes = new Hono();

const HookBody = z.object({
  user: z.object({
    id: z.string().optional(),
    email: z.string().email(),
  }),
  email_data: z.object({
    token: z.string().optional(),
    token_hash: z.string().optional(),
    token_new: z.string().optional(),
    token_hash_new: z.string().optional(),
    redirect_to: z.string().optional(),
    site_url: z.string().optional(),
    email_action_type: z
      .enum([
        'signup',
        'login',
        'magiclink',
        'invite',
        'recovery',
        'email_change_new',
        'email_change_current',
        'email_change',
        'reauthentication',
      ])
      .optional(),
  }),
});

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verifyStandardWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  // standardwebhooks header format:
  //   webhook-id: msg_xxx
  //   webhook-timestamp: <unix seconds>
  //   webhook-signature: v1,<base64>  (space-separated when multiple versions)
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sig = headers.get('webhook-signature');
  if (!id || !ts || !sig) return false;

  // Accept v1,whsec_xxx, whsec_xxx, or bare xxx — strip the prefixes that
  // Supabase's dashboard displays alongside the secret.
  const cleaned = secret
    .replace(/^v\d+,/, '')   // strip "v1,"
    .replace(/^whsec_/, ''); // strip "whsec_"
  const secretBytes = Buffer.from(cleaned, 'base64');
  const signedPayload = `${id}.${ts}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes)
    .update(signedPayload)
    .digest('base64');

  // The header may include multiple signatures separated by spaces:
  // "v1,abc v1a,def" — we accept if any matches.
  for (const candidate of sig.split(' ')) {
    const [, value] = candidate.split(',');
    if (value && timingSafeStringEqual(value, expected)) return true;
  }
  return false;
}

authHookRoutes.post('/email', async (c) => {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error('[auth-hook] SUPABASE_AUTH_HOOK_SECRET not configured');
    return c.json({ error: 'hook not configured' }, 500);
  }

  // Read raw body BEFORE parsing JSON (signature is over the raw payload).
  const rawBody = await c.req.text();
  if (!verifyStandardWebhook(rawBody, c.req.raw.headers, secret)) {
    console.error(
      '[auth-hook] invalid signature',
      JSON.stringify({
        hasId: !!c.req.raw.headers.get('webhook-id'),
        hasTs: !!c.req.raw.headers.get('webhook-timestamp'),
        hasSig: !!c.req.raw.headers.get('webhook-signature'),
        sigPrefix: c.req.raw.headers.get('webhook-signature')?.slice(0, 8),
        bodyLen: rawBody.length,
        secretLooksPrefixed:
          secret.startsWith('v1,') || secret.startsWith('whsec_'),
      }),
    );
    return c.json({ error: 'invalid signature' }, 401);
  }

  let parsed;
  try {
    parsed = HookBody.parse(JSON.parse(rawBody));
  } catch (e) {
    console.error('[auth-hook] body parse failed', e);
    return c.json({ error: 'bad body' }, 400);
  }

  const { user, email_data } = parsed;
  const actionRaw = email_data.email_action_type ?? 'magiclink';
  // Supabase sometimes uses 'email_change'; we treat it like a new-email confirm.
  const action =
    actionRaw === 'email_change' ? 'email_change_new' : actionRaw;

  // Build the confirmation URL the user would have received in the default
  // email. Supabase doesn't pre-build it for us when using the hook; the
  // /auth/verify endpoint at the project's site_url does it for us.
  let confirmationUrl: string | null = null;
  if (email_data.token_hash && email_data.site_url) {
    const u = new URL('/auth/v1/verify', email_data.site_url);
    u.searchParams.set('token', email_data.token_hash);
    u.searchParams.set('type', actionRaw);
    if (email_data.redirect_to) {
      u.searchParams.set('redirect_to', email_data.redirect_to);
    }
    confirmationUrl = u.toString();
  } else if (email_data.redirect_to) {
    confirmationUrl = email_data.redirect_to;
  }

  // The recipient's language (i18n P2): identity_profile.locale where they
  // have one, English otherwise — the ONE resolver every platform-side
  // email shares. Non-fatal: locale is a nicety, never block an OTP on it.
  let locale: string | null = null;
  try {
    locale = await platformEmailLocale(user.email);
  } catch {
    /* fall through to English */
  }

  const { brand, from } = await resolveAuthBrand(user.email);

  const rendered = renderAuthEmail(
    action,
    {
      email: user.email,
      token: email_data.token ?? null,
      confirmationUrl,
      validityMinutes: 30,
    },
    locale,
    brand,
  );

  try {
    await sendEmail({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      ...from,
    });
  } catch (e) {
    console.error('[auth-hook] send failed', e);
    return c.json({ error: 'send failed' }, 500);
  }

  return c.json({ ok: true });
});
