// Thread dates slice 4: the payloads behind the surfaces that moved onto the
// shared date rule carry what that rule needs — and not as empty fields.
//
//   · my.thread's Upcoming (GET /me/portal/upcoming): each item's key-moment
//     span, count, zone and workspace, and that workspace's card choice;
//   · the public organiser page (GET /thread/public/organiser/:slug): the
//     same per item, plus the owner's card choice.
//
// Against the seeded staging fixture (scripts/seed-upcoming-fixture.mjs): a
// member of two communities whose calendar threads it can join. The fixture
// ships with no sessions, so this adds ONE published key-moment session to
// one of its threads for the length of the test and removes it after — a
// field that is present but always zero is the empty that reads as working.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { anonKey, service, url } from './staging.js';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const FIXTURE = 'upcoming-fixture@example.com';
const AT = '2027-02-14T18:00:00.000Z';
let app: Hono;
let token = '';
let threadId = '';
let threadSlug = '';
let ownerSlug = '';
let engagementId = '';

async function tokenFor(email: string): Promise<string> {
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const v = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }),
  }).then((r) => r.json());
  if (!v.access_token) throw new Error(`no session for ${email}`);
  return v.access_token as string;
}

beforeAll(async () => {
  const { portalRoutes } = await import('../routes/portal.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono().route('/api/v1/me', portalRoutes).route('/api/v1/thread', threadRoutes);
  token = await tokenFor(FIXTURE);

  // One of the fixture's joinable threads, from the route itself.
  const r = await app.request('/api/v1/me/portal/upcoming?size=50', { headers: { Authorization: `Bearer ${token}` } });
  const page = (await r.json()) as { items: { thread_id: string; owner_slug?: string; thread_slug?: string }[] };
  // A LISTED one (the seed names them `…-listed`), so it is on the public
  // organiser page too and the second describe has something to find.
  const pick = page.items.find((i) => i.owner_slug && i.thread_slug?.endsWith('-listed'));
  if (!pick) throw new Error('the seeded fixture has no joinable thread — run scripts/seed-upcoming-fixture.mjs');
  threadId = pick.thread_id;
  threadSlug = pick.thread_slug!;
  ownerSlug = pick.owner_slug!;
  const { data: t } = await service.from('thread_thread').select('workspace_id').eq('id', threadId).single();
  const { data: e, error } = await service
    .from('thread_engagement')
    .insert({
      workspace_id: t!.workspace_id, thread_id: threadId, type: 'event', title: 'int: key moment',
      status: 'published', starts_at: AT, ends_at: '2027-02-14T20:00:00.000Z', is_key_moment: true, position: 999,
    })
    .select('id')
    .single();
  if (error) throw new Error(`key moment: ${error.message}`);
  engagementId = e.id as string;
}, 60_000);

afterAll(async () => {
  if (engagementId) await service.from('thread_engagement').delete().eq('id', engagementId);
});

describe('my.thread Upcoming', () => {
  it('carries the key moments, the zone, the workspace and that workspace’s card choice', async () => {
    const r = await app.request('/api/v1/me/portal/upcoming?size=50', { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    const page = (await r.json()) as {
      items: Record<string, unknown>[];
      card_dates: Record<string, { range: string }>;
    };
    const item = page.items.find((i) => i.thread_id === threadId)!;
    expect(item, 'the thread with the key moment is listed').toBeTruthy();
    expect(item.key_moment_count).toBe(1);
    expect(item.event_starts_at && new Date(item.event_starts_at as string).toISOString()).toBe(AT);
    expect(typeof item.timezone).toBe('string');
    expect(typeof item.workspace_id).toBe('string');
    // Every listed workspace has a choice, so no card renders without one.
    for (const i of page.items) expect(page.card_dates[i.workspace_id as string], String(i.workspace_id)).toBeTruthy();
  });
});

describe('the public organiser page', () => {
  it('carries the same per item, its language and zone, and the owner’s card choice', async () => {
    const r = await app.request(`/api/v1/thread/public/organiser/${ownerSlug}`);
    expect(r.status, ownerSlug).toBe(200);
    const body = (await r.json()) as { threads: Record<string, unknown>[]; card_dates?: { range: string } };
    expect(body.card_dates?.range, 'the card choice is on the page payload').toBeTruthy();
    const item = body.threads.find((t) => t.slug === threadSlug);
    expect(item, `${threadSlug} is listed on /${ownerSlug}`).toBeTruthy();
    expect(item!.key_moment_count).toBe(1);
    expect(item!.event_starts_at && new Date(item!.event_starts_at as string).toISOString()).toBe(AT);
    expect(typeof item!.timezone).toBe('string');
    expect(typeof item!.language).toBe('string');
  });
});
