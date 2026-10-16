// "Save as template" and "new thread from template" carry everything they
// should — and the next new column cannot slip past unnoticed.
//
// Same disease as the duplicate route, cured the same way: one spec
// (lib/thread-template-spec.ts) used in both directions, and this file proves
// against staging, through the real routes:
//   1. COVERAGE — every real column of the captured tables is carried, set or
//      skipped with a reason, and every name the spec uses is a real column;
//   2. ROUND TRIP — what was set on a thread arrives on the thread made from
//      its template (RSVP, the enrolment note, sign-up open), and its system
//      messages arrive ONCE, not a second set on first open.

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
let spec: typeof import('../lib/thread-template-spec.js');
let ws = '';
let organiser: FixtureUser;
let sourceThread = '';
let sourceEngagement = '';
let sourceTicket = '';
let templateId = '';
let madeThread = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const call = (path: string, init: RequestInit = {}) =>
  app.request(`/api/v1/thread${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${organiser.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
  });

async function columnsOf(table: string, id: string): Promise<string[]> {
  const { data, error } = await service.from(table).select('*').eq('id', id).limit(1);
  if (error) throw new Error(`${table}: ${error.message}`);
  expect(data?.length, `${table} fixture row`).toBe(1);
  return Object.keys(data![0]!);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  spec = await import('../lib/thread-template-spec.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('tpl');
  organiser = await createFixtureUser(ws, 'tpl');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: organiser.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  // Designing templates is a Pro feature; this test is not about plans.
  const { error: subErr } = await service
    .from('workspace_subscription')
    .upsert({ workspace_id: ws, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' });
  if (subErr) throw new Error(`subscription fixture: ${subErr.message}`);

  const organiserId = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `tpl-${randomUUID().slice(0, 8)}` });
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Template source', format: 'event', status: 'draft', starts_on: '2027-03-01', ends_on: '2027-03-03' });
  sourceThread = await insert('thread_thread', {
    workspace_id: ws,
    program_id: program,
    organiser_id: organiserId,
    slug: `tpl-src-${randomUUID().slice(0, 6)}`,
    rsvp_enabled: true,
    enrolment_note: 'Bring your own mat.',
    public_enrolment_open: false,
  });
  sourceEngagement = await insert('thread_engagement', {
    workspace_id: ws,
    thread_id: sourceThread,
    title: 'Session one',
    type: 'event',
    status: 'published',
    starts_at: '2027-03-01T10:00:00Z',
    ends_at: '2027-03-01T11:00:00Z',
    rsvp_enabled: true,
  });
  sourceTicket = await insert('thread_ticket', { workspace_id: ws, thread_id: sourceThread, name: 'Early', price_cents: 1000, price_includes_vat: true, is_active: true });
}, 180_000);

afterAll(async () => {
  for (const t of [sourceThread, madeThread].filter(Boolean)) {
    await service.from('thread_ticket').delete().eq('thread_id', t);
    await service.from('thread_engagement').delete().eq('thread_id', t);
    await service.from('thread_thread_category').delete().eq('thread_id', t);
  }
  if (madeThread) {
    const { data } = await service.from('thread_thread').select('program_id').eq('id', madeThread).maybeSingle();
    await service.from('thread_thread').delete().eq('id', madeThread);
    if (data?.program_id) await service.from('program').delete().eq('id', data.program_id);
  }
  if (templateId) await service.from('thread_template').delete().eq('id', templateId);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  await service.from('app_membership').delete().eq('user_id', organiser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiser.userId);
  await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('coverage: every column the template touches is accounted for', () => {
  const cases = () =>
    [
      ['thread_thread', spec.TEMPLATE_THREAD, sourceThread],
      ['thread_engagement', spec.TEMPLATE_ENGAGEMENT, sourceEngagement],
      ['thread_ticket', spec.TEMPLATE_TICKET, sourceTicket],
    ] as const;

  it('no real column is in none of carry / set / skip', async () => {
    for (const [table, s, id] of cases()) {
      const real = await columnsOf(table, id);
      const known = spec.accountedFor(s);
      expect(real.filter((c) => !known.has(c)), `${table}: add each to carry, set or skip in lib/thread-template-spec.ts`).toEqual([]);
    }
  });

  it('every name the spec uses is a real column', async () => {
    for (const [table, s, id] of cases()) {
      const real = new Set(await columnsOf(table, id));
      expect([...spec.accountedFor(s)].filter((c) => !real.has(c)), table).toEqual([]);
    }
  });
});

describe('round trip: save as template, then a new thread from it', () => {
  it('saves', async () => {
    // The system messages, as a real thread has them after its first open.
    const detail = await call(`/threads/${sourceThread}`);
    expect(detail.status).toBe(200);
    const res = await call(`/threads/${sourceThread}/save-as-template`, { method: 'POST', body: JSON.stringify({ title: 'Round trip', scope: 'personal' }) });
    expect(res.status, await res.clone().text()).toBe(201);
    templateId = (await res.json()).id;
  });

  it('applies, carrying what was set — RSVP, the note, sign-up closed, the session’s RSVP', async () => {
    const res = await call(`/thread-templates/${templateId}/instantiate`, {
      method: 'POST',
      body: JSON.stringify({ title: 'From the template', slug: `tpl-new-${randomUUID().slice(0, 6)}`, starts_on: '2027-06-01' }),
    });
    expect(res.status, await res.clone().text()).toBe(201);
    madeThread = (await res.json()).id;
    const { data: t } = await service.from('thread_thread').select('rsvp_enabled, enrolment_note, public_enrolment_open').eq('id', madeThread).single();
    expect(t).toEqual({ rsvp_enabled: true, enrolment_note: 'Bring your own mat.', public_enrolment_open: false });
    const { data: e } = await service.from('thread_engagement').select('rsvp_enabled, starts_at').eq('thread_id', madeThread).eq('title', 'Session one').single();
    expect(e!.rsvp_enabled).toBe(true);
    expect(e!.starts_at).toMatch(/^2027-06-01T10:00/);
    // The ticket's "price includes VAT" is carried (dropped until this release).
    const { data: tk } = await service.from('thread_ticket').select('price_cents, price_includes_vat').eq('thread_id', madeThread);
    expect(tk).toEqual([{ price_cents: 1000, price_includes_vat: true }]);
  });

  it('its system messages arrive ONCE — opening the new thread seeds no second set', async () => {
    const { data: before } = await service.from('thread_engagement').select('system_role').eq('thread_id', madeThread).not('system_role', 'is', null);
    expect((before ?? []).length, 'the template brought system messages').toBeGreaterThan(0);
    expect((await call(`/threads/${madeThread}`)).status).toBe(200); // first open
    const { data: after } = await service.from('thread_engagement').select('system_role').eq('thread_id', madeThread).not('system_role', 'is', null);
    const roles = (after ?? []).map((r) => r.system_role as string);
    expect(roles.length, `roles: ${roles.join(', ')}`).toBe(new Set(roles).size);
    expect(roles.length).toBe((before ?? []).length);
  });
});
