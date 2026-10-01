import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createSessionMiddleware } from '@thefibre/shared/supabase-session';

// Keeps a signed-in session alive for server-rendered pages: an access token
// lasts an hour, and middleware is the one place in Next that can both read
// the request's cookies and write the refreshed ones onto the response.
//
// The body is in @thefibre/shared/supabase-session, one copy for every app.
// Next requires THIS file at this path per app, and reads `config` statically,
// so the matcher below has to be a literal here; supabase-session.test.ts
// holds it against the shared one.
const forwarded = new WeakMap<NextRequest, Headers>();

export const middleware = createSessionMiddleware({
  createClient: (url, key, options) => createServerClient(url, key, options),
  // Expose the requested path+query to server components (the (app) layout
  // reads it to build a `next=` return URL when it bounces an unsigned visitor
  // to sign-in — without it, /connect's OAuth params were lost and a connected
  // assistant could never complete consent). headers() in a server component
  // reads these rewritten request headers.
  //
  // The copy is taken ONCE per request and reused when the factory asks again
  // after a refresh — exactly what this file did before it moved to the
  // shared factory (v1.98.0 changes no behaviour). It means the header copy
  // predates the refreshed cookie; the shared module says why that matters.
  respond: (request: NextRequest) => {
    let requestHeaders = forwarded.get(request);
    if (!requestHeaders) {
      requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-fibre-path', request.nextUrl.pathname + request.nextUrl.search);
      forwarded.set(request, requestHeaders);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  },
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
