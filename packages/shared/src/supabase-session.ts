// The session plumbing every app needs, once.
//
// Until v1.98.0 each of the nine signed-in apps carried its own copy of three
// files — lib/supabase/server.ts, lib/supabase/client.ts and middleware.ts —
// twenty-seven files holding one decision between them: how the session
// cookie is set. The copies were byte-identical "by an explicit earlier
// decision", which is another way of saying that the day the cookie's flags
// have to change (docs/data-protection-approach.md, P1) there was no single
// place to change them, and nothing to say when one copy had drifted.
//
// One HAD drifted, in the other direction: eight of the nine middleware
// matchers carried a doubled escape (`\\\\.` where `\\.` was meant), so the
// "skip static files" clause matched nothing and the session refresh ran on
// every image request. The ninth copy, the youngest, was the correct one.
// v1.98.0 moved the code with that defect intact; v1.98.1 corrected it, and
// supabase-session.test.ts now reads all nine.
//
// No Next and no Supabase dependency here, the same arrangement as
// auth-callback.ts: the app hands in the primitives, this file decides what
// is done with them. The API never imports this module.
//
// ENV IS PASSED AS VALUES, never read here. Next inlines
// `process.env.NEXT_PUBLIC_X` only where it is written out literally, so a
// browser bundle that handed `process.env` to a library would hand it an
// empty object. Each app's three-line binding writes the three names out.

/** What every factory needs to know about the stack it runs on. */
export type SessionConfig = {
  url: string | undefined;
  anonKey: string | undefined;
  /** NEXT_PUBLIC_COOKIE_DOMAIN: the apex the session cookie is shared across
   *  (so signing in to one app signs you in to its siblings). Unset on
   *  localhost, where the cookie falls back to the current host. */
  cookieDomain?: string | undefined;
};

type CookiePair = { name: string; value: string };
type CookieToSet = { name: string; value: string; options: object };

/** The options this module builds a server-side Supabase client with. */
export type ServerClientOptions = {
  cookieOptions?: { domain: string };
  cookies: {
    getAll(): CookiePair[];
    setAll(toSet: CookieToSet[]): void;
  };
};

/** The options this module builds a browser Supabase client with. */
export type BrowserClientOptions = {
  cookieOptions?: { domain: string };
};

// ---------------------------------------------------------------------------
// THE decision. Everything below routes through these two functions; change
// how the session cookie is scoped here and nowhere else.
// ---------------------------------------------------------------------------

/**
 * Client-level cookie options. Spread, never `cookieOptions: undefined`:
 * under exactOptionalPropertyTypes an explicit undefined is not an absent
 * key, and @supabase/ssr's types say the key may be absent but never
 * undefined — which broke every app's build on the dependency bump of
 * 2026-09-23.
 */
export function sessionClientOptions(cookieDomain: string | undefined): { cookieOptions?: { domain: string } } {
  return cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {};
}

/** One cookie's options as Supabase asked for them, plus our domain. */
export function sessionCookie<O extends object>(options: O, cookieDomain: string | undefined): O & { domain?: string } {
  return { ...options, ...(cookieDomain ? { domain: cookieDomain } : {}) };
}

// ---------------------------------------------------------------------------
// lib/supabase/server.ts
// ---------------------------------------------------------------------------

type CookieStore = {
  getAll(): CookiePair[];
  set(name: string, value: string, options: object): unknown;
};

/**
 * The server-side client, for Server Components, Server Actions and Route
 * Handlers:
 *
 *   import { cookies } from 'next/headers';
 *   import { createServerClient } from '@supabase/ssr';
 *   export const serverSupabase = createServerSupabase({
 *     createClient: (url, key, options) => createServerClient(url, key, options),
 *     cookies,
 *     url: process.env.NEXT_PUBLIC_SUPABASE_URL,
 *     anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *     cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
 *   });
 */
export function createServerSupabase<C>(
  deps: SessionConfig & {
    createClient: (url: string, anonKey: string, options: ServerClientOptions) => C;
    cookies: () => Promise<CookieStore>;
  },
): () => Promise<C> {
  const domain = deps.cookieDomain || undefined;
  return async function serverSupabase() {
    const cookieStore = await deps.cookies();
    return deps.createClient(deps.url!, deps.anonKey!, {
      ...sessionClientOptions(domain),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, sessionCookie(options, domain));
            }
          } catch {
            // Read-only Server Component context; silently ignore. A server
            // component may read cookies and not write them — the refresh
            // that needs writing happens in middleware (below) and in
            // /auth/callback (a Route Handler).
          }
        },
      },
    });
  };
}

// ---------------------------------------------------------------------------
// lib/supabase/client.ts
// ---------------------------------------------------------------------------

/**
 * The browser client:
 *
 *   import { createBrowserClient } from '@supabase/ssr';
 *   export const browserSupabase = createBrowserSupabase({
 *     createClient: (url, key, options) => createBrowserClient(url, key, options),
 *     url: process.env.NEXT_PUBLIC_SUPABASE_URL,
 *     anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *     cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
 *   });
 */
