// The Membership tab on a contact is for ADMINS only (contacts follow the
// hierarchy, slice 2, step 5; Sjoerd, 2026-10-17). A membership is the
// community's, not a thing an organiser holds a role on.
//
// Real sessions, the routes in process behind the real appContext (the
// harness of persons-reads.int.test.ts). Throwaway workspace. The organiser
// can see the contact (they organise a thread the contact is on) and uses the
// membership app, so the test exercises the route's own admin check.
//
// Pinned: an admin gets 'membership' in /persons/:id/apps and the member row
// from /persons/:id/membership; the organiser gets the person and neither.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

const tag = randomUUID().slice(0, 8);
let app: Hono;
let ws = '';
let admin: FixtureUser;
let organiser: FixtureUser;
const ids: Record<string, string> = {};

const call = (u: FixtureUser, path: string) =>
  app.request(`/api/v1/persons${path}`, { headers: { Authorization: `Bearer ${u.accessToken}`, 'X-App-ID': 'fibre-platform' } });

async function ins(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data!.id as string;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { personsRoutes } = await import('../routes/persons.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/persons', personsRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('membership-tab');
  admin = await createFixtureUser(ws, 'mt-admin');
  organiser = await createFixtureUser(ws, 'mt-org');
  const appId = async (slug: string) => (await service.from('app').select('id').eq('slug', slug).single()).data!.id as string;
  const [threadApp, membershipApp] = await Promise.all([appId('the-thread'), appId('membership')]);
  for (const [u, role] of [[admin, 'admin'], [organiser, 'organiser']] as const) {
    await service.from('workspace_member').upsert({ workspace_id: ws, user_id: u.userId, workspace_role: role });
    await service.from('app_membership').upsert({ user_id: u.userId, app_id: membershipApp, role: 'member' }, { onConflict: 'user_id,app_id' });
  }
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: membershipApp }, { onConflict: 'workspace_id,app_id' });

  ids.person = await ins('person', { workspace_id: ws, first_name: 'Mia', last_name: 'Member' });
  ids.org = await ins('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `mt-${tag}` });
  ids.program = await ins('program', { workspace_id: ws, app_id: threadApp, title: `MT ${tag}`, format: 'event' });
  ids.thread = await ins('thread_thread', { workspace_id: ws, program_id: ids.program, organiser_id: ids.org, slug: `mt-${tag}`, language: 'en' });
  ids.enrolment = await ins('enrolment', { program_id: ids.program, person_id: ids.person, status: 'enrolled' });
  ids.tier = await ins('membership_tier', { workspace_id: ws, name: `MT ${tag}` });
  ids.member = await ins('membership_member', { workspace_id: ws, person_id: ids.person, tier_id: ids.tier, status: 'active', renews_at: '2099-01-01T00:00:00Z' });
}, 120_000);

afterAll(async () => {
  if (ids.member) await service.from('membership_member').delete().eq('id', ids.member);
  if (ids.tier) await service.from('membership_tier').delete().eq('id', ids.tier);
  if (ids.thread) await service.from('thread_thread').delete().eq('id', ids.thread);
  if (ids.org) await service.from('thread_organiser').delete().eq('id', ids.org);
  if (ids.enrolment) await service.from('enrolment').delete().eq('id', ids.enrolment);
  if (ids.program) await service.from('program').delete().eq('id', ids.program);
  if (ids.person) await service.from('person').delete().eq('id', ids.person);
  for (const u of [admin, organiser]) {
    if (!u) continue;
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
}, 120_000);

describe('the Membership tab on a contact', () => {
  it('an admin is offered the tab and reads the member row', async () => {
    const apps = await call(admin, `/${ids.person}/apps`);
    expect(apps.status).toBe(200);
    expect(((await apps.json()) as { apps: string[] }).apps).toContain('membership');
    const m = await call(admin, `/${ids.person}/membership`);
    expect(m.status).toBe(200);
    expect(((await m.json()) as { member: { id: string } | null }).member?.id).toBe(ids.member);
  });

  it('the organiser sees the person but not the tab, and the tab’s read refuses them', async () => {
    const person = await call(organiser, `/${ids.person}`);
    expect(person.status, 'the organiser sees their participant (can_see_person)').toBe(200);
    const apps = await call(organiser, `/${ids.person}/apps`);
    expect(apps.status).toBe(200);
    expect(((await apps.json()) as { apps: string[] }).apps).not.toContain('membership');
    const m = await call(organiser, `/${ids.person}/membership`);
    expect(m.status).toBe(403);
    expect(await m.json()).toEqual({ error: 'admins only' });
  });
});
