// Meet auth callback — same flow as The Fibre's, except the destination
// after sign-in is Meet's dashboard, not Fibre's.

import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

type AccessCheck =
  | { status: 'existing' | 'approved'; workspace_id: string }
  | { status: 'pending' | 'denied' | 'unknown' };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  const supabase = await serverSupabase();

  // Two arrival paths: PKCE code (OAuth or magic-link click) OR an
  // already-established session from verifyOtp() running client-side.
  let session;
  if (code) {
    const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !exchange.session) {
      return NextResponse.redirect(
        new URL(`/?error=${error?.message ?? 'auth_failed'}`, url.origin),
      );
    }
    session = exchange.session;
  } else {
    const { data: sessData } = await supabase.auth.getSession();
    if (!sessData.session) {
      return NextResponse.redirect(new URL('/?error=no_session', url.origin));
    }
    session = sessData.session;
  }
  const data = { session };

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const ssoSecret = process.env.SSO_INTERNAL_SECRET;
  const user = data.session.user;
  const email = user.email;
  // Supabase records magic-link sign-ins as provider='email'. Map to the
  // platform's enum value 'magic_link' so the SSO resolver accepts it.
  const rawProvider = user.app_metadata.provider ?? 'google';
  const provider = rawProvider === 'email' ? 'magic_link' : rawProvider;
  const identity =
    user.identities?.find((i) => i.provider === rawProvider) ??
    user.identities?.[0];

  if (!ssoSecret || !email) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  let access: AccessCheck;
  try {
    const r = await fetch(`${apiBase}/api/v1/sso/access-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SSO-Secret': ssoSecret },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
    if (!r.ok) {
      return NextResponse.redirect(new URL('/no-access', url.origin));
    }
    access = (await r.json()) as AccessCheck;
  } catch {
    return NextResponse.redirect(new URL('/no-access', url.origin));
  }

  if (access.status !== 'existing' && access.status !== 'approved') {
    // No Fibre account yet — send them to apply on the Fibre side.
    const fibreUrl = process.env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.app';
    return NextResponse.redirect(`${fibreUrl}/request-access`);
  }

  // Resolve / link the SSO identity into their workspace via the Fibre API.
  if (identity) {
    try {
      await fetch(`${apiBase}/api/v1/sso/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SSO-Secret': ssoSecret },
        body: JSON.stringify({
          workspace_id: access.workspace_id,
          provider,
          provider_user_id: identity.id,
          provider_email: user.email,
          provider_name: user.user_metadata?.full_name ?? user.user_metadata?.name,
          provider_avatar_url:
            user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
          provider_metadata: identity.identity_data ?? {},
        }),
      });
      await supabase.auth.refreshSession();
    } catch {
      // Non-fatal — session is valid; retry on next sign-in.
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
