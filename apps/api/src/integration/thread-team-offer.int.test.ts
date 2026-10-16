// A thread offered to more than one team (Sjoerd, 2026-10-16: "Yes, build
// it"). One owner keeps the address and the money; an OFFERED team's members
// see the thread as their own team's.
//
// Against staging, real tables, a throwaway workspace. Three teams: A owns,
// B is offered, C is a third team that must see NOTHING. For every reader
// that used to compare team_id itself, the same two questions:
//   does B's member get it exactly as an owned thread?   (yes)
//   does C's member get it at all?                       (no)
// Readers: the one reader (lib/thread-teams.ts), the member discount (hint
// and price), could-join (my.thread / team calendar), member-notify (the
// new-thread pass), the ?team= embed and the public team page. Plus the
// routes, and the case the coordinator named: the OWNER changes to a team
// that already holds an offer — it is the owner once, not twice.
//
// Email is captured, never sent.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: vi.fn(async () => undefined),
}));

let app: Hono;
let ws = '';
let wsSlug = '';
let threadAppId = '';
let organiserId = '';
let admin: FixtureUser;
let plain: FixtureUser;
const team = { a: { id: '', slug: '' }, b: { id: '', slug: '' }, c: { id: '', slug: '' } };
const person: Record<'b' | 'c' | 'ab', string> = { b: '', c: '', ab: '' };
const membership: Record<'b' | 'c' | 'ab', string> = { b: '', c: '', ab: '' };
const th = { owned: { id: '', slug: '' }, ws: { id: '', slug: '' }, moved: { id: '', slug: '' } };
const BASELINE = `member_notify_baseline_test_${randomUUID().slice(0, 8)}`;
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

async function thread(title: string, teamId: string | null, scope: 'team' | 'workspace') {
  const program = await insert('program', {
    workspace_id: ws, app_id: threadAppId, title, format: 'event', status: 'active',
    starts_on: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
  });
  const slug = `tto-${randomUUID().slice(0, 8)}`;
  const id = await insert('thread_thread', {
    workspace_id: ws, program_id: program, organiser_id: organiserId, team_id: teamId, slug,
    public_scope: scope, public_enrolment_open: true, is_public_listed: true, price_cents: 0,
  });
  return { id, slug };
}

const call = (who: FixtureUser | null, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/thread${path}`, {
    method,
    headers: {
      'X-App-ID': 'the-thread',
      'Content-Type': 'application/json',
      ...(who ? { Authorization: `Bearer ${who.accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function seat(u: FixtureUser, role: 'admin' | 'organiser') {
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: u.userId, workspace_role: role });
  await service.from('app_membership').upsert({ user_id: u.userId, app_id: threadAppId, role: 'admin', is_direct: true }, { onConflict: 'user_id,app_id' });
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  const { threadTeamOfferRoutes } = await import('../routes/thread-team-offers.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  v1.route('/thread', threadTeamOfferRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  ws = await createThrowawayWorkspace('teamoffer');
  wsSlug = (await service.from('workspace').select('slug').eq('id', ws).single()).data!.slug as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  for (const k of ['a', 'b', 'c'] as const) {
    team[k].slug = `tto-${k}-${randomUUID().slice(0, 6)}`;
    team[k].id = await insert('team', { workspace_id: ws, name: `Team ${k.toUpperCase()}`, slug: team[k].slug });
    await service.from('team').update({ is_published: true, is_active: true }).eq('id', team[k].id);
  }
  const orgUser = await insert('user', { workspace_id: ws, email: `tto-org-${randomUUID().slice(0, 6)}@example.com` });
  organiserId = await insert('thread_organiser', { user_id: orgUser, workspace_id: ws, slug: `tto-org-${randomUUID().slice(0, 6)}` });
  admin = await createFixtureUser(ws, 'tto-admin');
  plain = await createFixtureUser(ws, 'tto-plain');
  await seat(admin, 'admin');
  await seat(plain, 'organiser');

  // Tiers: B's calendar at 50%, C's at 30%, and one tier carrying BOTH A (20%)
  // and B (60%) — the member of two calendars a thread is for.
  const tier = async (name: string, grants: [string, number][]) => {
    const id = await insert('membership_tier', { workspace_id: ws, name });
    for (const [t, pct] of grants) {
      await insert('membership_access_grant', { workspace_id: ws, tier_id: id, kind: 'team_calendar', config: { team_id: t, discount_pct: pct } });
    }
    return id;
  };
  const tiers = { b: await tier('B', [[team.b.id, 50]]), c: await tier('C', [[team.c.id, 30]]), ab: await tier('AB', [[team.a.id, 20], [team.b.id, 60]]) };
  for (const k of ['b', 'c', 'ab'] as const) {
    person[k] = await insert('person', { workspace_id: ws, first_name: k.toUpperCase(), email: `tto-${k}-${randomUUID().slice(0, 6)}@example.com` });
    membership[k] = await insert('membership_member', {
      workspace_id: ws, person_id: person[k], tier_id: tiers[k], status: 'active', renews_at: '2099-01-01T00:00:00Z',
    });
  }

  th.owned = await thread('Owned by A', team.a.id, 'team');
  th.ws = await thread('Workspace thread', null, 'workspace');
  th.moved = await thread('Owner moves', team.a.id, 'team');
}, 240_000);

