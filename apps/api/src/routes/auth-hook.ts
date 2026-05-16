// Supabase Auth "Send Email" webhook handler.
//
// When configured in Supabase Auth → Hooks → Send Email Hook, every auth
// email Supabase would have sent (signup confirm, magic link / OTP, invite,
// password recovery, email change, reauthentication) is delegated here.
// We render it with our branding from packages/shared and send via Resend.
//
// Signature verification: Supabase signs with the "standard webhooks" spec.
// We verify HMAC-SHA256(secret, "<webhook-id>.<webhook-timestamp>.<body>")
// against the value in the `webhook-signature` header. The secret is set in
// Supabase as `v1,whsec_…`; we store just the whsec_ part as
// SUPABASE_AUTH_HOOK_SECRET on Fly.

import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { sendEmail } from '../lib/email/client.js';
import { renderAuthEmail } from '../lib/email/auth-templates.js';

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

  // Strip the leading "whsec_" if present (Supabase stores the secret with this prefix).
  const secretBytes = Buffer.from(
    secret.replace(/^whsec_/, ''),
    'base64',
  );
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

  const rendered = renderAuthEmail(action, {
    email: user.email,
    token: email_data.token ?? null,
    confirmationUrl,
    validityMinutes: 30,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  } catch (e) {
    console.error('[auth-hook] send failed', e);
    return c.json({ error: 'send failed' }, 500);
  }

  return c.json({ ok: true });
});
