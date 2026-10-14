// A renamed thread keeps the links people already have (item 5) — against
// staging. Needs migration 20261014171844 (thread_slug_history).
//
//   · the old public address answers 404 with `moved_to`, which the Thread
//     page turns into a permanent redirect;
//   · a grant that still holds the OLD slug resolves through the history;
//   · an address nobody ever wore answers a plain 404, no moved_to.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let app: Hono;
let grant: typeof import('../lib/thread-grant.js');
let ws = '';
let threadId = '';
let programId = '';
const ownerSlug = `ren-${randomUUID().slice(0, 8)}`;
const oldSlug = `old-${randomUUID().slice(0, 6)}`;
const newSlug = `new-${randomUUID().slice(0, 6)}`;
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  grant = await import('../lib/thread-grant.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('rename');
  const user = await insert('user', { workspace_id: ws, email: `ren-${randomUUID().slice(0, 6)}@example.com` });
  const organiser = await insert('thread_organiser', { user_id: user, workspace_id: ws, slug: ownerSlug });
  programId = await insert('program', { workspace_id: ws, app_id: appId, title: 'Renamed', format: 'event', status: 'active' });
  threadId = await insert('thread_thread', { workspace_id: ws, program_id: programId, organiser_id: organiser, slug: newSlug, public_scope: 'personal' });
  await grant.recordSlugChange(threadId, ws, oldSlug);
}, 120_000);

afterAll(async () => {
  await service.from('thread_slug_history').delete().eq('workspace_id', ws);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

const lookup = (slug: string) =>
  app.request(`/api/v1/thread/public/organiser/${ownerSlug}/thread/${slug}`, { headers: { 'X-App-ID': 'the-thread' } });

describe('a renamed thread', () => {
  it('the new address answers', async () => {
    expect((await lookup(newSlug)).status).toBe(200);
  });

  it('the OLD address answers 404 with where it lives now', async () => {
    const res = await lookup(oldSlug);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ moved_to: { thread_slug: newSlug } });
  });

  it('an address nobody ever wore is a plain 404', async () => {
    const res = await lookup(`never-${randomUUID().slice(0, 6)}`);
    expect(res.status).toBe(404);
    expect((await res.json()).moved_to).toBeUndefined();
  });

  it('a grant still holding the old slug resolves through the history', async () => {
    expect(await grant.resolveGrantThread(ws, { thread_slug: oldSlug })).toMatchObject({
      ok: true,
      via: 'history',
      thread: { id: threadId, slug: newSlug },
    });
  });

  it('renamed and then made a DRAFT: the old address is a plain 404, never pointing at its new name', async () => {
    await service.from('program').update({ status: 'draft' }).eq('id', programId);
    try {
      const res = await lookup(oldSlug);
      expect(res.status).toBe(404);
      expect((await res.json()).moved_to).toBeUndefined();
    } finally {
      await service.from('program').update({ status: 'active' }).eq('id', programId);
    }
  });

  it('renamed and then ARCHIVED: also a plain 404', async () => {
    await service.from('program').update({ status: 'archived' }).eq('id', programId);
    try {
      expect((await (await lookup(oldSlug)).json()).moved_to).toBeUndefined();
    } finally {
      await service.from('program').update({ status: 'active' }).eq('id', programId);
    }
  });
});