afterAll(async () => {
  if (ws) {
    await service.from('member_notification').delete().eq('workspace_id', ws);
    await service.from('thread_calendar_seen').delete().eq('workspace_id', ws);
    await service.from('membership_settings').delete().eq('workspace_id', ws);
    await service.from('thread_team_offer').delete().eq('workspace_id', ws);
  }
  await service.from('platform_setting').delete().eq('key', BASELINE);
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  for (const u of [admin, plain].filter(Boolean)) {
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 240_000);

describe('offering — the routes', () => {
  it('only the organiser, a lead of the owning team or a workspace admin may offer', async () => {
    const r = await call(plain, 'PUT', `/threads/${th.owned.id}/team-offers`, { team_ids: [team.b.id] });
    expect(r.status).toBe(403);
  });

  it('an admin offers A’s thread to B; asking for the owner A too is a no-op', async () => {
    const r = await call(admin, 'PUT', `/threads/${th.owned.id}/team-offers`, { team_ids: [team.b.id, team.a.id] });
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await r.json()) as { owner_team_id: string; offers: { team_id: string; name: string }[] };
    expect(j.owner_team_id).toBe(team.a.id);
    expect(j.offers.map((o) => o.team_id)).toEqual([team.b.id]);
    // The workspace thread (no owner team) is offered to B too.
    const w = await call(admin, 'PUT', `/threads/${th.ws.id}/team-offers`, { team_ids: [team.b.id] });
    expect(w.status).toBe(200);
  });

  it('a team from another workspace is refused', async () => {
    const r = await call(admin, 'PUT', `/threads/${th.owned.id}/team-offers`, { team_ids: [randomUUID()] });
    expect(r.status).toBe(400);
  });
});

describe('the one reader', () => {
  it('owner ∪ offers; the inverse finds owned and offered; C finds neither', async () => {
    const { audienceTeams, threadsForTeams } = await import('../lib/thread-teams.js');
    const aud = await audienceTeams([th.owned.id, th.ws.id]);
    expect([...aud.get(th.owned.id)!].sort()).toEqual([team.a.id, team.b.id].sort());
    expect([...aud.get(th.ws.id)!]).toEqual([team.b.id]);
    const forB = await threadsForTeams([team.b.id]);
    expect(forB.has(th.owned.id)).toBe(true);
    expect(forB.has(th.ws.id)).toBe(true);
    const forC = await threadsForTeams([team.c.id]);
    expect(forC.has(th.owned.id)).toBe(false);
    expect(forC.has(th.ws.id)).toBe(false);
  });
});

describe('the member discount', () => {
  it('B’s member gets B’s percentage on A’s thread; C’s member none; a member of A and B the higher', async () => {
    const { memberDiscountFor, memberDiscountOffered } = await import('../lib/member-discount.js');
    expect(await memberDiscountFor(person.b, th.owned.id)).toMatchObject({ pct: 50 });
    expect(await memberDiscountFor(person.c, th.owned.id)).toBeNull();
    expect(await memberDiscountFor(person.ab, th.owned.id)).toMatchObject({ pct: 60 });
    // A workspace thread offered to B: B's percentage, where before it had none.
    expect(await memberDiscountFor(person.b, th.ws.id)).toMatchObject({ pct: 50 });
    // The public hint: the best any tier offers for the thread's teams.
    expect(await memberDiscountOffered(th.owned.id)).toBe(60);
  });
});

describe('could-join (my.thread, the team calendar)', () => {
  it('B’s member sees A’s thread on B’s calendar; C’s member does not', async () => {
    const { couldJoinByMember } = await import('../lib/could-join.js');
    const out = await couldJoinByMember(
      (['b', 'c', 'ab'] as const).map((k) => ({ id: membership[k], person_id: person[k], workspace_id: ws })),
      new Map(),
      null,
    );
    const rowB = (out.get(membership.b) ?? []).find((r) => r.thread_id === th.owned.id);
    expect(rowB, 'B’s member was not offered A’s thread').toBeTruthy();
    expect(rowB).toMatchObject({ team: 'Team B', pct: 50, owner_slug: team.a.slug });
    expect((out.get(membership.b) ?? []).some((r) => r.thread_id === th.ws.id)).toBe(true);
    expect((out.get(membership.c) ?? []).some((r) => r.thread_id === th.owned.id || r.thread_id === th.ws.id)).toBe(false);
    // The member of A and B: one row, at the higher percentage.
    const rowsAB = (out.get(membership.ab) ?? []).filter((r) => r.thread_id === th.owned.id);
    expect(rowsAB).toHaveLength(1);
    expect(rowsAB[0]).toMatchObject({ pct: 60, team: 'Team B' });
  });
});

describe('the public listings', () => {
  it('?team=B lists A’s thread, linking to A’s address; ?team=C does not', async () => {
    const r = await call(null, 'GET', `/public/embed/threads?team=${team.b.id}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const items = ((await r.json()) as { items: { slug: string; url: string }[] }).items;
    const it = items.find((i) => i.slug === th.owned.slug);
    expect(it, `listed: ${items.map((i) => i.slug).join(', ')}`).toBeTruthy();
    expect(it!.url).toContain(`/${team.a.slug}/${th.owned.slug}`);
    const c = ((await (await call(null, 'GET', `/public/embed/threads?team=${team.c.id}`)).json()) as { items: { slug: string }[] }).items;
    expect(c.some((i) => i.slug === th.owned.slug)).toBe(false);
  });

  it('B’s public page lists it with path = A’s address; the thread is NOT served under B', async () => {
    const r = await call(null, 'GET', `/public/organiser/${team.b.slug}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const threads = ((await r.json()) as { threads: { slug: string; path: string | null }[] }).threads;
    expect(threads.find((t) => t.slug === th.owned.slug)?.path).toBe(`/${team.a.slug}/${th.owned.slug}`);
    expect(threads.find((t) => t.slug === th.ws.slug)?.path).toBe(`/${wsSlug}/${th.ws.slug}`);
    // One address, one owner: under B's address it is not found.
    const under = await call(null, 'GET', `/public/organiser/${team.b.slug}/thread/${th.owned.slug}`);
    expect(under.status).not.toBe(200);
    const c = ((await (await call(null, 'GET', `/public/organiser/${team.c.slug}`)).json()) as { threads: { slug: string }[] }).threads;
    expect(c.some((t) => t.slug === th.owned.slug)).toBe(false);
  });
});

describe('member-notify (a team’s followers hear about a new thread)', () => {
  it('a NEW thread offered to B is announced to B’s followers, not to C’s', async () => {
    const notify = await import('../lib/member-notify.js');
    await service.from('membership_settings').upsert({ workspace_id: ws, notify_members: true }, { onConflict: 'workspace_id' });
    const pass = () => notify.runNewThreadPass(new Date(), { workspaceIds: [ws], baselineKey: BASELINE });
    // The first pass records what is there and tells nobody.
    expect((await pass()).told).toBe(0);
    const fresh = await thread('New, workspace, offered to B', null, 'workspace');
    await service.from('thread_team_offer').insert({ workspace_id: ws, thread_id: fresh.id, team_id: team.b.id });
    const r = await pass();
    expect(r.announced).toBe(1);
    const { data } = await service.from('member_notification').select('person_id').eq('thread_id', fresh.id);
    const told = new Set((data ?? []).map((x) => x.person_id as string));
    expect(told.has(person.b)).toBe(true);
    expect(told.has(person.ab)).toBe(true);
    expect(told.has(person.c)).toBe(false);
  });
});

describe('the receiving team', () => {
  it('B’s side lists what is offered to it, and an admin can take one off', async () => {
    const r = await call(admin, 'GET', `/teams/${team.b.id}/offered`);
    const j = (await r.json()) as { items: { thread_id: string }[]; can_remove: boolean };
    expect(j.can_remove).toBe(true);
    expect(j.items.map((i) => i.thread_id)).toEqual(expect.arrayContaining([th.owned.id, th.ws.id]));
    expect((await call(plain, 'DELETE', `/teams/${team.b.id}/offered/${th.ws.id}`)).status).toBe(403);
    expect((await call(admin, 'DELETE', `/teams/${team.b.id}/offered/${th.ws.id}`)).status).toBe(200);
    const { threadsForTeams } = await import('../lib/thread-teams.js');
    expect((await threadsForTeams([team.b.id])).has(th.ws.id)).toBe(false);
  });
});

describe('the owner changes to a team that already holds an offer', () => {
  it('it is the owner ONCE: one audience entry, not listed as "offered to" itself', async () => {
    await service.from('thread_team_offer').insert({ workspace_id: ws, thread_id: th.moved.id, team_id: team.b.id });
    // The guard checks inserts; an owner change is an update of the THREAD.
    const up = await service.from('thread_thread').update({ team_id: team.b.id }).eq('id', th.moved.id);
    expect(up.error).toBeNull();
    const { audienceTeamsOf } = await import('../lib/thread-teams.js');
    expect([...(await audienceTeamsOf(th.moved.id))]).toEqual([team.b.id]);
    const offers = ((await (await call(admin, 'GET', `/threads/${th.moved.id}/team-offers`)).json()) as { offers: { team_id: string }[] }).offers;
    expect(offers).toEqual([]);
    const offered = ((await (await call(admin, 'GET', `/teams/${team.b.id}/offered`)).json()) as { items: { thread_id: string }[] }).items;
    expect(offered.some((i) => i.thread_id === th.moved.id)).toBe(false);
    // Saving the (empty) list drops the stale row.
    await call(admin, 'PUT', `/threads/${th.moved.id}/team-offers`, { team_ids: [] });
    const { data } = await service.from('thread_team_offer').select('id').eq('thread_id', th.moved.id);
    expect(data ?? []).toEqual([]);
    // And B's member still gets it — now as B's own thread, at 50%.
    const { memberDiscountFor } = await import('../lib/member-discount.js');
    expect(await memberDiscountFor(person.b, th.moved.id)).toMatchObject({ pct: 50 });
  });
});
