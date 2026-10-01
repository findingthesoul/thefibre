// The session plumbing, and every app's binding to it.
//
// Two halves. The first drives the three factories with fakes and asserts
// what they do to cookies — the behaviour nine apps used to carry a copy of.
// The second reads the nine apps from disk, because a factory nobody calls
// protects nothing: each app must bind to this module and must carry the
// matcher literal this module says it does (Next reads `config` statically,
// so the literal cannot be imported).
//
// v1.98.0 is a move, not a change: the matcher tests at the bottom PIN two
// things that look wrong, exactly as they are deployed, so the release that
// corrects them has a test to flip.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserSupabase,
  createServerSupabase,
  createSessionMiddleware,
  SESSION_MATCHER,
  SESSION_MATCHER_BY_APP,
  sessionClientOptions,
  sessionCookie,
  sessionMatcherFor,
  type ServerClientOptions,
} from './supabase-session.js';

const URL_ = 'https://project.supabase.co';
const KEY = 'anon-key';

describe('the one decision: how the session cookie is scoped', () => {
  it('adds the domain when there is one', () => {
    expect(sessionClientOptions('.thethread.app')).toEqual({ cookieOptions: { domain: '.thethread.app' } });
    expect(sessionCookie({ path: '/', maxAge: 10 }, '.thethread.app')).toEqual({
      path: '/',
      maxAge: 10,
      domain: '.thethread.app',
    });
  });

  it('adds NO key at all when there is none — an absent key, not an undefined one', () => {
    const client = sessionClientOptions(undefined);
    expect(client).toEqual({});
    expect('cookieOptions' in client).toBe(false);
    const cookie = sessionCookie({ path: '/' }, undefined);
    expect(cookie).toEqual({ path: '/' });
    expect('domain' in cookie).toBe(false);
  });

  it('changes nothing else Supabase asked for', () => {
    const asked = { path: '/', sameSite: 'lax', httpOnly: false, secure: true, maxAge: 34560000 };
    expect(sessionCookie(asked, '.thefibre.app')).toEqual({ ...asked, domain: '.thefibre.app' });
  });
});

describe('createServerSupabase', () => {
  function harness(cookieDomain: string | undefined, store = { getAll: vi.fn(() => [{ name: 'a', value: '1' }]), set: vi.fn() }) {
    let options: ServerClientOptions | undefined;
    const createClient = vi.fn((_url: string, _key: string, o: ServerClientOptions) => {
      options = o;
      return { client: true };
    });
    const serverSupabase = createServerSupabase({
      createClient,
      cookies: async () => store,
      url: URL_,
      anonKey: KEY,
      cookieDomain,
    });
    return { serverSupabase, createClient, store, options: () => options! };
  }

  it('builds the client with the url, the key and the cookie domain', async () => {
    const h = harness('.thethread.app');
    expect(await h.serverSupabase()).toEqual({ client: true });
    expect(h.createClient).toHaveBeenCalledWith(URL_, KEY, expect.anything());
    expect(h.options().cookieOptions).toEqual({ domain: '.thethread.app' });
  });

  it('reads the request cookies and writes each one back with the domain', async () => {
    const h = harness('.thethread.app');
    await h.serverSupabase();
    expect(h.options().cookies.getAll()).toEqual([{ name: 'a', value: '1' }]);
    h.options().cookies.setAll([
      { name: 'sb-token.0', value: 'x', options: { path: '/', maxAge: 5 } },
      { name: 'sb-token.1', value: 'y', options: { path: '/' } },
    ]);
    expect(h.store.set.mock.calls).toEqual([
      ['sb-token.0', 'x', { path: '/', maxAge: 5, domain: '.thethread.app' }],
      ['sb-token.1', 'y', { path: '/', domain: '.thethread.app' }],
    ]);
  });

  it('on localhost (no domain) passes the options through untouched', async () => {
    const h = harness(undefined);
    await h.serverSupabase();
    expect('cookieOptions' in h.options()).toBe(false);
    h.options().cookies.setAll([{ name: 'sb', value: 'x', options: { path: '/' } }]);
    expect(h.store.set).toHaveBeenCalledWith('sb', 'x', { path: '/' });
  });

  it('treats an empty NEXT_PUBLIC_COOKIE_DOMAIN as unset', async () => {
    const h = harness('');
    await h.serverSupabase();
    expect('cookieOptions' in h.options()).toBe(false);
  });

  it('swallows the write a Server Component is not allowed to make', async () => {
    const store = {
      getAll: vi.fn(() => []),
      set: vi.fn(() => {
        throw new Error('Cookies can only be modified in a Server Action or Route Handler');
      }),
    };
    const h = harness('.thethread.app', store);
    await h.serverSupabase();
    expect(() => h.options().cookies.setAll([{ name: 'sb', value: 'x', options: {} }])).not.toThrow();
  });

  it('asks for the cookie store on every call, never once at module load', async () => {
    const cookies = vi.fn(async () => ({ getAll: () => [], set: () => undefined }));
    const serverSupabase = createServerSupabase({ createClient: () => ({}), cookies, url: URL_, anonKey: KEY });
    expect(cookies).not.toHaveBeenCalled();
    await serverSupabase();
    await serverSupabase();
    expect(cookies).toHaveBeenCalledTimes(2);
  });
});

