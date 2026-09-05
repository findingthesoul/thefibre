// The auth-callback route, once (extraction phase 4). The six copies had
// quietly drifted apart — meet alone handled the verifyOtp arrival path and
// the magic-link provider mapping; thread alone bypassed the access check
// for its participant space. This is the superset; each app's route.ts
// becomes a few lines of wiring:
//
//   import { NextResponse, type NextRequest } from 'next/server';
//   import { serverSupabase } from '@/lib/supabase/server';
//   import { createAuthCallback } from '@thefibre/shared/auth-callback';
//   export const GET = createAuthCallback({
//     getSupabase: serverSupabase,
//     redirect: (u) => NextResponse.redirect(u),
//     env: process.env,
//     publicPrefixes: ['/my'],            // thread only
//   });
//
// No Next dependency here: the request is read via the standard URL, the
// redirect response is injected.

type SupabaseishSession = {
  user: {
    email?: string | undefined;
    app_metadata: { provider?: string };
    user_metadata?: Record<string, unknown> | undefined;
    identities?:
      | { provider: string; id: string; identity_data?: Record<string, unknown> | null }[]
      | undefined;
  };
};

type Supabaseish = {
  auth: {
    exchangeCodeForSession: (
      code: string,
    ) => Promise<{ data: { session: SupabaseishSession | null }; error: { message: string } | null }>;
    getSession: () => Promise<{ data: { session: SupabaseishSession | null } }>;
    refreshSession: () => Promise<unknown>;
  };
};

type AccessCheck =
  | { status: 'existing' | 'approved'; workspace_id: string }
  | { status: 'pending' | 'denied' | 'unknown' };

export function createAuthCallback({
  getSupabase,
  redirect,
  env = {},
  publicPrefixes = [],
  defaultNext = '/dashboard',
}: {
  getSupabase: () => Promise<Supabaseish>;
  redirect: (url: URL | string) => Response;
  /** Pass process.env — the package reads no globals (the appUrl pattern). */
  env?: Record<string, string | undefined>;
  /** `next` paths that skip the workspace access check — e.g. thread's
   *  participant space ['/my']: visitors sign in to see their enrolments,
   *  no workspace membership required. */
  publicPrefixes?: string[];
  defaultNext?: string;
}) {
  return async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const next = url.searchParams.get('next') ?? defaultNext;

    const supabase = await getSupabase();

    // Two arrival paths: PKCE code (OAuth or magic-link click) OR an
    // already-established session from verifyOtp() running client-side.
    let session: SupabaseishSession;
    if (code) {
      const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !exchange.session) {
        return redirect(new URL(`/?error=${error?.message ?? 'auth_failed'}`, url.origin));
      }
      session = exchange.session;
    } else {
      const { data: sessData } = await supabase.auth.getSession();
      if (!sessData.session) {
        return redirect(new URL('/?error=no_session', url.origin));
      }
      session = sessData.session;
    }

    if (publicPrefixes.some((p) => next.startsWith(p))) {
      return redirect(new URL(next, url.origin));
    }

    const apiBase = env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
    const ssoSecret = env.SSO_INTERNAL_SECRET;
    const user = session.user;
    const email = user.email;
    // Supabase records magic-link sign-ins as provider='email'. Map to the
    // platform's enum value 'magic_link' so the SSO resolver accepts it.
    const rawProvider = user.app_metadata.provider ?? 'google';
    const provider = rawProvider === 'email' ? 'magic_link' : rawProvider;
    const identity =
      user.identities?.find((i) => i.provider === rawProvider) ?? user.identities?.[0];

    if (!ssoSecret || !email) {
      return redirect(new URL(next, url.origin));
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
        return redirect(new URL('/no-access', url.origin));
      }
      access = (await r.json()) as AccessCheck;
    } catch {
      return redirect(new URL('/no-access', url.origin));
    }

    if (access.status !== 'existing' && access.status !== 'approved') {
      // No Fibre account yet — send them to apply on the Fibre side.
      const fibreUrl = env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.app';
      return redirect(`${fibreUrl}/request-access`);
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
            provider_name:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined),
            provider_avatar_url:
              (user.user_metadata?.avatar_url as string | undefined) ??
              (user.user_metadata?.picture as string | undefined),
            provider_metadata: identity.identity_data ?? {},
          }),
        });
        await supabase.auth.refreshSession();
      } catch {
        // Non-fatal — session is valid; retry on next sign-in.
      }
    }

    return redirect(new URL(next, url.origin));
  };
}
