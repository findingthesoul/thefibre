// Closing sign-ups on a thread closes ONE door and leaves the others open.
//
// Sjoerd, 2026-09-23: "can you also 'close' enrolment in the thread? In the
// sense that people can enrol via membership (auto) but on the landing page
// is no enrolment form?"
//
// The refusal is the easy half to test and the easy half to get wrong in the
// safe-looking direction: a flag that refused EVERYTHING would pass a
// refusal test while breaking the feature entirely, because the whole point
// is that membership and manual adds keep working. So every test here has a
// twin, and the twins are the ones that matter.
//
// Real sessions, real middleware, staging. Throwaway workspace.

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
let ws: string;
let organiserUser: FixtureUser;
let threadId: string;
let programId: string;
let organiserId: string;
let organiserSlug: string;
let threadSlug: string;
let threadAppId: string;
const madeEnrolments: string[] = [];

/** The public enrol call, exactly as an outside caller makes it — no session,
 *  which is how the Festival of Trust planner submits (as the visitor, not as
 *  the app). */
async function publicEnrol(email: string) {
  return app.request('/api/v1/thread/public/enrol', {
    method: 'POST',
    headers: { 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organiser_slug: organiserSlug,
      thread_slug: threadSlug,
      name: 'Public Person',
      email,
      policy_accepted: true,
      request_id: randomUUID(),
    }),
  });
}

async function publicThread() {
  return app.request(
    `/api/v1/thread/public/organiser/${organiserSlug}/thread/${threadSlug}`,
    { headers: { 'X-App-ID': 'the-thread' } },
  );
}

async function setOpen(open: boolean) {
  const { error } = await service
    .from('thread_thread')
    .update({ public_enrolment_open: open })
    .eq('id', threadId);
  if (error) throw new Error(`set open: ${error.message}`);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  threadAppId = appRow!.id as string;

  ws = await createThrowawayWorkspace('enrol-closed');
  organiserUser = await createFixtureUser(ws, 'enrol-closed');
  await service
    .from('workspace_member')
    .upsert({ workspace_id: ws, user_id: organiserUser.userId, workspace_role: 'admin' });
  await service
    .from('app_membership')
    .upsert({ user_id: organiserUser.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });

  organiserSlug = `int-closed-${randomUUID().slice(0, 8)}`;
  const { data: org, error: oErr } = await service
    .from('thread_organiser')
    .insert({ user_id: organiserUser.userId, workspace_id: ws, slug: organiserSlug })
    .select('id')
    .single();
  if (oErr) throw new Error(`organiser: ${oErr.message}`);
  organiserId = org!.id as string;

  // ACTIVE on purpose — the whole point is a thread that is live and still
  // not taking sign-ups. A draft would close enrolment for the old reason
  // and prove nothing about the new one.
  const { data: prog, error: pErr } = await service
    .from('program')
    .insert({
      workspace_id: ws,
      app_id: threadAppId,
      title: 'Open and closed',
      format: 'event',
      status: 'active',
      starts_on: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (pErr) throw new Error(`program: ${pErr.message}`);
  programId = prog!.id as string;

  threadSlug = `int-closed-${randomUUID().slice(0, 8)}`;
  const { data: th, error: tErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: ws,
      program_id: programId,
      organiser_id: organiserId,
      slug: threadSlug,
      is_public_listed: true,
      // 'personal' — an organiser-owned thread with no team. The column is
      // personal | team | workspace; there is no 'public' value, and the
      // public-ness of a thread is is_public_listed plus its program status.
      public_scope: 'personal',
    })
    .select('id')
    .single();
  if (tErr) throw new Error(`thread: ${tErr.message}`);
  threadId = th!.id as string;
});

afterAll(async () => {
  if (madeEnrolments.length) {
    await service.from('thread_enrolment').delete().in('id', madeEnrolments);
  }
  await service.from('thread_enrolment').delete().eq('thread_id', threadId);
  await service.from('enrolment').delete().eq('program_id', programId);
  await service.from('thread_thread').delete().eq('id', threadId);
  await service.from('program').delete().eq('id', programId);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('app_membership').delete().eq('user_id', organiserUser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiserUser.userId);
  await deleteFixtureUser(organiserUser);
  await service.from('organisation').delete().eq('workspace_id', ws);
  await deleteThrowawayWorkspace(ws);
});

