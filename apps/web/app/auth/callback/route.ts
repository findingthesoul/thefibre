// HARD RULE §13: This handler runs on Vercel. It is allowed to:
//   - exchange the OAuth code for a Supabase session (Supabase Auth call)
//   - call the EU backend API for any personal data sync
// It is NOT allowed to query our Postgres directly, write activity rows,
// process consent, or store personal data anywhere. All personal-data work
// is delegated to the API on Fly.io / Railway EU.

import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

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
    return NextResponse.redirect(new URL(`/?error=${error?.message ?? 'auth_failed'}`, url.origin));
  }

  // Sync the platform-side user/person record via the EU API.
  // The /sso/resolve endpoint runs resolve_sso_identity() in Postgres.
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const ssoSecret = process.env.SSO_INTERNAL_SECRET;
  const user = data.session.user;
  const provider = user.app_metadata.provider ?? 'google';
  const identity = user.identities?.find((i) => i.provider === provider);

  if (ssoSecret && identity) {
    try {
      const res = await fetch(`${apiBase}/api/v1/sso/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SSO-Secret': ssoSecret,
        },
        body: JSON.stringify({
          // TODO: workspace_id resolution — for now use the default workspace.
          // In multi-tenant production this comes from the invite, magic-link
          // context, or org-domain matching.
          workspace_id: process.env.DEFAULT_WORKSPACE_ID,
          provider,
          provider_user_id: identity.id,
          provider_email: user.email,
          provider_name: user.user_metadata?.full_name ?? user.user_metadata?.name,
          provider_avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
          provider_metadata: identity.identity_data ?? {},
        }),
      });
      if (!res.ok) console.error('sso resolve non-2xx', res.status, await res.text());
      // Refresh the session so the access-token hook re-runs and picks up
      // the newly-created public.user → workspace_id claim.
      await supabase.auth.refreshSession();
    } catch (e) {
      console.error('sso resolve failed', e);
      // Non-fatal — the Supabase session is valid; we'll retry on next sign-in.
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
