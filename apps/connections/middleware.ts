import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Keeps a signed-in session alive for server-rendered pages.
//
// A Supabase access token lasts an hour. The browser refreshes it in the
// background; a SERVER component cannot, because it may read cookies and not
// write them — lib/supabase/server.ts swallows that write and says so. So an
// hour after signing in, every server-rendered page asked for a session, got
// null, and threw its own 401: pages that caught it showed "API 401", pages
// that did not showed Next's "Application error". It read as an auth failure
// and was a refresh failure.
//
// Middleware is the one place in Next that can read the request's cookies AND
// write cookies onto the response, so the refresh belongs here. getUser()
// performs it as a side effect when the token is stale.
//
// The same file exists in all five apps. It is thirty lines of auth plumbing
// that differ only by cookie domain; keep them identical.

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
