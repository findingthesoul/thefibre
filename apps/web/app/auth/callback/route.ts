// HARD RULE §13: This handler runs on Vercel. It is allowed to:
//   - exchange the OAuth code for a Supabase session (Supabase Auth call)
//   - call the EU backend API for any personal data sync
// It is NOT allowed to query our Postgres directly, write activity rows,
// process consent, or store personal data anywhere. All personal-data work
// is delegated to the API on Fly.io / Railway EU.

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

  // If our internal secret isn't configured we can't check access status —
  // fall back to the legacy default-workspace behaviour so dev doesn't break.
  if (!ssoSecret || !email) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Step 1 — what's this email's status?
  let access: AccessCheck;
  try {
    const r = await fetch(`${apiBase}/api/v1/sso/access-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SSO-Secret': ssoSecret },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
    if (!r.ok) {
      console.error('access-check non-2xx', r.status, await r.text());
      return NextResponse.redirect(new URL('/access-pending', url.origin));
    }
    access = (await r.json()) as AccessCheck;
  } catch (e) {
    console.error('access-check failed', e);
    return NextResponse.redirect(new URL('/access-pending', url.origin));
  }

  if (access.status === 'pending') {
    return NextResponse.redirect(new URL('/access-pending', url.origin));
  }
  if (access.status === 'denied') {
    return NextResponse.redirect(new URL('/access-pending?status=denied', url.origin));
  }
  if (access.status === 'unknown') {
    return NextResponse.redirect(new URL('/access-pending?status=unknown', url.origin));
  }

  // existing or approved — we have a workspace_id. Resolve the SSO identity
  // into that workspace (this also creates the user/person row the first time
  // an approved applicant signs in).
  if (access.status !== 'existing' && access.status !== 'approved') {
    return NextResponse.redirect(new URL('/access-pending', url.origin));
  }
  const workspaceId = access.workspace_id;
  if (identity) {
    try {
      const res = await fetch(`${apiBase}/api/v1/sso/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SSO-Secret': ssoSecret },
        body: JSON.stringify({
          workspace_id: workspaceId,
          provider,
          provider_user_id: identity.id,
          provider_email: user.email,
          provider_name: user.user_metadata?.full_name ?? user.user_metadata?.name,
          provider_avatar_url:
            user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
          provider_metadata: identity.identity_data ?? {},
        }),
      });
      if (!res.ok) console.error('sso resolve non-2xx', res.status, await res.text());
      // Refresh the session so the access-token hook re-runs and picks up
      // the (possibly newly-created) public.user → workspace_id claim.
      await supabase.auth.refreshSession();
    } catch (e) {
      console.error('sso resolve failed', e);
      // Non-fatal — the Supabase session is valid; we'll retry on next sign-in.
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
