// What a thread card shows — saved in Settings, served to the embeds.
//
// Thread dates part 3 (Sjoerd, 2026-10-16): the workspace chooses what every
// card's date line shows (event dates / thread dates / only the thread's
// start / only the first event, + "N sessions", + "Sign up by …"); each embed
// may override it on the page. This proves the save and the two places the
// embeds read it back: the listing envelope and the public thread.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
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
let ws = '';
let admin: FixtureUser;
const made: { table: string; id: string }[] = [];
const orgSlug = `cards-${randomUUID().slice(0, 8)}`;
const threadSlug = `cards-${randomUUID().slice(0, 6)}`;

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}
const call = (method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/thread${path}`, {
    method,
    headers: { Authorization: `Bearer ${admin.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  ws = await createThrowawayWorkspace('cards');
  admin = await createFixtureUser(ws, 'cards-admin');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: admin.userId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  await call('GET', '/settings');
  const organiserId = await insert('thread_organiser', { user_id: admin.userId, workspace_id: ws, slug: orgSlug, display_name: 'Cards' });
  const programId = await insert('program', { workspace_id: ws, app_id: appId, title: 'Cards', format: 'event', status: 'active', starts_on: '2027-01-01' });
  await insert('thread_thread', { workspace_id: ws, program_id: programId, organiser_id: organiserId, slug: threadSlug, is_public_listed: true, timezone: 'Europe/Lisbon' });
}, 120_000);

afterAll(async () => {
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  await service.from('thread_settings').delete().eq('workspace_id', ws);
  await service.from('app_membership').delete().eq('user_id', admin.userId);
  await service.from('workspace_member').delete().eq('user_id', admin.userId);
  await service.from('workspace_app').delete().eq('workspace_id', ws);
  if (admin) await deleteFixtureUser(admin);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('the card date choice', () => {
  const listing = async () => {
    const r = await app.request(`/api/v1/thread/public/embed/threads?workspace=${ws}`);
    expect(r.status).toBe(200);
    return r.json();
  };
  const publicThread = async () => {
    const r = await app.request(`/api/v1/thread/public/organiser/${orgSlug}/thread/${threadSlug}`);
    expect(r.status, await r.clone().text()).toBe(200);
    return (await r.json()).thread;
  };

  it('unset: both read the default', async () => {
    const { DEFAULT_CARD_DATES } = await import('@thefibre/shared/thread-dates');
    expect((await listing()).card_dates).toEqual(DEFAULT_CARD_DATES);
    expect((await publicThread()).card_dates).toEqual(DEFAULT_CARD_DATES);
  });

  it('saved through Settings, the listing and the public thread both serve it', async () => {
    const choice = { range: 'start_event', sessions: false, signup_by: true };
    const r = await call('PATCH', '/settings', { card_dates: choice });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await listing();
    expect(body.card_dates).toEqual(choice);
    expect((await publicThread()).card_dates).toEqual(choice);
    // …and each item says which zone its dates are in.
    expect(body.items[0].timezone).toBe('Europe/Lisbon');
  });

  it('a value outside the choices is refused at the door', async () => {
    const r = await call('PATCH', '/settings', { card_dates: { range: 'everything', sessions: true, signup_by: true } });
    expect(r.status).toBe(400);
  });

  it('cleared, it falls back to the default', async () => {
    await call('PATCH', '/settings', { card_dates: null });
    const { DEFAULT_CARD_DATES } = await import('@thefibre/shared/thread-dates');
    expect((await listing()).card_dates).toEqual(DEFAULT_CARD_DATES);
  });
});
