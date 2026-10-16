// GET /me/nav answers the same three values /me/portal does.
//
// my.thread's frame moved from /me/portal to /me/nav (v1.215.0) so every page
// stops paying for the whole portal walk. The nav is only right if it is the
// SAME answer: "Upcoming" in the nav and the Upcoming page agreeing, the bell
// counting what the notifications page lists. So both routes are asked, in
// process on the staging database, with a real session for fixture
// addresses — the one with two team-calendar memberships
// (scripts/seed-upcoming-fixture.mjs) and the e2e fixture, which has none.

import { beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { isLocale } from '@thefibre/shared';
import { anonKey, url } from './staging.js';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
let app: Hono;

/** A real session for a FIXTURE address: admin generate_link, then verify
 *  with the token hash (scripts/time-portal.mjs does the same). */
async function tokenFor(email: string): Promise<string> {
  if (!/@example\.com$/i.test(email)) throw new Error(`refusing a non-fixture address: ${email}`);
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const hash = link.hashed_token ?? link.properties?.hashed_token;
  if (!hash) throw new Error(`generate_link: ${JSON.stringify(link).slice(0, 200)}`);
  const v = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hash }),
  }).then((r) => r.json());
  if (!v.access_token) throw new Error(`verify: ${JSON.stringify(v).slice(0, 200)}`);
  return v.access_token as string;
}

beforeAll(async () => {
  const { portalRoutes } = await import('../routes/portal.js');
  app = new Hono().route('/api/v1/me', portalRoutes);
});

async function get(path: string, token: string) {
  const r = await app.request(`/api/v1/me${path}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.status, path).toBe(200);
  return r.json() as Promise<Record<string, unknown>>;
}

describe('/me/nav', () => {
  for (const [email, label] of [
    ['upcoming-fixture@example.com', 'two team-calendar memberships'],
    ['e2e-fixture@example.com', 'no membership'],
  ] as const) {
    it(`equals /me/portal's upcoming, communities and unread for ${label}`, async () => {
      const token = await tokenFor(email);
      const [nav, portal] = await Promise.all([get('/nav', token), get('/portal', token)]);
      // The three numbers /me/portal also carries must agree. `locale` is
      // /me/nav's own (v1.247.0, my.thread in six languages): the reader's
      // identity_profile.locale, so null or one we speak — never compared
      // against /me/portal, which does not send it.
      const { locale, ...numbers } = nav;
      expect(numbers).toEqual({
        upcoming: portal.upcoming,
        communities: portal.communities,
        unread_notifications: portal.unread_notifications,
      });
      expect(locale === null || isLocale(locale as string)).toBe(true);
      if (label === 'two team-calendar memberships') {
        // Said out loud, or a fixture that lost its memberships passes this
        // as two empty answers agreeing.
        expect(nav.upcoming).toBe(true);
        expect(nav.communities).toBe(2);
      }
    });
  }

  it('refuses without a session', async () => {
    const r = await app.request('/api/v1/me/nav');
    expect(r.status).toBe(401);
  });
});
