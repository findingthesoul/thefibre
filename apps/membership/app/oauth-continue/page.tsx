import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { ContinueSignIn } from './continue-sign-in';

// ---------------------------------------------------------------------------
// OAuth continue — the sign-in leg of the Circle SSO spike
// (docs/spike-circle-sso.md).
//
// GET /api/v1/oauth/authorize 302s here with ?client_id&redirect_uri&state.
// This page requires a Supabase session (any member sign-in — Google or the
// email code; /auth/callback already treats /oauth-continue as a member
// route, no workspace account needed). With a session, it calls
// POST /api/v1/oauth/continue server-side with the session Bearer; the API
// gates on an ACTIVE/GRACE membership, mints a single-use 60s code, and
// hands back the redirect URL — which we send the browser to.
//
// A 403 here is the product working: "Your membership is not active."
// ---------------------------------------------------------------------------

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function OAuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const clientId = first(sp.client_id);
  const redirectUri = first(sp.redirect_uri);
  const state = first(sp.state);

  if (!clientId || !redirectUri) {
    return (
      <Shell title="Sign-in request invalid">
        This link is missing its sign-in details. Please start again from the
        community you were signing in to.
      </Shell>
    );
  }

  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    // Sign in, then come straight back here with the same params.
    const self = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri });
    if (state) self.set('state', state);
    return (
      <Shell title="Sign in to continue">
        <p className="mb-6 text-sm text-neutral-600">
          Sign in with the email address your membership is registered under.
        </p>
        <ContinueSignIn next={`/oauth-continue?${self.toString()}`} />
      </Shell>
    );
  }

  let destination: string | null = null;
  let failure: 'inactive' | 'error' | null = null;
  try {
    const res = await fetch(`${apiBase}/api/v1/oauth/continue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        ...(state ? { state } : {}),
      }),
      cache: 'no-store',
    });
    if (res.ok) {
      const json = (await res.json()) as { redirect?: string };
      destination = json.redirect ?? null;
      if (!destination) failure = 'error';
    } else {
      failure = res.status === 403 ? 'inactive' : 'error';
    }
  } catch {
    failure = 'error';
  }

  // redirect() throws NEXT_REDIRECT — keep it outside the try/catch.
  if (destination) redirect(destination);

  const email = data.session.user.email;
  if (failure === 'inactive') {
    return (
      <Shell title="Your membership is not active">
        <p className="text-sm text-neutral-600 leading-relaxed">
          {email ? (
            <>
              We could not find an active membership for{' '}
              <strong className="text-neutral-900">{email}</strong>.
            </>
          ) : (
            <>We could not find an active membership for your account.</>
          )}{' '}
          If you recently renewed, give it a minute and try again — otherwise
          please renew your membership or contact the organisation that runs
          this community.
        </p>
      </Shell>
    );
  }
  return (
    <Shell title="Something went wrong">
      <p className="text-sm text-neutral-600">
        We could not complete the sign-in. Please try again from the community
        you were signing in to.
      </p>
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-neutral-900 flex items-center justify-center">
      <div className="w-full max-w-sm px-6 py-16">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-8">
          The Fibre
        </div>
        <h1 className="text-xl font-medium tracking-tight mb-4">{title}</h1>
        <div>{children}</div>
      </div>
    </main>
  );
}
