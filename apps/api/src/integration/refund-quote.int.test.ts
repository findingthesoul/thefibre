// What the refund RULE says for a place (refund rules, slice 2, 2026-10-17).
// Against staging's database, the real routes; information only — nothing
// here moves money.
//
// Pinned:
//   · the workspace default and a thread's own rule save through the
//     ordinary settings / thread routes, and an invalid rule is refused (400)
//     with invalidRule's reason;
//   · the quote takes the thread's own rule over the workspace default;
//     `{"steps": []}` on the thread means no rule;
//   · it counts at the date it is given (the REQUEST's, C): 100% far out, 50%
//     inside the second step, 0% after the last, with the fixed fee kept (A)
//     and changes_at naming when it drops;
//   · nothing paid → no quote.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let admin: FixtureUser;
let threadId = '';
let programId = '';
const placeId = randomUUID();
const DAY = 86_400_000;
// The thread starts at MIDNIGHT IN ITS OWN ZONE (Europe/Amsterdam, the
// default), not UTC, since v1.272.3 (startInstant): 1 Mar 2027 00:00 CET is
// 28 Feb 23:00Z. This said `Date.UTC(2027, 2, 1)` until v1.277.21: it was
// written for slice 2, went red when v1.272.3 moved the start into the
// thread's zone, and was not re-run then. The product's cutoff an hour
// earlier is the right one; the test was wrong.
const start = new Date('2027-02-28T23:00:00.000Z');
const startsOn = '2027-03-01';

const call = (method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/thread${path}`, {
    method,
    headers: { Authorization: `Bearer ${admin.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('refund-quote');
  admin = await createFixtureUser(ws, 'refund-quote-admin');
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  const threadApp = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadApp }, { onConflict: 'workspace_id,app_id' });
  await service.from('app_membership').upsert({ user_id: admin.userId, app_id: threadApp, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('thread_settings').upsert({ workspace_id: ws }, { onConflict: 'workspace_id' });
  const org = (await service.from('thread_organiser').insert({ user_id: admin.userId, workspace_id: ws, slug: `rq-${randomUUID().slice(0, 6)}` }).select('id').single()).data!.id as string;
  programId = (await service.from('program').insert({ workspace_id: ws, app_id: threadApp, title: 'Refund quote', format: 'event', status: 'active', starts_on: startsOn }).select('id').single()).data!.id as string;
  threadId = (await service.from('thread_thread').insert({ workspace_id: ws, program_id: programId, organiser_id: org, slug: `rq-${randomUUID().slice(0, 6)}` }).select('id').single()).data!.id as string;
  // The ledger row for one paid place (the quote reads only the ledger).
  await service.from('purchase').insert({ workspace_id: ws, app_id: threadApp, item_label: 'Refund quote place', item_ref: placeId, amount_cents: 10_000, currency: 'EUR', method: 'stripe', status: 'paid' });
}, 180_000);

afterAll(async () => {
  if (admin) {
    await service.from('app_membership').delete().eq('user_id', admin.userId);
    await service.from('workspace_member').delete().eq('user_id', admin.userId);
  }
  if (threadId) await service.from('thread_thread').delete().eq('id', threadId);
  if (programId) await service.from('program').delete().eq('id', programId);
  await service.from('thread_organiser').delete().eq('workspace_id', ws);
  if (admin) await deleteFixtureUser(admin);
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
}, 180_000);

const quote = async (at: Date) => (await import('../lib/refund-quote.js')).quoteForPlace(placeId, threadId, at);

describe('saving a rule', () => {
  it('the workspace default saves through Settings; an invalid rule is refused', async () => {
    const bad = await call('PATCH', '/settings', { refund_rule: { steps: [{ until_days_before: 7, refund_pct: 150 }] } });
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain('a percentage is between 0 and 100');
    const ok = await call('PATCH', '/settings', { refund_rule: { steps: [{ until_days_before: 30, refund_pct: 100 }, { until_days_before: 7, refund_pct: 50 }], fee_cents: 1000 } });
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect(((await ok.json()) as { refund_rule: unknown }).refund_rule).toMatchObject({ fee_cents: 1000 });
  });

  it('a thread’s own rule saves through the thread route, and comes back on read', async () => {
    const bad = await call('PATCH', `/threads/${threadId}`, { refund_rule: { steps: [{ until_days_before: 7, refund_pct: 50 }, { until_days_before: 7, refund_pct: 20 }] } });
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain('two steps on the same day');
  });
});

describe('the quote', () => {
  it('counts the workspace default at the date given (C), keeping the fee (A)', async () => {
    const far = await quote(new Date(start.getTime() - 40 * DAY));
    expect(far).toMatchObject({ pct: 100, fee_cents: 1000, refund_cents: 9000, currency: 'EUR', paid_cents: 10_000, rule_source: 'workspace', reason: 'step' });
    expect(far!.changes_at).toBe(new Date(start.getTime() - 30 * DAY).toISOString());
    expect(far!.next_pct).toBe(50);
    expect((await quote(new Date(start.getTime() - 10 * DAY)))!.next_pct).toBe(0);
    const mid = await quote(new Date(start.getTime() - 10 * DAY));
    expect(mid).toMatchObject({ pct: 50, refund_cents: 4000 });
    const late = await quote(new Date(start.getTime() - 2 * DAY));
    expect(late).toMatchObject({ pct: 0, refund_cents: 0, fee_cents: 0, reason: 'after_last_step', changes_at: null, next_pct: null });
  });

  it('the thread’s own rule wins; {steps: []} on the thread means no rule', async () => {
    expect((await call('PATCH', `/threads/${threadId}`, { refund_rule: { steps: [{ until_days_before: 1, refund_pct: 80 }] } })).status).toBe(200);
    expect(await quote(new Date(start.getTime() - 10 * DAY))).toMatchObject({ pct: 80, refund_cents: 8000, rule_source: 'thread' });
    expect((await call('PATCH', `/threads/${threadId}`, { refund_rule: { steps: [] } })).status).toBe(200);
    expect(await quote(new Date(start.getTime() - 10 * DAY))).toMatchObject({ reason: 'no_rule', refund_cents: 10_000, rule_source: null });
    // null = inherit the workspace default again.
    expect((await call('PATCH', `/threads/${threadId}`, { refund_rule: null })).status).toBe(200);
    expect(await quote(new Date(start.getTime() - 10 * DAY))).toMatchObject({ pct: 50, rule_source: 'workspace' });
  });

  it('nothing paid → no quote', async () => {
    expect(await (await import('../lib/refund-quote.js')).quoteForPlace(randomUUID(), threadId, new Date())).toBeNull();
  });
});