describe('with sign-ups OPEN — the twin that proves the flag is not a lockout', () => {
  it('the public payload says enrolment is open', async () => {
    await setOpen(true);
    const res = await publicThread();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread.enrolment_open).toBe(true);
  });

  it('a stranger can enrol from the page', async () => {
    await setOpen(true);
    const res = await publicEnrol(`int-open-${randomUUID().slice(0, 8)}@example.com`);
    // 201 — it creates. Pinned as the real value rather than loosened to
    // "not 409", so a future change of status code is noticed here.
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    if (body.enrolment_id) madeEnrolments.push(body.enrolment_id);
  });
});

describe('with sign-ups CLOSED', () => {
  it('the thread is still PUBLIC — closed is not hidden', async () => {
    await setOpen(false);
    const res = await publicThread();
    // The page still renders: this closes the form, not the building. A 404
    // here would mean the flag had become a second way to unpublish.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread.slug).toBe(threadSlug);
    expect(body.thread.program.status).toBe('active');
  });

  it('but the payload says enrolment is closed, so every surface hides the form', async () => {
    await setOpen(false);
    const body = await (await publicThread()).json();
    expect(body.thread.enrolment_open).toBe(false);
  });

  it('and the ENDPOINT STILL ACCEPTS — this hides a form, it does not bar enrolment', async () => {
    // Sjoerd, asked whether closing sign-ups should also stop the Festival of
    // Trust planner (which posts here as the visitor, not as an app):
    // "no - only on the landing page...".
    //
    // So this test asserts the ABSENCE of a gate, which is the kind of thing
    // that quietly grows one later. If somebody adds a check on
    // public_enrolment_open to /public/enrol, this fails and they have to
    // decide deliberately rather than by accident.
    await setOpen(false);
    const res = await publicEnrol(`int-closed-${randomUUID().slice(0, 8)}@example.com`);
    expect(res.status, 'closing sign-ups must not close the endpoint').toBe(201);
    const body = await res.json();
    if (body.enrolment_id) madeEnrolments.push(body.enrolment_id);
  });

  it('a membership grant still enrols — the actual point of the feature', async () => {
    await setOpen(false);
    // This is the path lib/thread-access.ts takes: it writes the platform
    // enrolment and the app's row directly, never touching /public/enrol.
    // Asserting it here rather than trusting that separation, because the
    // whole promise is that closing one door leaves this one open.
    const { data: person, error: pErr } = await service
      .from('person')
      .insert({ workspace_id: ws, first_name: 'Member', last_name: 'Granted' })
      .select('id')
      .single();
    if (pErr) throw new Error(`person: ${pErr.message}`);

    const { data: enrolment, error: eErr } = await service
      .from('enrolment')
      // No workspace_id on `enrolment` — it reaches the workspace through
      // its program. Asking for one is a PGRST204 at runtime, which is the
      // class of error a select string hides from TypeScript.
      .insert({ program_id: programId, person_id: person!.id, status: 'enrolled' })
      .select('id')
      .single();
    expect(eErr, 'a membership grant must still be able to enrol somebody').toBeNull();

    const { data: te, error: teErr } = await service
      .from('thread_enrolment')
      .insert({
        workspace_id: ws,
        thread_id: threadId,
        enrolment_id: enrolment!.id,
        person_id: person!.id,
        // 'not_required' — the values are not_required | pending | paid |
        // refunded | failed. There is no 'comped' here; a granted place is a
        // place that needs no payment.
        payment_status: 'not_required',
        // NOT NULL, and it is the idempotency key the public form uses. The
        // access worker supplies its own; any unique value stands in here.
        request_id: randomUUID(),
      })
      .select('id')
      .single();
    expect(teErr, 'the app row must land too').toBeNull();
    if (te) madeEnrolments.push(te.id as string);

    await service.from('person').delete().eq('id', person!.id);
  });

  it('and reopening shows the form again — the switch goes both ways', async () => {
    await setOpen(false);
    const closedBody = await (await publicThread()).json();
    expect(closedBody.thread.enrolment_open).toBe(false);

    await setOpen(true);
    const res = await publicEnrol(`int-reopen-${randomUUID().slice(0, 8)}@example.com`);
    expect(res.status).toBe(201);
    const body = await res.json();
    if (body.enrolment_id) madeEnrolments.push(body.enrolment_id);
  });
});
