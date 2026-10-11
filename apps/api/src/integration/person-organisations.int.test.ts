// Who a person runs their threads with — the link out that a person's page
// gains when it stops wearing the organisation's clothes.
//
// Q5 was the question docs/person-and-organisation-pages.md was least sure
// about: a person who runs threads for TWO workspaces. The answer is a list,
// and these cases exist mostly to pin that it needs no column — one organiser
// row per person, each thread carrying its own workspace, so the set is
// derived. If somebody later adds a "their organisation" field, the two-
// workspace case is what should stop them.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let app: Hono;
const tag = randomUUID().slice(0, 8);
let homeWs = '';
let otherWs = '';
let otherSlug = '';
let homeSlug = '';
let userId = '';
let organiserId = '';
const personSlug = `int-orgs-p-${tag}`;

type Org = { slug: string; name: string | null; linked: boolean };

const personPage = async (): Promise<{ organisations: Org[]; people: unknown[] }> => {
  const r = await app.request(`/api/v1/thread/public/organiser/${personSlug}`, {
    headers: { 'X-App-ID': 'the-thread' },
  });
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()) as { organisations: Org[]; people: unknown[] };
};

async function publishThread(ws: string, slug: string) {
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { data: prog, error: pErr } = await service
    .from('program')
    .insert({ workspace_id: ws, app_id: appRow!.id, title: `Int orgs ${slug}`, format: 'event', status: 'active' })
    .select('id')
    .single();
  if (pErr) throw new Error(`program: ${pErr.message}`);
  const { error } = await service.from('thread_thread').insert({
    workspace_id: ws,
    program_id: prog!.id,
    organiser_id: organiserId,
    slug,
    is_public_listed: true,
    public_scope: 'workspace',
  });
  if (error) throw new Error(`thread ${slug}: ${error.message}`);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  homeWs = await createThrowawayWorkspace('orgs-home');
  otherWs = await createThrowawayWorkspace('orgs-other');
  homeSlug = (await service.from('workspace').select('slug').eq('id', homeWs).single()).data!
    .slug as string;
  otherSlug = (await service.from('workspace').select('slug').eq('id', otherWs).single()).data!
    .slug as string;

  const { data: u } = await service
    .from('user')
    .insert({ workspace_id: homeWs, email: `${personSlug}@example.com`, full_name: 'Two Hats' })
    .select('id')
    .single();
  userId = u!.id as string;
  const { data: o, error } = await service
    .from('thread_organiser')
    .insert({ workspace_id: homeWs, user_id: userId, slug: personSlug, display_name: 'Two Hats' })
    .select('id')
    .single();
  if (error) throw new Error(`organiser: ${error.message}`);
  organiserId = o!.id as string;

  // The whole point of Q5: ONE organiser row, threads in TWO workspaces.
  await publishThread(homeWs, `int-orgs-home-${tag}`);
  await publishThread(otherWs, `int-orgs-other-${tag}`);
}, 90_000);

afterAll(async () => {
  await service.from('thread_thread').delete().eq('organiser_id', organiserId);
  for (const ws of [homeWs, otherWs]) {
    await service.from('program').delete().eq('workspace_id', ws);
    await service.from('thread_settings').delete().eq('workspace_id', ws);
  }
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('user').delete().eq('id', userId);
  await deleteThrowawayWorkspace(homeWs);
  await deleteThrowawayWorkspace(otherWs);
}, 90_000);

describe('the organisations on a person’s page', () => {
  // Q5, and the reason slice 4 needed no migration.
  it('lists BOTH workspaces a person publishes threads for', async () => {
    const { organisations } = await personPage();
    const slugs = organisations.map((o) => o.slug).sort();
    expect(slugs, JSON.stringify(organisations)).toEqual([homeSlug, otherSlug].sort());
  });

  it('links to them', async () => {
    const { organisations } = await personPage();
    expect(organisations.every((o) => o.linked)).toBe(true);
  });

  // The mirror of the people section's rule: an organisation whose own page
  // is off is NAMED, not linked. That somebody works with them is not the
  // secret; their page being off is a separate choice about that page.
  it('names, but does not link, an organisation whose page is switched off', async () => {
    const { error } = await service
      .from('thread_settings')
      .insert({ workspace_id: otherWs, site_is_published: false });
    expect(error, 'fixture: could not switch the other workspace off').toBe(null);

    const { organisations } = await personPage();
    const other = organisations.find((o) => o.slug === otherSlug);
    expect(other, 'it must still be named').toBeTruthy();
    expect(other!.linked, 'but not linked, because that page 404s').toBe(false);
    // And the one that is still on keeps its link.
    expect(organisations.find((o) => o.slug === homeSlug)!.linked).toBe(true);
  });

  // The split, in one assertion: a person's page carries organisations and
  // no people; an organisation's carries people and no organisations.
  it('a person’s page carries no people', async () => {
    const { people } = await personPage();
    expect(people).toEqual([]);
  });

  it('an organisation’s page carries no organisations', async () => {
    const r = await app.request(`/api/v1/thread/public/organiser/${homeSlug}`, {
      headers: { 'X-App-ID': 'the-thread' },
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = (await r.json()) as { owner_kind: string; organisations: Org[] };
    expect(body.owner_kind).toBe('workspace');
    expect(body.organisations).toEqual([]);
  });
});
