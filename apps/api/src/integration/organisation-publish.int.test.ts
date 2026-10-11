// A workspace's organisation page is its own to switch off — and switching it
// off must not take its threads with it.
//
// The same promise `organiser-publish.int.test.ts` makes about a person, made
// about a workspace (2026-10-11, docs/person-and-organisation-pages.md Q6).
// Deliberately a separate file rather than cases bolted onto that one: these
// are two columns on two tables read by two branches of the same route, and a
// shared fixture would make it easy to prove one of them twice.
//
// THE CASE THE SLICE OWES is the first: a workspace nobody has asked yet must
// keep serving. A switch that defaulted to off would take every live
// organisation page down on the day it shipped, to ask a question nobody had
// been asked.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let app: Hono;
let ws = '';
let wsSlug = '';
let userId = '';
let organiserId = '';
let threadSlug = '';

const get = (path: string) =>
  app.request(`/api/v1/thread${path}`, { headers: { 'X-App-ID': 'the-thread' } });

const setPublished = (v: boolean | null) =>
  service.from('thread_settings').update({ site_is_published: v }).eq('workspace_id', ws);

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('org-publish');
  const { data: wrow, error: wErr } = await service
    .from('workspace')
    .select('slug')
    .eq('id', ws)
    .single();
  if (wErr) throw new Error(`workspace slug: ${wErr.message}`);
  wsSlug = wrow!.slug as string;

  // The settings row is what carries the switch. A workspace that has never
  // opened the editor may not have one at all — which is its own flavour of
  // "never asked", and the last case below is about exactly that.
  const { error: sErr } = await service.from('thread_settings').insert({ workspace_id: ws });
  if (sErr) throw new Error(`thread_settings fixture: ${sErr.message}`);

  const email = `int-orgpub-${randomUUID().slice(0, 8)}@example.com`;
  const { data: u } = await service.from('user').insert({ workspace_id: ws, email }).select('id').single();
  userId = u!.id as string;
  const { data: o, error: oErr } = await service
    .from('thread_organiser')
    .insert({
      user_id: userId,
      workspace_id: ws,
      slug: `int-orgpub-org-${randomUUID().slice(0, 8)}`,
      display_name: 'Int Organiser',
    })
    .select('id')
    .single();
  if (oErr) throw new Error(`organiser fixture: ${oErr.message}`);
  organiserId = o!.id as string;

  // A WORKSPACE-scoped thread, so it lives under the workspace's slug — that
  // is what makes "the threads stay reachable" a real claim here rather than
  // a claim about the organiser's address.
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { data: prog } = await service
    .from('program')
    .insert({
      workspace_id: ws,
      app_id: appRow!.id,
      title: 'Int org publish thread',
      format: 'event',
      status: 'active',
    })
    .select('id')
    .single();
  threadSlug = `int-orgpub-thread-${randomUUID().slice(0, 6)}`;
  const { error: tErr } = await service.from('thread_thread').insert({
    workspace_id: ws,
    program_id: prog!.id,
    organiser_id: organiserId,
    slug: threadSlug,
    intention: 'A fixture thread.',
    is_public_listed: true,
    public_scope: 'workspace',
  });
  if (tErr) throw new Error(`thread fixture: ${tErr.message}`);
});

afterAll(async () => {
  await service.from('thread_thread').delete().eq('organiser_id', organiserId);
  await service.from('program').delete().eq('workspace_id', ws);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('thread_settings').delete().eq('workspace_id', ws);
  await service.from('user').delete().eq('id', userId);
  await deleteThrowawayWorkspace(ws);
});

describe('the organisation page switch', () => {
  // The default, and the reason the column is nullable.
  it('NULL is grandfathered: a page nobody was asked about still works', async () => {
    await setPublished(null);
    const r = await get(`/public/organiser/${wsSlug}`);
    expect(r.status, await r.clone().text()).toBe(200);
  });

  it('true publishes it', async () => {
    await setPublished(true);
    expect((await get(`/public/organiser/${wsSlug}`)).status).toBe(200);
  });

  it('false gives the SAME 404 as a slug that does not exist', async () => {
    await setPublished(false);
    const off = await get(`/public/organiser/${wsSlug}`);
    const nobody = await get(`/public/organiser/int-no-such-slug-${randomUUID().slice(0, 8)}`);

    expect(off.status).toBe(404);
    expect(off.status).toBe(nobody.status);
    // Byte for byte: a different sentence would confirm the workspace is here.
    expect(await off.text()).toBe(await nobody.text());
  });

  // THE one that would hurt, and the reason the gate is on this route rather
  // than in resolvePublicOwner, which every thread URL also goes through.
  it('an unpublished organisation page does NOT take the threads down with it', async () => {
    await setPublished(false);
    const r = await get(`/public/organiser/${wsSlug}/thread/${threadSlug}`);
    expect(r.status, 'a published thread must stay reachable').toBe(200);
  });

  it('never puts the flag into the published payload', async () => {
    await setPublished(true);
    const body = (await (await get(`/public/organiser/${wsSlug}`)).json()) as Record<string, unknown>;
    expect(JSON.stringify(body).includes('site_is_published')).toBe(false);
  });

  // The other "never asked": no settings row at all. An older workspace that
  // never opened the editor has none, and `maybeSingle()` hands back null —
  // which must read as published, not as refused.
  it('a workspace with NO settings row at all still serves', async () => {
    const { error } = await service.from('thread_settings').delete().eq('workspace_id', ws);
    expect(error, 'fixture: could not remove the settings row').toBe(null);
    const r = await get(`/public/organiser/${wsSlug}`);
    expect(r.status, await r.clone().text()).toBe(200);
    // Put it back so afterAll's delete is not the first to notice.
    await service.from('thread_settings').insert({ workspace_id: ws });
  });
});