export function createBrowserSupabase<C>(
  deps: SessionConfig & {
    createClient: (url: string, anonKey: string, options: BrowserClientOptions) => C;
  },
): () => C {
  const domain = deps.cookieDomain || undefined;
  return function browserSupabase() {
    return deps.createClient(deps.url!, deps.anonKey!, sessionClientOptions(domain));
  };
}

// ---------------------------------------------------------------------------
// middleware.ts
// ---------------------------------------------------------------------------

type MiddlewareRequest = {
  cookies: { getAll(): CookiePair[]; set(name: string, value: string): unknown };
};
type MiddlewareResponse = {
  cookies: { set(name: string, value: string, options: object): unknown };
};

/**
 * Keeps a signed-in session alive for server-rendered pages.
 *
 * A Supabase access token lasts an hour. The browser refreshes it in the
 * background; a SERVER component cannot, because it may read cookies and not
 * write them. So an hour after signing in, every server-rendered page asked
 * for a session, got null, and threw its own 401: pages that caught it showed
 * "API 401", pages that did not showed Next's "Application error". It read as
 * an auth failure and was a refresh failure.
 *
 * Middleware is the one place in Next that can read the request's cookies AND
 * write cookies onto the response, so the refresh belongs here. getUser()
 * performs it as a side effect when the token is stale.
 *
 * `respond` builds the pass-through response from the request, and is called
 * AGAIN after a refresh, so what it builds must be derived from the request
 * it is handed — that is how the rest of the pass sees the new token. (The
 * platform app used to reuse a header copy taken BEFORE the refresh; its
 * server components then rendered that one request with the expired token
 * and refreshed a second time. Rebuilding from the request removes that —
 * corrected in v1.98.1, and the test file keeps that binding from caching.)
 *
 *   export const middleware = createSessionMiddleware({
 *     createClient: (url, key, options) => createServerClient(url, key, options),
 *     respond: (request: NextRequest) => NextResponse.next({ request }),
 *     url: process.env.NEXT_PUBLIC_SUPABASE_URL,
 *     anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *     cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
 *   });
 *   export const config = { matcher: ['…the literal in SESSION_MATCHER…'] };
 */
export function createSessionMiddleware<Req extends MiddlewareRequest, Res extends MiddlewareResponse>(
  deps: SessionConfig & {
    createClient: (
      url: string,
      anonKey: string,
      options: ServerClientOptions,
    ) => { auth: { getUser(): Promise<unknown> } };
    respond: (request: Req) => Res;
    /**
     * Runs FIRST, before any session work. Returns `{ final }` to answer at
     * once (a redirect), `{ respond }` to replace how the response is built
     * for this request (a rewrite — the session cookies still ride on it),
     * or null to change nothing. Used for a customer's own host
     * (`@thefibre/shared/tenant-host`, docs/domain-package.md part 2).
     */
    before?: (request: Req) => Promise<{ final: Res } | { respond: (request: Req) => Res } | null>;
  },
): (request: Req) => Promise<Res> {
  const domain = deps.cookieDomain || undefined;
  return async function middleware(request: Req) {
    let respond = deps.respond;
    if (deps.before) {
      const pre = await deps.before(request);
      if (pre && 'final' in pre) return pre.final;
      if (pre && 'respond' in pre) respond = pre.respond;
    }
    let response = respond(request);
    // A build with no Supabase configured (CI, a preview without env) still
    // serves pages; there is simply no session to keep alive.
    if (!deps.url || !deps.anonKey) return response;

    const supabase = deps.createClient(deps.url, deps.anonKey, {
      ...sessionClientOptions(domain),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          // Both halves matter: the request copy so the rest of this pass
          // sees the new token, the response copy so the browser keeps it.
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = respond(request);
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, sessionCookie(options, domain));
          }
        },
      },
    });

    // The refresh itself. Nothing is read from it — a signed-out visitor has
    // nothing to refresh, and a public page must not be disturbed.
    await supabase.auth.getUser();
    return response;
  };
}

/**
 * The matcher every app's `config` carries: everything except Next's own
 * static output and files by extension.
 *
 * Next reads `config` STATICALLY, so each app has to write this out as a
 * literal and cannot import it — which is how eight copies came to carry a
 * doubled escape that nothing noticed. supabase-session.test.ts holds every
 * app's literal against this one; an app that needs more exclusions (the
 * portal: its calendar feed and offline page) lists them in
 * SESSION_MATCHER_EXTRAS and nowhere else.
 */
export const SESSION_MATCHER =
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)';

/** Per app folder: extra path prefixes that must never touch auth. */
export const SESSION_MATCHER_EXTRAS: Record<string, string[]> = {
  // The calendar subscription is fetched by Google's servers every few hours
  // with no session and no business starting one; the offline page and the
  // service worker exist precisely for when nothing can be reached.
  my: ['calendar/', 'offline.html', 'sw\\.js', 'manifest\\.webmanifest'],
};

/** The matcher literal an app folder must carry. */
export function sessionMatcherFor(appFolder: string): string {
  const extras = SESSION_MATCHER_EXTRAS[appFolder];
  if (!extras?.length) return SESSION_MATCHER;
  return SESSION_MATCHER.replace('favicon.ico|', `favicon.ico|${extras.join('|')}|`);
}
