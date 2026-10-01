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
    // Everything except static files AND the paths that must never touch
    // auth: the calendar subscription, fetched by Google's servers every few
    // hours with no session and no business starting one, and the offline
    // page and service worker, which exist for when nothing can be reached.
    // (SESSION_MATCHER_EXTRAS.my in the shared module is the same list.)
    '/((?!_next/static|_next/image|favicon.ico|calendar/|offline.html|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
