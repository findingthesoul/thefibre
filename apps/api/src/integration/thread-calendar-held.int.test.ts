// Who holds which session in their calendar (calendar gaps, slice 1,
// 2026-10-17). Against staging; runs after db-push-staging.
//
// Pinned:
//   · one row per (session, address): a second insert is refused (23505),
//     an upsert updates it in place (REQUEST → CANCEL, sequence up);
//   · method and source accept only their values;
//   · the row outlives its session (no FK on engagement_id);
//   · nobody signed in reads it (RLS on, no policy) — service role only;
//   · a thread with rows deletes cleanly (cascade), and its workspace after;
//   · a user hard-delete leaves the rows (email is not a key) — the manual
//     erasure step removes them.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { anonKey, createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, url, type FixtureUser } from './staging.js';

let ws = '';
let threadId = '';
let programId = '';
let u: FixtureUser | undefined;

async function makeThread(workspaceId: string): Promise<{ thread: string; program: string }> {
  const app = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  const user = (await service.from('user').insert({ workspace_id: workspaceId, email: `int-held-${randomUUID().slice(0, 8)}@example.com` }).select('id').single()).data!.id as string;
  const org = (await service.from('thread_organiser').insert({ user_id: user, workspace_id: workspaceId, slug: `held-${randomUUID().slice(0, 6)}` }).select('id').single()).data!.id as string;
  const program = (await service.from('program').insert({ workspace_id: workspaceId, app_id: app, title: 'Held', format: 'event', status: 'active' }).select('id').single()).data!.id as string;
  const thread = (await service.from('thread_thread').insert({ workspace_id: workspaceId, program_id: program, organiser_id: org, slug: `held-${randomUUID().slice(0, 6)}` }).select('id').single()).data!.id as string;
  return { thread, program };
}

const row = (engagement: string, over: Record<string, unknown> = {}) => ({
  workspace_id: ws,
  thread_id: threadId,
  engagement_id: engagement,
  email: 'ann@example.com',
  method: 'REQUEST',
  sequence: 0,
  source: 'window',
  ...over,
});

beforeAll(async () => {
  ws = await createThrowawayWorkspace('calendar-held');
  ({ thread: threadId, program: programId } = await makeThread(ws));
  u = await createFixtureUser(ws, 'held-reader');
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
}, 120_000);

afterAll(async () => {
  if (u) {
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  await service.from('thread_calendar_held').delete().eq('workspace_id', ws);
  if (threadId) await service.from('thread_thread').delete().eq('id', threadId);
  if (programId) await service.from('program').delete().eq('id', programId);
  await service.from('thread_organiser').delete().eq('workspace_id', ws);
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
}, 120_000);

describe('one row per session and address', () => {
  it('a second insert is refused; an upsert updates in place', async () => {
    const e = randomUUID(); // no FK: the session need not exist
    expect((await service.from('thread_calendar_held').insert(row(e))).error).toBeNull();
    expect((await service.from('thread_calendar_held').insert(row(e, { email: 'ANN@example.com' }))).error?.code).toBe('23505');
    const up = await service
      .from('thread_calendar_held')
      .upsert(row(e, { method: 'CANCEL', sequence: 3, source: 'thread_end' }), { onConflict: 'engagement_id,email' })
      .select('method, sequence, source');
    expect(up.error).toBeNull();
    expect(up.data).toEqual([{ method: 'CANCEL', sequence: 3, source: 'thread_end' }]);
  });

  it('method and source take only their values', async () => {
    expect((await service.from('thread_calendar_held').insert(row(randomUUID(), { method: 'PUBLISH' }))).error?.code).toBe('23514');
    expect((await service.from('thread_calendar_held').insert(row(randomUUID(), { source: 'other' }))).error?.code).toBe('23514');
    expect((await service.from('thread_calendar_held').insert(row(randomUUID(), { sequence: -1 }))).error?.code).toBe('23514');
  });
});

describe('who reads it', () => {
  it('nobody signed in — a workspace admin sees no rows and cannot write', async () => {
    await service.from('thread_calendar_held').insert(row(randomUUID(), { email: 'bob@example.com' }));
    const db = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${u!.accessToken}` } } });
    const r = await db.from('thread_calendar_held').select('id');
    expect(r.data ?? []).toEqual([]);
    expect((await db.from('thread_calendar_held').insert(row(randomUUID()))).error).not.toBeNull();
  });
});

describe('deleting', () => {
  it('a thread with rows deletes (the rows with it), and its workspace then hard-deletes', async () => {
    const doomed = await createThrowawayWorkspace('calendar-held-doomed');
    const t = await makeThread(doomed);
    const e = randomUUID();
    expect((await service.from('thread_calendar_held').insert({ ...row(e), workspace_id: doomed, thread_id: t.thread })).error).toBeNull();
    // The workspace's thread + program go with it; organisers and users are
    // the helper's to remove.
    await service.from('thread_thread').delete().eq('id', t.thread);
    await service.from('program').delete().eq('id', t.program);
    await service.from('thread_organiser').delete().eq('workspace_id', doomed);
    expect(await deleteThrowawayWorkspace(doomed)).toBe(true);
    expect((await service.from('thread_calendar_held').select('id').eq('engagement_id', e)).data).toEqual([]);
  });
});

describe('a person going', () => {
  it('a user hard-delete leaves their rows (email is not a key): erasure removes them by hand', async () => {
    const gone = await createFixtureUser(ws, 'held-gone');
    const e = randomUUID();
    expect((await service.from('thread_calendar_held').insert(row(e, { email: gone.email }))).error).toBeNull();
    await deleteFixtureUser(gone);
    expect((await service.from('user').select('id').eq('id', gone.userId)).data).toEqual([]);
    expect((await service.from('thread_calendar_held').select('id').eq('engagement_id', e)).data).toHaveLength(1);
    // The manual erasure step (docs/data-protection-approach.md §3.7).
    await service.from('thread_calendar_held').delete().eq('email', gone.email.toLowerCase());
    expect((await service.from('thread_calendar_held').select('id').eq('engagement_id', e)).data).toEqual([]);
  });
});
