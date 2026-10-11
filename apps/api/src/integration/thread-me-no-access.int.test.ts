// GET /api/v1/thread/me when this person's organiser identity is somebody
// else's workspace.
//
// `thread_organiser.user_id` is UNIQUE GLOBALLY — one organiser row per
// person, ever. So a person who already has one in workspace A, opening The
// Thread in workspace B, hits a handler that:
//
//   1. looks for their row through RLS, which hides A's from B, and finds
//      nothing;
//   2. decides this is a first visit and provisions;
//   3. collides on `user_id`, which comes back as 23505 — the same code a
//      slug collision gives;
//   4. retries FIVE TIMES with a different random slug, which cannot help,
//      because the slug was never the thing colliding;
//   5. gives up and returns 500.
//
// A 500 says "we broke". This is not that: it is a person asking for
// something they are not entitled to in this workspace, which is a 403 and
// has been one all along. The five attempts are the tell — a slug retry is
// the right answer to a slug collision and the wrong answer to this one, and
// burning five of them hid which had happened.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let wsA = '';
let wsB = '';
let user: FixtureUser;
let organiserId = '';
const tag = randomUUID().slice(0, 8);

const me = async () =>
  app.request('/api/v1/thread/me', {
    headers: { Authorization: `Bearer ${user.accessToken}`, 'X-App-ID': 'the-thread' },
  });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('me-other');
  wsB = await createThrowawayWorkspace('me-here');

  // The person belongs to B — that is the workspace their token resolves to.
  user = await createFixtureUser(wsB, 'thread-me');
  const { error: wmErr } = await service
    .from('workspace_member')
    .insert({ workspace_id: wsB, user_id: user.userId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  await service
    .from('workspace_app')
    .upsert({ workspace_id: wsB, app_id: appRow!.id }, { onConflict: 'workspace_id,app_id' });
  await service
    .from('app_membership')
    .upsert(
      { user_id: user.userId, app_id: appRow!.id, role: 'admin', is_direct: true },
      { onConflict: 'user_id,app_id' },
    );

  // …but their ONE organiser row lives in A.
  const { data: o, error } = await service
    .from('thread_organiser')
    .insert({
      workspace_id: wsA,
      user_id: user.userId,
      slug: `int-me-other-${tag}`,
      display_name: 'Elsewhere',
    })
    .select('id')
    .single();
  if (error) throw new Error(`organiser in A: ${error.message}`);
  organiserId = o!.id as string;
}, 120_000);

afterAll(async () => {
  if (organiserId) await service.from('thread_organiser').delete().eq('id', organiserId);
  if (user) {
    await service.from('app_membership').delete().eq('user_id', user.userId);
    await service.from('workspace_member').delete().eq('user_id', user.userId);
    await deleteFixtureUser(user);
  }
  await service.from('workspace_app').delete().eq('workspace_id', wsB);
  await deleteThrowawayWorkspace(wsA);
  await deleteThrowawayWorkspace(wsB);
}, 120_000);

describe('/thread/me when the organiser identity is elsewhere', () => {
  it('answers 403, not 500', async () => {
    const r = await me();
    expect(r.status, await r.clone().text()).toBe(403);
  });

  // A status code alone leaves the person staring at a blank screen. This is
  // a situation only a human can resolve — somebody has to move the identity
  // or pick a workspace — so the message has to say what happened.
  it('says what is wrong in words a person can act on', async () => {
    const body = (await (await me()).json()) as { error?: string };
    expect(body.error, JSON.stringify(body)).toBeTruthy();
    expect(body.error!.length).toBeGreaterThan(20);
    expect(body.error!.toLowerCase()).toContain('workspace');
  });

  // The other workspace's slug, name and id are none of this workspace's
  // business. Saying "your page is at <slug>" would be a friendlier message
  // that leaks which workspace somebody belongs to.
  it('never names the other workspace or its slug', async () => {
    const text = await (await me()).text();
    expect(text).not.toContain(`int-me-other-${tag}`);
    expect(text).not.toContain(wsA);
  });

  // THE OTHER 403: the row is in THIS workspace, and RLS hides it because the
  // person is not a member of The Thread here. Written to find out whether
  // the handler's branch is even reachable — the app-context middleware may
  // refuse first, in which case the branch is dead code and should be said to
  // be, not left looking load-bearing.
  it('a row in THIS workspace with no app membership is also refused, not 500', async () => {
    // Move the identity here and take the membership away.
    await service.from('thread_organiser').update({ workspace_id: wsB }).eq('id', organiserId);
    const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
    await service.from('app_membership').delete().eq('user_id', user.userId).eq('app_id', appRow!.id);

    const r = await me();
    const body = (await r.clone().json()) as { code?: string };
    // 403 from THE HANDLER, not from the middleware — asserted by the code,
    // because the two layers return the same status and only one of them
    // can say what to do about it. Checked on 2026-10-11: the middleware
    // lets this through and the handler answers, so the branch is live.
    expect(r.status, JSON.stringify(body)).toBe(403);
    expect(body.code).toBe('no_thread_access');

    // Put it back for the other cases, whichever order they run in.
    await service.from('thread_organiser').update({ workspace_id: wsA }).eq('id', organiserId);
    await service
      .from('app_membership')
      .upsert(
        { user_id: user.userId, app_id: appRow!.id, role: 'admin', is_direct: true },
        { onConflict: 'user_id,app_id' },
      );
  });

  // The failure must not leave debris. Before this fix the handler inserted
  // nothing — it collided five times — but a fix that provisioned into B
  // would quietly give somebody two identities.
  it('creates no second organiser row', async () => {
    await me();
    const { count } = await service
      .from('thread_organiser')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.userId);
    expect(count, 'one person has exactly one organiser row, ever').toBe(1);
  });
});
