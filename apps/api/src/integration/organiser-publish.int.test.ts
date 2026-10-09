// A person's public page is theirs to switch off — and switching it off must
// not take their threads with it.
//
// Until 2026-10-08 the page at /{slug} published somebody's name, bio and
// photo whether or not they had ever chosen to have a page. Most of them had
// not: routes/app-thread.ts CREATES an organiser row, slug and all, the first
// time an external app publishes a thread for that workspace.
//
// Three properties, and the second is the one that would be easy to get
// wrong in a way nobody notices until a customer's links are dead.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let app: Hono;
let ws = '';
let userId = '';
let organiserId = '';
let threadSlug = '';
const slug = `int-pub-${randomUUID().slice(0, 8)}`;

const get = (path: string) =>
  app.request(`/api/v1/thread${path}`, { headers: { 'X-App-ID': 'the-thread' } });

const setPublished = (v: boolean | null) =>
  service.from('thread_organiser').update({ is_published: v }).eq('id', organiserId);

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('organiser-publish');
  const email = `int-pub-${randomUUID().slice(0, 8)}@example.com`;
  const { data: u } = await service.from('user').insert({ workspace_id: ws, email }).select('id').single();
  userId = u!.id as string;
  const { data: o, error } = await service
    .from('thread_organiser')
    .insert({ user_id: userId, workspace_id: ws, slug, display_name: 'Int Organiser' })
    .select('id')
    .single();
  if (error) throw new Error(`organiser fixture: ${error.message}`);
  organiserId = o!.id as string;

  // One published thread under that slug, so the "threads stay reachable"
  // property has something to be true about.
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { data: prog } = await service
    .from('program')
    .insert({ workspace_id: ws, app_id: appRow!.id, title: 'Int publish thread', format: 'event', status: 'active' })
    .select('id')
    .single();
  threadSlug = `int-pub-thread-${randomUUID().slice(0, 6)}`;
  const { error: tErr } = await service.from('thread_thread').insert({
    workspace_id: ws,
    program_id: prog!.id,
    organiser_id: organiserId,
    slug: threadSlug,
    intention: 'A fixture thread.',
    is_public_listed: true,
    public_scope: 'personal',
  });
  if (tErr) throw new Error(`thread fixture: ${tErr.message}`);
});

afterAll(async () => {
  await service.from('thread_thread').delete().eq('organiser_id', organiserId);
  await service.from('program').delete().eq('workspace_id', ws);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('user').delete().eq('id', userId);
  await deleteThrowawayWorkspace(ws);
});

describe('the publish switch', () => {
  it('NULL is grandfathered: a page that existed before the question still works', async () => {
    await setPublished(null);
    const r = await get(`/public/organiser/${slug}`);
    expect(r.status, await r.clone().text()).toBe(200);
  });

  it('true publishes it', async () => {
    await setPublished(true);
    expect((await get(`/public/organiser/${slug}`)).status).toBe(200);
  });

  it('false gives the SAME 404 as a slug that does not exist', async () => {
    await setPublished(false);
    const off = await get(`/public/organiser/${slug}`);
    const nobody = await get(`/public/organiser/int-no-such-slug-${randomUUID().slice(0, 8)}`);

    expect(off.status).toBe(404);
    expect(off.status).toBe(nobody.status);
    // Byte for byte. A different sentence — "this page is private" — would
    // confirm that the person is here, which is the thing being withheld.
    expect(await off.text()).toBe(await nobody.text());
  });

  // THE one that would hurt. resolvePublicOwner is shared by the page and
  // every thread beneath it; gating the resolver instead of the route would
  // 404 every enrolment link this organiser has ever sent.
  it('an unpublished page does NOT take the threads down with it', async () => {
    await setPublished(false);
    const r = await get(`/public/organiser/${slug}/thread/${threadSlug}`);
    expect(r.status, 'a published thread must stay reachable').toBe(200);
    const body = (await r.json()) as { organiser?: { slug?: string } };
    // And it still names who is running it, because that was always public.
    expect(body.organiser?.slug).toBe(slug);
  });

  it('never puts the flag into the published payload', async () => {
    await setPublished(true);
    const body = (await (await get(`/public/organiser/${slug}`)).json()) as Record<string, unknown>;
    const organiser = body.organiser as Record<string, unknown>;
    expect('is_published' in organiser, JSON.stringify(organiser)).toBe(false);
  });
});
