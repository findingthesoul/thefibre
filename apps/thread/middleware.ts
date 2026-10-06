import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createSessionMiddleware } from '@thefibre/shared/supabase-session';
import { tenantHostStep } from '@thefibre/shared/tenant-host';
import { appUrl, stagingAppUrl } from '@thefibre/shared';

// Keeps a signed-in session alive for server-rendered pages: an access token
// lasts an hour, and middleware is the one place in Next that can both read
// the request's cookies and write the refreshed ones onto the response.
//
// The body is in @thefibre/shared/supabase-session, one copy for every app.
// Next requires THIS file at this path per app, and reads `config` statically,
// so the matcher below has to be a literal here; supabase-session.test.ts
// holds it against the shared one.
//
// First step, before the session: a customer's own host (events.soul.com)
// for the public event pages — @thefibre/shared/tenant-host,
// docs/domain-package.md part 2. On our own hosts it does nothing at all.
const canonicalOrigin = appUrl('the-thread', { NEXT_PUBLIC_THREAD_URL: process.env.NEXT_PUBLIC_THREAD_URL });
export const middleware = createSessionMiddleware({
  createClient: (url, key, options) => createServerClient(url, key, options),
  respond: (request: NextRequest) => NextResponse.next({ request }),
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
  before: tenantHostStep<NextRequest, NextResponse>({
    app: 'the-thread',
    canonicalOrigin,
    ownHosts: [new URL(canonicalOrigin).host, new URL(stagingAppUrl('the-thread')).host],
    apiBase: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
    rewrite: (request, pathname, tenant) => {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      const headers = new Headers(request.headers);
      headers.set('x-tenant-host', request.nextUrl.host);
      headers.set('x-tenant-root', tenant.root_slug);
      return NextResponse.rewrite(url, { request: { headers } });
    },
    redirect: (url) => NextResponse.redirect(url, 307),
  }),
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
