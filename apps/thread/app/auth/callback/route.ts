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

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', url.origin));
  }

  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(
      new URL(`/?error=${error?.message ?? 'auth_failed'}`, url.origin),
    );
  }

  // Participant space (/my): visitors sign in to see their enrolments — no
  // workspace membership required, so skip the access-check gating entirely.
  if (next.startsWith('/my')) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const ssoSecret = process.env.SSO_INTERNAL_SECRET;
  const user = data.session.user;
  const email = user.email;
  const provider = user.app_metadata.provider ?? 'google';
  const identity = user.identities?.find((i) => i.provider === provider);

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
