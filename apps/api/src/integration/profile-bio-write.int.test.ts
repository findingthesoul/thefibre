// A bio goes in as HTML and comes back cleaned — the save path itself.
//
// Until this existed, nothing anywhere exercised it. The public-organiser
// fixture test READS a bio and bio_html but never writes (its bio is planted
// straight into the database), and routes/profile-patch.test.ts parses the
// schema in memory with no HTTP, no sanitiser and no database. So the path
// from the editor to storage — PATCH /api/v1/profile -> sanitizeRichText ->
// stored -> read back — had never run, while a release was waiting to put
// that very editor on production (2026-10-04).
//
// It runs as a THROWAWAY user in a throwaway workspace: the e2e suite signs
// in as the oldest staging account, which is a real person's, and nothing
// that writes should go near it.
//
// Note for whoever trusts a green run: this file is NOT in `pnpm verify`.
// The gate ends at verify-public-api; integration runs under
// `pnpm test:integration` (or verify:full).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let workspaceId: string;
let user: FixtureUser;

const call = (method: string, body?: unknown) =>
  app.request('/api/v1/profile', {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** What is actually in the database for this person. */
async function storedBio(): Promise<string | null> {
  const { data } = await service
    .from('identity_profile')
    .select('bio')
    .eq('email', user.email)
    .maybeSingle();
  return data?.bio ?? null;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { profileRoutes } = await import('../routes/profile.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/profile', profileRoutes);
  app.route('/api/v1', v1);

  workspaceId = await createThrowawayWorkspace('biowrite');
  user = await createFixtureUser(workspaceId, 'biowrite');
}, 60_000);

afterAll(async () => {
  if (user) await deleteFixtureUser(user);
  if (workspaceId) await deleteThrowawayWorkspace(workspaceId);
}, 60_000);

describe('a rich-text bio survives the write, minus the dangerous parts', () => {
  it('keeps the formatting a person made', async () => {
    const res = await call('PATCH', {
      bio: '<h3>About me</h3><p>I am a <strong>co-founder</strong>.</p><ul><li>One</li><li>Two</li></ul>',
    });
    expect(res.status).toBe(200);
    const bio = (await storedBio()) ?? '';
    // The three things the editor's toolbar can make.
    expect(bio, 'heading').toContain('<h3>');
    expect(bio, 'bold').toContain('<strong>');
    expect(bio, 'list').toContain('<li>');
    expect(bio).toContain('About me');
  });

  it('strips a script, an event handler and a javascript: link', async () => {
    const res = await call('PATCH', {
      bio:
        '<p>Hello</p><script>alert(1)</script>' +
        '<img src=x onerror="alert(2)">' +
        '<a href="javascript:alert(3)">click</a>',
    });
    expect(res.status).toBe(200);
    const bio = (await storedBio()) ?? '';
    // The text survives; the weapons do not.
    expect(bio).toContain('Hello');
    expect(bio.toLowerCase()).not.toContain('<script');
    expect(bio.toLowerCase()).not.toContain('onerror');
    expect(bio.toLowerCase()).not.toContain('javascript:');
  });

  it('refuses an over-limit bio in words, and does not store it', async () => {
    const before = await storedBio();
    const res = await call('PATCH', { bio: `<p>${'x'.repeat(8100)}</p>` });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { fieldErrors?: { bio?: string[] } } };
    expect(body.error?.fieldErrors?.bio?.[0]).toBe('A bio can be at most 8,000 characters.');
    // A refusal that still wrote would be the worst of both.
    expect(await storedBio()).toBe(before);
  });

  it('gives a browser-shaped bio a shape that reads back', async () => {
    // Exactly what Chromium leaves when the editor starts EMPTY: a bare first
    // line, then blocks. Stored unshaped, the reader treats the whole value as
    // plain text and escapes it, so the next visit shows `&lt;h3&gt;` and the
    // next save stores that. Found on staging by the save fixture.
    const res = await call('PATCH', {
      bio: 'Fixture bio, first paragraph.<h3>A heading</h3><div>And a closing line.</div>',
    });
    expect(res.status).toBe(200);
    const bio = (await storedBio()) ?? '';
    expect(bio.startsWith('<p>'), bio.slice(0, 50)).toBe(true);
    expect(bio).toContain('<h3>A heading</h3>');
    expect(bio).not.toContain('<div>');
    // And the thing that actually bit: read back, this is HTML, not text.
    const { looksLikeStoredHtml } = await import('@thefibre/shared');
    expect(looksLikeStoredHtml(bio), 'the reader must see HTML here').toBe(true);
  });

  it('lets a person empty their bio', async () => {
    const res = await call('PATCH', { bio: null });
    expect(res.status).toBe(200);
    expect(await storedBio()).toBeNull();
  });
});
