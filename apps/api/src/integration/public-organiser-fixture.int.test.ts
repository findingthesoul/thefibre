// The permanent public organiser on staging: it exists, it is the same one
// every run, and the public page reads its name and bio from the PROFILE.
//
// Two jobs. It keeps the fixture alive (staging.ts explains why staging needs
// one), and it is the regression test for the bug the fixture is shaped like:
// until v1.98.8 the public organiser payload read display_name / bio / photo
// from the thread_organiser row, where nothing has written them since
// 20260901160000, so a person's public Thread page showed no name and no bio
// while their settings page and their Meet page showed both. It failed by
// showing nothing, which is why nobody reported it.
//
// The routes run in process, as in thread-tenancy.int.test.ts. Nothing here
// is deleted: the fixture is permanent by design.

import { beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { ensurePublicOrganiserFixture, PUBLIC_FIXTURE as F, service, type PublicOrganiserFixture } from './staging.js';

let app: Hono;
let first: PublicOrganiserFixture;

const get = (path: string) => app.request(`/api/v1/thread${path}`, { headers: { 'X-App-ID': 'the-thread' } });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);
  first = await ensurePublicOrganiserFixture();
});

describe('the permanent public organiser fixture', () => {
  it('is idempotent: a second run finds the same rows and makes no others', async () => {
    const second = await ensurePublicOrganiserFixture();
    expect(second).toEqual(first);
    const count = async (table: string, column: string, value: string) => {
      const { count: n, error } = await service.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
      expect(error, `${table}`).toBeNull();
      return n;
    };
    expect(await count('thread_organiser', 'slug', F.organiserSlug)).toBe(1);
    expect(await count('user', 'email', F.email)).toBe(1);
    expect(await count('identity_profile', 'email', F.email)).toBe(1);
    expect(await count('thread_thread', 'organiser_id', first.organiserId)).toBe(1);
  });

  it('keeps the organiser row EMPTY: the name and the bio are on the profile only', async () => {
    const { data, error } = await service
      .from('thread_organiser')
      .select('display_name, bio, photo_url')
      .eq('id', first.organiserId)
      .single();
    expect(error).toBeNull();
    // If these are ever filled in, the fixture answers the same on code that
    // ignores the profile, and stops being a probe.
    expect(data).toEqual({ display_name: null, bio: null, photo_url: null });
    const { data: profile } = await service.from('identity_profile').select('display_name, bio').eq('email', F.email).single();
    expect(profile).toEqual({ display_name: F.displayName, bio: F.bio });
  });

  it('no workspace or team holds its address, so the organiser is what the address resolves to', async () => {
    const { data: ws } = await service.from('workspace').select('id').eq('slug', F.organiserSlug);
    const { data: team } = await service.from('team').select('id').eq('slug', F.organiserSlug);
    expect(ws).toEqual([]);
    expect(team).toEqual([]);
  });
});

describe('the public organiser page reads the profile', () => {
  it('GET /public/organiser/:slug answers with the name and bio from the profile', async () => {
    const r = await get(`/public/organiser/${F.organiserSlug}`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      owner_kind: string;
      organiser: { slug: string; display_name: string | null; bio: string | null; bio_html: string | null; photo_url: string | null };
      threads: { slug: string }[];
    };
    expect(body.owner_kind).toBe('organiser');
    expect(body.organiser.slug).toBe(F.organiserSlug);
    // THE assertion. Code that reads only the organiser row answers null here.
    expect(body.organiser.display_name).toBe(F.displayName);
    expect(body.organiser.bio).toBe(F.bio);
    // Two paragraphs in, two <p> out: the split on a blank line, end to end.
    const html = body.organiser.bio_html ?? '';
    expect(html).toContain('A permanent test fixture on staging.');
    expect(html.match(/<p[ >]/g)?.length, html).toBe(2);
    expect(html).toMatch(/<\/p>\s*<p[ >]/);
    expect(body.organiser.photo_url).toBeNull();
    expect(body.threads.map((t) => t.slug)).toEqual([F.threadSlug]);
  });

  it('GET /public/organiser/:slug/thread/:threadSlug answers for the fixture thread', async () => {
    const r = await get(`/public/organiser/${F.organiserSlug}/thread/${F.threadSlug}`);
    expect(r.status).toBe(200);
  });
});
