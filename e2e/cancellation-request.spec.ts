// Cancellation requests, in the browser, on staging (Sjoerd's 2iv).
//
// The integration test proves the routes; this proves the two screens a
// person actually uses, against the deployed apps:
//   1. the MEMBER fixture, holding a place on the fixture thread, opens the
//      thread in my.thread, presses "Request cancellation", gives a reason
//      and sends it — and the sheet then says "Cancellation requested";
//   2. the FIXTURE organiser opens the thread's registrations
//      (`?registrations=1`, where the request email lands), sees the
//      "Cancellation requested" badge, opens it, reads the reason, approves;
//   3. the request reads approved and the place dropped.
//
// Fixtures only. The thread is free, so there is no refund to give: the
// card refund is the integration test's (real Stripe TEST charge). The place
// is made here and removed afterwards, with the request; the activity rows
// stay, as activity does.

import { expect, test } from '@playwright/test';
import {
  HOSTS,
  fixtureIdentity,
  fixtureThread,
  landSignedIn,
  memberLandUrl,
  stagingService,
  waitForHydration,
} from './helpers.js';
import { E2E_MEMBER, E2E_THREAD } from './identities.js';

const REASON = `e2e: moving abroad ${Date.now()}`;
let threadId = '';
let programId = '';
let enrolmentId = '';
let placeId = '';

test.beforeAll(async () => {
  const s = stagingService();
  const t = await fixtureThread();
  threadId = t.threadId;
  const me = await fixtureIdentity();
  programId = (await s.from('thread_thread').select('program_id').eq('id', threadId).single()).data!.program_id as string;
  const { data: person } = await s.from('person').select('id').eq('workspace_id', me.workspaceId).eq('email', E2E_MEMBER.email).single();
  // A place for the member, made here and removed in afterAll.
  enrolmentId = (await s.from('enrolment').insert({ program_id: programId, person_id: person!.id, status: 'enrolled' }).select('id').single()).data!.id as string;
  const te = await s
    .from('thread_enrolment')
    .insert({ workspace_id: me.workspaceId, thread_id: threadId, enrolment_id: enrolmentId, person_id: person!.id, request_id: `e2e-cancel-${Date.now()}` })
    .select('id')
    .single();
  if (te.error) throw new Error(te.error.message);
  placeId = te.data.id as string;
});

test.afterAll(async () => {
  const s = stagingService();
  if (placeId) {
    await s.from('thread_cancellation_request').delete().eq('enrolment_id', placeId);
    await s.from('thread_enrolment').delete().eq('id', placeId);
  }
  if (enrolmentId) await s.from('enrolment').delete().eq('id', enrolmentId);
  const left = await s.from('thread_enrolment').select('id').eq('thread_id', threadId);
  expect(left.data ?? []).toEqual([]);
});

test.use({ viewport: { width: 1280, height: 900 } });

test('the member asks in my.thread', async ({ page }) => {
  // The portal has no land of its own: sign in on Thread, then carry the
  // shared session cookie over to my.* (as portal-members-list does).
  await page.goto(await memberLandUrl(HOSTS.thread, 'the-thread', '/'));
  await page.waitForLoadState('networkidle');
  await page.goto(`${HOSTS.my}/`);
  await waitForHydration(page);

  // The Next page lists SESSIONS; the fixture thread's one session opens
  // the thread's sheet.
  await page.getByText(E2E_THREAD.sessionTitle).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Request cancellation' }).click();
  await sheet.getByLabel('Reason (optional)').fill(REASON);
  await sheet.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(/Cancellation requested on/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Withdraw request' })).toBeVisible();

  const { data } = await stagingService().from('thread_cancellation_request').select('status, reason').eq('enrolment_id', placeId);
  expect(data).toEqual([{ status: 'pending', reason: REASON }]);
});

test('the organiser sees the badge on the registrations and approves', async ({ page }) => {
  await landSignedIn(page, HOSTS.thread, 'the-thread', `/threads/${threadId}?registrations=1`, /\/threads\//);
  await waitForHydration(page);
  const badge = page.getByRole('button', { name: 'Cancellation requested' });
  await expect(badge).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Cancellation requests \(1\)/ })).toBeVisible();
  await badge.click();
  await expect(page.getByText(REASON)).toBeVisible();
  // A free place: nothing to refund, and the dialog says so.
  await expect(page.getByText(/No card payment to refund here/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(badge).toBeHidden({ timeout: 20_000 });

  const s = stagingService();
  const { data: req } = await s.from('thread_cancellation_request').select('status').eq('enrolment_id', placeId);
  expect(req).toEqual([{ status: 'approved' }]);
  const { data: enr } = await s.from('enrolment').select('status').eq('id', enrolmentId).single();
  expect(enr!.status).toBe('dropped');
});
