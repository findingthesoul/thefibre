import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Keeps a signed-in session alive for server-rendered pages.
//
// A Supabase access token lasts an hour. The browser refreshes it in the
// background; a SERVER component cannot, because it may read cookies and not
// write them — lib/supabase/server.ts swallows that write and says so. So an
// hour after signing in, every server-rendered page asked for a session and
// got null. On this app that means the sign-in form, which is why Sjoerd asked
// *"can login be 'stay logged in'?"* — it read as a short session and was a
// missing refresh. Nothing was expiring early; it simply never renewed.
//
// Middleware is the one place in Next that can read the request's cookies AND
// write cookies onto the response, so the refresh belongs here. getUser()
// performs it as a side effect when the token is stale.
//
// THE SEVENTH COPY, and deliberately so. The other six apps carry this file
// byte-identical by an explicit earlier decision ("keep them identical"); the
// portal is younger than that decision and was simply never given one. Next
// requires the file at this exact path per app, so the shared-component rule
// cannot be satisfied by a component — what could be extracted is the body,
// injected with Next's primitives the way ui/auth-callback is. Worth doing
// once, for all seven at once, by someone holding all seven lanes. Adding the
// missing copy is conforming to the existing decision, not forking a variant.

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    ...(COOKIE_DOMAIN ? { cookieOptions: { domain: COOKIE_DOMAIN } } : {}),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
        // Both halves matter: the request copy so the rest of this pass sees
        // the new token, the response copy so the browser keeps it.
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, {
            ...options,
            ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
          });
        }
      },
    },
  });

  // The refresh itself. Nothing is read from it — a signed-out visitor has
  // nothing to refresh, and a public page must not be disturbed.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // Everything except static files AND the two paths that must never touch
    // auth: the calendar subscription, fetched by Google's servers every few
    // hours with no session and no business starting one, and the offline
    // page, which exists precisely for when nothing can be reached.
    '/((?!_next/static|_next/image|favicon.ico|calendar/|offline.html|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
