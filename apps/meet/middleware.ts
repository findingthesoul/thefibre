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
export const middleware = createSessionMiddleware({
  createClient: (url, key, options) => createServerClient(url, key, options),
  respond: (request: NextRequest) => NextResponse.next({ request }),
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
});

export const config = {
  matcher: [
    // Unchanged in v1.98.0, including its doubled escape (which makes the
    // static-file clause match nothing). The shared module documents it.
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
