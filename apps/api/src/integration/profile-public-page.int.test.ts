// Switching your public page off — the SAVE, not the gate.
//
// v1.122.0 shipped this feature with the READ gate tested five ways
// (organiser-publish.int.test.ts: false 404s, NULL is grandfathered, the
// threads survive) and the WRITE path tested nowhere. `public_page_published`
// appeared in exactly three files and no test. That is the wrong half to
// leave uncovered: the gate is machinery nobody touches, and the save is the
// thing a person actually does. A switch that reads correctly and does not
// store is the whole feature failing, silently, with a checkbox that springs
// back on the next page load.
//
// It matters more now because The Thread's Settings → Public page calls this
// same endpoint rather than writing through /api/v1/thread/me — one writer
// for one column, deliberately — so two screens depend on it.
//
// Not in `pnpm verify`. Runs under `pnpm test:integration`.

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
let workspaceId: string;
let user: FixtureUser;
let organiserId = '';
let threadAppId = '';
/** A SECOND person's page in the same workspace — the control. */
let strangerUserId = '';
let strangerOrganiserId = '';
const slug = `int-pp-${randomUUID().slice(0, 8)}`;
const strangerSlug = `int-pp-other-${randomUUID().slice(0, 8)}`;

const call = (method: string, body?: unknown) =>
  app.request('/api/v1/profile', {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** What is actually stored — asked of the database, not of the response. */
async function stored(id: string): Promise<boolean | null | 'missing'> {
  const { data } = await service
    .from('thread_organiser')
    .select('is_published')
    .eq('id', id)
    .maybeSingle();
  return data ? (data.is_published as boolean | null) : 'missing';
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { profileRoutes } = await import('../routes/profile.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/profile', profileRoutes);
  // The Thread's settings screen reads /thread/me, not /profile. Both screens
  // render the same card, so both data sources are covered here.
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  workspaceId = await createThrowawayWorkspace('publicpage');
  user = await createFixtureUser(workspaceId, 'publicpage');

  // Thread access, because /thread/me reads under the caller's OWN token and
  // thread_organiser's RLS policy is `current_workspace_id() AND
  // has_app_membership('the-thread')`. Without it the row is invisible to its
  // own owner, /thread/me decides nobody has an organiser yet, tries to
  // provision one, and collides with the row it could not see — a 500. A real
  // person on that screen has the app; the fixture has to as well.
  const { data: appRow, error: appErr } = await service
    .from('app')
    .select('id')
    .eq('slug', 'the-thread')
    .single();
  if (appErr) throw new Error(`the-thread app row: ${appErr.message}`);
  threadAppId = appRow!.id as string;
  const { error: waErr } = await service
    .from('workspace_app')
    .upsert({ workspace_id: workspaceId, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
  const { error: amErr } = await service
    .from('app_membership')
    .upsert(
      { user_id: user.userId, app_id: threadAppId, role: 'member', is_direct: true },
      { onConflict: 'user_id,app_id' },
    );
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);

  // The page this person never asked for: NO is_published, which is the
  // grandfathered state every existing row is in.
  const { data: o, error } = await service
    .from('thread_organiser')
    .insert({ user_id: user.userId, workspace_id: workspaceId, slug, display_name: 'PP Organiser' })
    .select('id')
    .single();
  if (error) throw new Error(`organiser fixture: ${error.message}`);
  organiserId = o!.id as string;

  const { data: su, error: suErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email: `int-pp-other-${randomUUID().slice(0, 8)}@example.com` })
    .select('id')
    .single();
  if (suErr) throw new Error(`stranger user fixture: ${suErr.message}`);
  strangerUserId = su!.id as string;
  const { data: so, error: soErr } = await service
    .from('thread_organiser')
    .insert({
      user_id: strangerUserId,
      workspace_id: workspaceId,
      slug: strangerSlug,
      display_name: 'Somebody Else',
      is_published: true,
    })
    .select('id')
    .single();
  if (soErr) throw new Error(`stranger organiser fixture: ${soErr.message}`);
  strangerOrganiserId = so!.id as string;
}, 60_000);

afterAll(async () => {
  if (user) await service.from('app_membership').delete().eq('user_id', user.userId);
  await service.from('thread_organiser').delete().in('id', [organiserId, strangerOrganiserId].filter(Boolean));
  if (strangerUserId) await service.from('user').delete().eq('id', strangerUserId);
  if (user) await deleteFixtureUser(user);
  if (workspaceId) await deleteThrowawayWorkspace(workspaceId);
}, 60_000);

describe('saying no to your public page', () => {
  it('tells you the page exists, and that nobody asked you', async () => {
    const res = await call('GET');
    expect(res.status, await res.clone().text()).toBe(200);
    const body = (await res.json()) as { public_page?: { slug: string; is_published: boolean | null } };
    // The card cannot be rendered without this, and NULL is what makes it
    // show the notice rather than a bare switch.
    expect(body.public_page).toEqual({ slug, is_published: null });
  });

  it('stores the no — in the database, not just in the answer', async () => {
    const res = await call('PATCH', { public_page_published: false });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await stored(organiserId)).toBe(false);
  });

  it('stores the yes again, so the switch is not one-way', async () => {
    await call('PATCH', { public_page_published: false });
    const res = await call('PATCH', { public_page_published: true });
    expect(res.status).toBe(200);
    expect(await stored(organiserId)).toBe(true);
  });

  it('answering removes the notice: GET no longer reports NULL', async () => {
    await call('PATCH', { public_page_published: true });
    const body = (await (await call('GET')).json()) as {
      public_page?: { is_published: boolean | null };
    };
    expect(body.public_page?.is_published).toBe(true);
  });

  // A normal profile save must not silently answer a question nobody asked.
  // The route guards on `!== undefined`; this is what that guard is FOR, and
  // it is the kind of line a later refactor drops without noticing.
  it('a save that is not about the page leaves the page alone', async () => {
    await call('PATCH', { public_page_published: false });
    const res = await call('PATCH', { display_name: 'Renamed Person' });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await stored(organiserId)).toBe(false);
  });

  // The two screens must agree. The Thread's Settings → Public page renders
  // the same card from /thread/me, which selects '*' — so the column arrives
  // for free, and "for free" is precisely the kind of thing that stops being
  // true when somebody narrows that select to a column list and has no reason
  // to think about a flag another app's screen depends on.
  it('/thread/me carries the flag too, which is what The Thread renders from', async () => {
    await call('PATCH', { public_page_published: false });
    const res = await app.request('/api/v1/thread/me', {
      headers: { Authorization: `Bearer ${user.accessToken}`, 'X-App-ID': 'the-thread' },
    });
    expect(res.status, await res.clone().text()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect('is_published' in body, JSON.stringify(Object.keys(body))).toBe(true);
    expect(body.is_published).toBe(false);
    expect(body.slug).toBe(slug);
  });

  // The write is scoped by the CALLER's user_id. If that filter were ever
  // dropped, this endpoint would publish or unpublish every organiser in the
  // database — and the test that only looks at its own row would still pass.
  it("does not touch anybody else's page", async () => {
    expect(await stored(strangerOrganiserId)).toBe(true);
    await call('PATCH', { public_page_published: false });
    expect(await stored(organiserId)).toBe(false);
    expect(await stored(strangerOrganiserId), 'a stranger was unpublished').toBe(true);
  });
});
