// "Duplicate this thread" copies everything it should — and the next new
// column cannot slip past unnoticed.
//
// Sjoerd, 2026-10-14: "Why did a duplicate of a thread not copy the RSVP
// settings?" — the third time the duplicate's hand-written column list fell
// behind the tables (pricing, the daily schedule, now RSVP). The copy is now
// spelled out per table in lib/thread-copy.ts; this file proves two things
// against staging, through the real route:
//   1. COVERAGE — every real column of every copied table is copied, set or
//      skipped with a reason, and every name the spec uses is a real column.
//   2. BEHAVIOUR — the copy carries what Sjoerd expected (RSVP on the thread
//      and its sessions, the enrolment note) and keeps a code's ticket limit
//      pointing at the copy of that ticket.

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
let spec: typeof import('../lib/thread-copy.js');
let ws = '';
let organiser: FixtureUser;
let threadAppId = '';
let source = { thread: '', program: '', engagement: '', ticket: '', coupon: '', category: '' };
let copyId = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

/** A table's real columns, from one of its rows. */
async function columnsOf(table: string, filter: [string, string]): Promise<string[]> {
  const { data, error } = await service.from(table).select('*').eq(filter[0], filter[1]).limit(1);
  if (error) throw new Error(`${table}: ${error.message}`);
  expect(data?.length, `${table} has a fixture row to read columns from`).toBe(1);
  return Object.keys(data![0]!);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  spec = await import('../lib/thread-copy.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('dupe');
  organiser = await createFixtureUser(ws, 'dupe');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: organiser.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  const organiserId = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `dupe-${randomUUID().slice(0, 8)}` });

  source.program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Original', format: 'event', status: 'active' });
  source.thread = await insert('thread_thread', {
    workspace_id: ws,
    program_id: source.program,
    organiser_id: organiserId,
    slug: `orig-${randomUUID().slice(0, 6)}`,
    rsvp_enabled: true,
    enrolment_note: 'Bring your own mat.',
    // A text[] of the system-message roles already seeded: copied, because
    // the copy takes those messages along and must not be seeded twice.
    system_messages_seeded: ['enrolment_confirmed'],
  });
  source.engagement = await insert('thread_engagement', {
    workspace_id: ws,
    thread_id: source.thread,
    title: 'Session one',
    type: 'event',
    status: 'published',
    starts_at: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    rsvp_enabled: true,
  });
  source.ticket = await insert('thread_ticket', { workspace_id: ws, thread_id: source.thread, name: 'Early', price_cents: 1000, price_includes_vat: true, is_active: true });
  source.coupon = await insert('thread_coupon', {
    workspace_id: ws,
    thread_id: source.thread,
    code: `DUPE${randomUUID().slice(0, 4)}`,
    type: 'percentage',
    discount_percentage: 10,
    ticket_id: source.ticket,
    is_active: true,
  });
  source.category = await insert('thread_category', { workspace_id: ws, name: 'Yoga', slug: `yoga-${randomUUID().slice(0, 6)}` });
  await service.from('thread_thread_category').insert({ thread_id: source.thread, category_id: source.category });
}, 180_000);

afterAll(async () => {
  for (const t of [source.thread, copyId].filter(Boolean)) {
    await service.from('thread_thread_category').delete().eq('thread_id', t);
    await service.from('thread_coupon').delete().eq('thread_id', t);
    await service.from('thread_ticket').delete().eq('thread_id', t);
    await service.from('thread_engagement').delete().eq('thread_id', t);
  }
  if (copyId) {
    const { data } = await service.from('thread_thread').select('program_id').eq('id', copyId).maybeSingle();
    await service.from('thread_thread').delete().eq('id', copyId);
    if (data?.program_id) await service.from('program').delete().eq('id', data.program_id);
  }
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  await service.from('app_membership').delete().eq('user_id', organiser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiser.userId);
  await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('coverage: every column of every copied table is accounted for', () => {
  const cases = () =>
    [
      ['thread_thread', spec.THREAD_COPY, ['id', source.thread]],
      ['thread_engagement', spec.ENGAGEMENT_COPY, ['id', source.engagement]],
      ['thread_ticket', spec.TICKET_COPY, ['id', source.ticket]],
      ['thread_coupon', spec.COUPON_COPY, ['id', source.coupon]],
      ['thread_thread_category', spec.THREAD_CATEGORY_COPY, ['thread_id', source.thread]],
    ] as const;

  it('no real column is in none of copy / set / skip — a new column fails HERE, not for a customer', async () => {
    for (const [table, s, filter] of cases()) {
      const real = await columnsOf(table, filter as unknown as [string, string]);
      const known = spec.accountedFor(s);
      expect(real.filter((c) => !known.has(c)), `${table}: add each to copy, set or skip in lib/thread-copy.ts`).toEqual([]);
    }
  });

  it('every name the spec uses is a real column (a typo cannot quietly copy nothing)', async () => {
    for (const [table, s, filter] of cases()) {
      const real = new Set(await columnsOf(table, filter as unknown as [string, string]));
      expect([...spec.accountedFor(s)].filter((c) => !real.has(c)), table).toEqual([]);
    }
  });
});

describe('behaviour: the duplicate route copies what it should', () => {
  it('duplicates', async () => {
    const res = await app.request(`/api/v1/thread/threads/${source.thread}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organiser.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(201);
    copyId = (await res.json()).id;
  });

  it('RSVP is copied on the thread AND on its sessions (the bug)', async () => {
    const { data: t } = await service.from('thread_thread').select('rsvp_enabled, enrolment_note, system_messages_seeded, is_public_listed').eq('id', copyId).single();
    expect(t).toMatchObject({
      rsvp_enabled: true,
      enrolment_note: 'Bring your own mat.',
      system_messages_seeded: ['enrolment_confirmed'],
      is_public_listed: false,
    });
    const { data: e } = await service.from('thread_engagement').select('rsvp_enabled, title').eq('thread_id', copyId).eq('title', 'Session one').single();
    expect(e!.rsvp_enabled).toBe(true);
  });

  it("a code limited to one ticket stays limited — to that ticket's COPY", async () => {
    const { data: tickets } = await service.from('thread_ticket').select('id').eq('thread_id', copyId);
    const { data: coupon } = await service.from('thread_coupon').select('ticket_id, used_count').eq('thread_id', copyId).single();
    expect(tickets).toHaveLength(1);
    // The ticket's "price includes VAT" comes along (it was dropped until
    // this release: a €363 incl. ticket became €363 + VAT on the copy).
    const { data: tk } = await service.from('thread_ticket').select('price_cents, price_includes_vat').eq('id', tickets![0]!.id).single();
    expect(tk).toEqual({ price_cents: 1000, price_includes_vat: true });
    expect(coupon!.ticket_id).toBe(tickets![0]!.id);
    expect(coupon!.ticket_id).not.toBe(source.ticket);
    expect(coupon!.used_count ?? 0).toBe(0);
  });

  it('the category comes along', async () => {
    const { data } = await service.from('thread_thread_category').select('category_id').eq('thread_id', copyId);
    expect(data).toEqual([{ category_id: source.category }]);
  });
});