describe('createBrowserSupabase', () => {
  it('builds the client with the cookie domain, or with no cookie options at all', () => {
    const createClient = vi.fn((_u: string, _k: string, o: object) => o);
    expect(createBrowserSupabase({ createClient, url: URL_, anonKey: KEY, cookieDomain: '.thefibre.tech' })()).toEqual({
      cookieOptions: { domain: '.thefibre.tech' },
    });
    expect(createBrowserSupabase({ createClient, url: URL_, anonKey: KEY })()).toEqual({});
    expect(createClient).toHaveBeenNthCalledWith(1, URL_, KEY, expect.anything());
  });
});

describe('createSessionMiddleware', () => {
  type FakeRequest = { cookies: { getAll: () => { name: string; value: string }[]; set: ReturnType<typeof vi.fn> } };
  type FakeResponse = { id: number; sawCookies: string[]; cookies: { set: ReturnType<typeof vi.fn> } };

  function harness({ refresh, configured = true }: { refresh: boolean; configured?: boolean }) {
    const jar: { name: string; value: string }[] = [{ name: 'sb', value: 'old' }];
    const request: FakeRequest = {
      cookies: {
        getAll: () => [...jar],
        set: vi.fn((name: string, value: string) => {
          const hit = jar.find((c) => c.name === name);
          if (hit) hit.value = value;
          else jar.push({ name, value });
        }),
      },
    };
    let made = 0;
    const respond = vi.fn((req: FakeRequest): FakeResponse => {
      made += 1;
      // What the rest of the pass would see: the request's cookies NOW.
      return { id: made, sawCookies: req.cookies.getAll().map((c) => `${c.name}=${c.value}`), cookies: { set: vi.fn() } };
    });
    const getUser = vi.fn();
    const createClient = vi.fn((_u: string, _k: string, options: ServerClientOptions) => ({
      auth: {
        getUser: async () => {
          getUser();
          if (refresh) options.cookies.setAll([{ name: 'sb', value: 'new', options: { path: '/', maxAge: 3600 } }]);
        },
      },
    }));
    const middleware = createSessionMiddleware({
      createClient,
      respond,
      // A default parameter would turn an explicit `undefined` back into the
      // URL, and the "not configured" case would silently test the other one.
      url: configured ? URL_ : undefined,
      anonKey: KEY,
      cookieDomain: '.thethread.app',
    });
    return { middleware, request, respond, createClient, getUser };
  }

  it('with a fresh token: asks once, passes the request through, sets nothing', async () => {
    const h = harness({ refresh: false });
    const res = await h.middleware(h.request);
    expect(h.getUser).toHaveBeenCalledTimes(1);
    expect(h.respond).toHaveBeenCalledTimes(1);
    expect(res.id).toBe(1);
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  it('with a stale token: the browser gets the new cookie, with the domain', async () => {
    const h = harness({ refresh: true });
    const res = await h.middleware(h.request);
    expect(res.cookies.set).toHaveBeenCalledWith('sb', 'new', { path: '/', maxAge: 3600, domain: '.thethread.app' });
  });

  it('with a stale token: the REST OF THE PASS sees the new token, not the expired one', async () => {
    const h = harness({ refresh: true });
    const res = await h.middleware(h.request);
    expect(h.request.cookies.set).toHaveBeenCalledWith('sb', 'new');
    // The response that is returned was built AFTER the request was updated.
    // (The platform app's binding deliberately defeats this for now by
    // reusing a header copy, as its own middleware always did.)
    expect(res.id).toBe(2);
    expect(res.sawCookies).toEqual(['sb=new']);
  });

  it('with no Supabase configured: serves the page and never builds a client', async () => {
    const h = harness({ refresh: true, configured: false });
    const res = await h.middleware(h.request);
    expect(res.id).toBe(1);
    expect(h.createClient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The nine apps, read from disk.
// ---------------------------------------------------------------------------

const appsDir = fileURLToPath(new URL('../../../apps/', import.meta.url));
const read = (rel: string) => readFileSync(`${appsDir}${rel}`, 'utf8');

/** Every app that signs people in: it has a middleware.ts. */
const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${appsDir}${d.name}/middleware.ts`))
  .map((d) => d.name);

/** Next's matcher is a path pattern whose group is a regular expression. */
const matches = (matcher: string, path: string) => new RegExp(`^${matcher}$`).test(path);

/** The string a quoted TypeScript literal evaluates to. */
function literal(source: string): string {
  const m = /matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)*(['"])((?:(?!\1)[^\\]|\\.)*)\1/.exec(source);
  if (!m) throw new Error('no quoted matcher literal found');
  return m[2]!.replace(/\\(.)/g, '$1');
}

describe('every app is bound to this module', () => {
  it('finds the nine signed-in apps', () => {
    // web, thread, meet, flow, pulse, membership, connections, models, my.
    // The marketing site has no session and no middleware.
    expect(apps.length).toBeGreaterThanOrEqual(9);
    expect(apps).not.toContain('website');
    expect(apps).not.toContain('api');
  });

  for (const app of apps) {
    describe(`apps/${app}`, () => {
      it('middleware.ts builds its middleware here, and holds no cookie logic of its own', () => {
        const source = read(`${app}/middleware.ts`);
        expect(source).toContain("from '@thefibre/shared/supabase-session'");
        expect(source).toContain('export const middleware = createSessionMiddleware(');
        expect(source).not.toMatch(/cookies\.set\(/);
        expect(source).not.toContain('getUser(');
      });

      it('carries exactly the matcher this module says it should', () => {
        expect(literal(read(`${app}/middleware.ts`))).toBe(sessionMatcherFor(app));
      });

      it('lib/supabase/server.ts and client.ts are bindings, not copies', () => {
        const server = read(`${app}/lib/supabase/server.ts`);
        expect(server).toContain('export const serverSupabase = createServerSupabase(');
        expect(server).not.toMatch(/cookieStore|\.set\(/);
        const client = read(`${app}/lib/supabase/client.ts`);
        expect(client).toContain('export const browserSupabase = createBrowserSupabase(');
        expect(client).not.toContain('cookieOptions');
      });

      it('writes the three env names out literally, so Next can inline them', () => {
        for (const file of ['middleware.ts', 'lib/supabase/server.ts', 'lib/supabase/client.ts']) {
          const source = read(`${app}/${file}`);
          for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_COOKIE_DOMAIN']) {
            expect(source, `${app}/${file}: ${name}`).toContain(`process.env.${name}`);
          }
        }
      });
    });
  }
});

describe('the matcher, pinned as it is deployed', () => {
  it('runs the session refresh on pages', () => {
    for (const path of ['/', '/dashboard', '/threads/abc/edit', '/auth/callback', '/api/rsvp', '/sjoerd/intro-call']) {
      expect(matches(SESSION_MATCHER, path), path).toBe(true);
    }
  });

  it("skips Next's own static output and the favicon", () => {
    for (const path of ['/favicon.ico', '/_next/static/chunks/main.js', '/_next/image']) {
      expect(matches(SESSION_MATCHER, path), path).toBe(false);
    }
  });

  it('KNOWN DEFECT, carried over unchanged: it does not skip files by extension', () => {
    // The clause is there and matches nothing, because the escape is doubled.
    // v1.98.0 moves the middleware without changing which requests it runs
    // on; the next release corrects the escape and flips these to false.
    for (const path of ['/brand/the-thread.png', '/logo.svg', '/robots.txt', '/sitemap.xml']) {
      expect(matches(SESSION_MATCHER, path), path).toBe(true);
    }
    expect(SESSION_MATCHER).toContain('.*\\\\.(?:');
  });

  it("the portal's matcher is the correct one, and excludes its own paths", () => {
    const portal = sessionMatcherFor('my');
    expect(Object.keys(SESSION_MATCHER_BY_APP)).toEqual(['my']);
    for (const path of ['/calendar/abc123.ics', '/offline.html', '/sw.js', '/manifest.webmanifest', '/logo.png', '/robots.txt']) {
      expect(matches(portal, path), path).toBe(false);
    }
    expect(matches(portal, '/')).toBe(true);
    expect(matches(portal, '/soul/tickets')).toBe(true);
    expect(sessionMatcherFor('thread')).toBe(SESSION_MATCHER);
  });
});
