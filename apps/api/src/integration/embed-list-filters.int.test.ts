// The public thread list embed — include/exclude, `team`, and the explicit
// cap — against staging, through the real (published, no-auth) route.
//
// Everything here is ADDITIVE to GET /public/embed/threads: a single
// ?category= slug behaves exactly as before; new params narrow; new fields
// (`team`, `truncated`) are added, never renamed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let app: Hono;
let ws = '';
let wsSlug = '';
const made: { table: string; id: string }[] = [];
const ids: Record<string, string> = {};
const tag = randomUUID().slice(0, 6);

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const list = async (qs: string) => {
  const res = await app.request(`/api/v1/thread/public/embed/threads?workspace=${wsSlug}${qs}`, { headers: { 'X-App-ID': 'the-thread' } });
  expect(res.status, await res.clone().text()).toBe(200);
  return (await res.json()) as { items: { slug: string; team: { slug: string } | null }[]; truncated: boolean };
};
const slugs = (r: { items: { slug: string }[] }) => r.items.map((i) => i.slug).sort();

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('embedfilt');
  wsSlug = (await service.from('workspace').select('slug').eq('id', ws).single()).data!.slug as string;
  const { data: u } = await service.from('user').insert({ workspace_id: ws, email: `embed-${tag}@example.com` }).select('id').single();
  made.push({ table: 'user', id: u!.id as string });
  const org = await insert('thread_organiser', { user_id: u!.id, workspace_id: ws, slug: `embed-${tag}` });
  const choir = await insert('team', { workspace_id: ws, name: 'Choir', slug: `choir-${tag}` });
  const band = await insert('team', { workspace_id: ws, name: 'Band', slug: `band-${tag}` });
  const yoga = await insert('thread_category', { workspace_id: ws, name: 'Yoga', slug: `yoga-${tag}` });
  const music = await insert('thread_category', { workspace_id: ws, name: 'Music', slug: `music-${tag}` });

  const mk = async (key: string, opts: { status?: string; team?: string | null; cats?: string[] }) => {
    const program = await insert('program', { workspace_id: ws, app_id: appId, title: key, format: 'event', status: opts.status ?? 'active', starts_on: '2027-01-10' });
    const id = await insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: org, slug: `${key}-${tag}`, is_public_listed: true, team_id: opts.team ?? null });
    for (const c of opts.cats ?? []) await service.from('thread_thread_category').insert({ thread_id: id, category_id: c });
    ids[key] = id;
  };
  await mk('choir-yoga', { team: choir, cats: [yoga] });
  await mk('band-music', { team: band, cats: [music] });
  await mk('personal-none', { team: null });
  await mk('draft-one', { status: 'draft', team: choir, cats: [yoga] });
}, 180_000);

afterAll(async () => {
  for (const id of Object.values(ids)) await service.from('thread_thread_category').delete().eq('thread_id', id);
  for (const id of Object.values(ids)) await service.from('thread_thread').delete().eq('id', id);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the public list embed', () => {
  it('lists only showable threads (a draft never), each with its team', async () => {
    const r = await list('');
    expect(slugs(r)).toEqual([`band-music-${tag}`, `choir-yoga-${tag}`, `personal-none-${tag}`].sort());
    expect(r.items.find((i) => i.slug === `choir-yoga-${tag}`)!.team).toMatchObject({ slug: `choir-${tag}` });
    expect(r.items.find((i) => i.slug === `personal-none-${tag}`)!.team).toBeNull();
    expect(r.truncated).toBe(false);
  });
  it('a single ?category= slug behaves as before', async () => {
    expect(slugs(await list(`&category=yoga-${tag}`))).toEqual([`choir-yoga-${tag}`]);
  });
  it('?category= takes a comma list (any of them)', async () => {
    expect(slugs(await list(`&category=yoga-${tag},music-${tag}`))).toEqual([`band-music-${tag}`, `choir-yoga-${tag}`].sort());
  });
  it('?exclude_category= and ?exclude_team= take threads out', async () => {
    expect(slugs(await list(`&exclude_category=music-${tag}`))).toEqual([`choir-yoga-${tag}`, `personal-none-${tag}`].sort());
    expect(slugs(await list(`&exclude_team=choir-${tag}`))).toEqual([`band-music-${tag}`, `personal-none-${tag}`].sort());
  });
  it('more showable threads than the cap: truncated, and the draft is not what filled it', async () => {
    process.env.EMBED_LIST_CAP_FOR_TESTS = '2';
    try {
      const r = await list('');
      expect(r.items.length).toBe(2);
      expect(r.truncated).toBe(true);
    } finally {
      delete process.env.EMBED_LIST_CAP_FOR_TESTS;
    }
    process.env.EMBED_LIST_CAP_FOR_TESTS = '3';
    try {
      // Exactly three SHOWABLE threads: not truncated, though four rows
      // exist (the draft is filtered in the query, not after the cap).
      expect((await list('')).truncated).toBe(false);
    } finally {
      delete process.env.EMBED_LIST_CAP_FOR_TESTS;
    }
  });
});
