import { test, expect, type BrowserContext } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

// A REAL refresh of a live session, through the middleware, on staging.
//
// An access token lasts an hour, and the middleware is what renews it for
// server-rendered pages. Nothing in the pack waited an hour, so the renewal
// itself — the one job of the code every app shares since v1.98.0
// (@thefibre/shared/supabase-session) — had only ever been exercised by
// people. This makes the hour pass: sign in, rewrite the session cookie's
// `expires_at` to an hour ago (the tokens themselves untouched), and ask for
// a page. The middleware must see a stale session, renew it with the real
// refresh token, hand the browser a NEW cookie scoped to the apex, and the
// page must still render signed in.
//
// The session is the one this test just minted through the SSO hand-off, so
// rotating its refresh token touches nobody else's.

const APPS = [
  { name: 'The Thread', host: HOSTS.thread, slug: 'the-thread' },
  // The platform app rewrites request headers in its middleware, which is the
  // one place the nine bindings differ.
  { name: 'The Fibre', host: HOSTS.fibre, slug: 'fibre-platform' },
] as const;

type Session = { access_token: string; refresh_token: string; expires_at: number };

const isSessionCookie = (name: string) => /^sb-[a-z0-9]+-auth-token(\.\d+)?$/.test(name);
const order = (name: string) => Number(/\.(\d+)$/.exec(name)?.[1] ?? 0);

async function sessionChunks(context: BrowserContext, host: string) {
  const all = await context.cookies(host);
  return all.filter((c) => isSessionCookie(c.name)).sort((a, b) => order(a.name) - order(b.name));
}

function decode(joined: string): Session {
  expect(joined.startsWith('base64-'), 'the session cookie is base64url JSON').toBe(true);
  return JSON.parse(Buffer.from(joined.slice('base64-'.length), 'base64url').toString('utf8')) as Session;
}

for (const app of APPS) {
  test(`${app.name}: a stale session is renewed by the middleware, and the page stays signed in`, async ({ page, context }) => {
    test.slow();
    await landSignedIn(page, app.host, app.slug, '/dashboard', /\/dashboard/);

    const before = await sessionChunks(context, app.host);
    expect(before.length, 'a session cookie exists after sign-in').toBeGreaterThan(0);
    const joined = before.map((c) => c.value).join('');
    const session = decode(joined);
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(session.expires_at, 'the minted session is live').toBeGreaterThan(nowSeconds);

    // Make the hour pass. Same digits count, so the encoded length — and with
    // it the way the value is split across cookies — does not change.
    const stale = { ...session, expires_at: nowSeconds - 3600 };
    const encoded = `base64-${Buffer.from(JSON.stringify(stale), 'utf8').toString('base64url')}`;
    expect(encoded.length, 're-encoded cookie keeps its length').toBe(joined.length);
    let at = 0;
    await context.addCookies(
      before.map((c) => {
        const value = encoded.slice(at, at + c.value.length);
        at += c.value.length;
        return { ...c, value };
      }),
    );
    expect(decode((await sessionChunks(context, app.host)).map((c) => c.value).join('')).expires_at).toBeLessThan(nowSeconds);

    // The request that finds the stale session.
    const response = await page.goto(`${app.host}/dashboard`);
    expect(response, 'the page answered').not.toBeNull();
    await expect(page).toHaveURL(/\/dashboard/);

    // The browser was handed a new cookie by THIS response, scoped to the apex.
    const setCookies = (await response!.headerValues('set-cookie')).filter((h) => /^sb-[a-z0-9]+-auth-token/.test(h));
    expect(setCookies.length, 'the response renews the session cookie').toBeGreaterThan(0);
    for (const h of setCookies) expect(h).toMatch(/Domain=\.thefibre\.tech/i);

    // And what it holds now is a different, live session.
    const after = decode((await sessionChunks(context, app.host)).map((c) => c.value).join(''));
    expect(after.expires_at, 'the renewed session is live').toBeGreaterThan(nowSeconds);
    expect(after.access_token, 'a new access token was issued').not.toBe(session.access_token);
    expect(after.refresh_token, 'the refresh token was rotated').not.toBe(session.refresh_token);

    // Still signed in on the next page too: the renewed cookie works.
    await page.goto(`${app.host}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/);
  });
}
