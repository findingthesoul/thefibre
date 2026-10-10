// A message whose transport failed must not stay recorded as sent.
//
// Found on 2026-10-10 watching a real send fail on the deployed staging API:
// Resend refused the address, the log said `0 email(s) sent`, and the
// `thread_message_send` row written a moment earlier stayed — marking as
// delivered a message nobody would ever receive. That had been true of every
// scheduled and triggered send since the table existed, and is live on
// production: a provider outage, a bounced domain or an expired key swallows
// people's mail in silence.
//
// These cases run the REAL scheduler against the REAL database, with only the
// outbound transport replaced — so they exercise the claim, the send and the
// bookkeeping exactly as production does. The transport is scripted to fail a
// chosen number of times, which is the one thing that cannot be arranged with
// a real provider.
//
// The two properties are the ones that matter in opposite directions: a
// transient failure must NOT lose the message, and a permanent one must NOT
// retry for ever.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

const { outbox, failuresFor } = vi.hoisted(() => ({
  outbox: [] as { to: string; subject: string }[],
  /** address -> how many more times the transport should refuse it. */
  failuresFor: new Map<string, number>(),
}));

vi.mock('../lib/email/client.js', () => ({
  sendEmail: async (msg: { to: string; subject: string }) => {
    const left = failuresFor.get(msg.to) ?? 0;
    if (left > 0) {
      failuresFor.set(msg.to, left - 1);
      throw new Error('transport refused (scripted for the test)');
    }
    outbox.push(msg);
  },
  platformFromAddress: () => 'The Thread <noreply@example.com>',
}));

let workspaceId = '';
let userId = '';
let organiserId = '';
const threadIds: string[] = [];
const programIds: string[] = [];
let threadAppId = '';
const tag = randomUUID().slice(0, 8);
const made: { engagementId: string; personId: string; email: string }[] = [];

let runThreadMessageScheduler: () => Promise<{ due: number; sent: number }>;
let MAX_SEND_ATTEMPTS: number;
let emailsSentBetween: (ws: string, from: Date, to?: Date) => Promise<number>;

/**
 * A person with their OWN THREAD and one due message on it.
 *
 * The thread matters and the first version of this file got it wrong: the
 * scheduler sends each due engagement to everyone enrolled in its thread, so
 * with all the cases sharing one thread every engagement mailed every
 * recipient — the "happy" case received four emails instead of one and the
 * "permanent" case burned six transport attempts instead of three. The
 * fixture has to give each case its own thread for the cases to be about what
 * they claim.
 */
async function makeRecipient(label: string) {
  const email = `int-retry-${label}-${tag}@example.com`;
  const { data: person, error: pErr } = await service
    .from('person')
    .insert({ workspace_id: workspaceId, first_name: label, last_name: 'Recipient', email })
    .select('id')
    .single();
  if (pErr) throw new Error(`person ${label}: ${pErr.message}`);

  // Its own PROGRAM too: thread_thread has a unique key on program_id, so one
  // program can carry exactly one thread. Found by the constraint, not by
  // reading the schema first.
  const { data: ownProgram, error: opErr } = await service
    .from('program')
    .insert({
      workspace_id: workspaceId,
      app_id: threadAppId,
      title: `Retry thread (${label})`,
      format: 'event',
      status: 'active',
      starts_on: '2026-12-01',
    })
    .select('id')
    .single();
  if (opErr) throw new Error(`program ${label}: ${opErr.message}`);
  const ownProgramId = ownProgram!.id as string;
  programIds.push(ownProgramId);

  const { data: ownThread, error: otErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: workspaceId,
      program_id: ownProgramId,
      organiser_id: organiserId,
      slug: `int-retry-${label}-${tag}`,
      intention: `Thread for the ${label} case.`,
      timezone: 'Europe/Amsterdam',
    })
    .select('id')
    .single();
  if (otErr) throw new Error(`thread ${label}: ${otErr.message}`);
  const ownThreadId = ownThread!.id as string;
  threadIds.push(ownThreadId);

  const { data: enr, error: eErr } = await service
    .from('enrolment')
    .insert({
      program_id: ownProgramId,
      person_id: person!.id,
      status: 'enrolled',
      enrolled_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (eErr) throw new Error(`enrolment ${label}: ${eErr.message}`);

  const { error: teErr } = await service.from('thread_enrolment').insert({
    workspace_id: workspaceId,
    thread_id: ownThreadId,
    person_id: person!.id,
    enrolment_id: enr!.id,
    request_id: `manual:${randomUUID()}`,
    payment_status: 'not_required',
  });
  if (teErr) throw new Error(`thread_enrolment ${label}: ${teErr.message}`);

  // On that thread, so the scheduler mails exactly this one recipient.
  const { data: eng, error: engErr } = await service
    .from('thread_engagement')
    .insert({
      workspace_id: workspaceId,
      thread_id: ownThreadId,
      type: 'message',
      title: `Retry case ${label} ${tag}`,
      description: 'Body.',
      status: 'published',
      trigger_kind: 'fixed',
      scheduled_at: new Date(Date.now() - 60_000).toISOString(),
      position: made.length + 1,
    })
    .select('id')
    .single();
  if (engErr) throw new Error(`engagement ${label}: ${engErr.message}`);

  const row = { engagementId: eng!.id as string, personId: person!.id as string, email };
  made.push(row);
  return row;
}

async function sendRow(engagementId: string, personId: string) {
  const { data } = await service
    .from('thread_message_send')
    .select('failed_at, attempts, sent_at')
    .eq('engagement_id', engagementId)
    .eq('person_id', personId)
    .maybeSingle();
  return data;
}

beforeAll(async () => {
  ({ runThreadMessageScheduler } = await import('../routes/thread.js'));
  ({ MAX_SEND_ATTEMPTS } = await import('../lib/send-record.js'));
  ({ emailsSentBetween } = await import('../lib/plan.js'));

  workspaceId = await createThrowawayWorkspace('sendretry');

  const { data: u, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email: `int-retry-user-${tag}@example.com` })
    .select('id')
    .single();
  if (uErr) throw new Error(`user: ${uErr.message}`);
  userId = u!.id as string;

  const { data: o, error: oErr } = await service
    .from('thread_organiser')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      slug: `int-retry-${tag}`,
      display_name: 'Retry Organiser',
    })
    .select('id')
    .single();
  if (oErr) throw new Error(`organiser: ${oErr.message}`);
  organiserId = o!.id as string;

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  threadAppId = appRow!.id as string;

}, 90_000);

afterAll(async () => {
  const engIds = made.map((m) => m.engagementId);
  if (engIds.length) {
    await service.from('thread_message_send').delete().in('engagement_id', engIds);
    await service.from('thread_message_hold').delete().in('engagement_id', engIds);
    await service.from('thread_engagement').delete().in('id', engIds);
  }
  await service.from('thread_enrolment').delete().eq('workspace_id', workspaceId);
  if (programIds.length) await service.from('enrolment').delete().in('program_id', programIds);
  await service.from('thread_thread').delete().eq('workspace_id', workspaceId);
  await service.from('program').delete().eq('workspace_id', workspaceId);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('person').delete().eq('workspace_id', workspaceId);
  await service.from('user').delete().eq('workspace_id', workspaceId);
  await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

describe('a send whose transport fails', () => {
  it('is retried on the next tick, and arrives exactly once', async () => {
    const r = await makeRecipient('transient');
    failuresFor.set(r.email, 1); // refuse once, then behave

    await runThreadMessageScheduler();

    // After the failure: nothing delivered, and the row says so rather than
    // claiming the message went.
    expect(outbox.filter((m) => m.to === r.email).length, 'nothing should have arrived yet').toBe(0);
    const afterFail = await sendRow(r.engagementId, r.personId);
    expect(afterFail?.failed_at, 'a failed send must be marked failed').toBeTruthy();
    expect(afterFail?.attempts).toBe(1);

    await runThreadMessageScheduler();

    // The whole point: the message was NOT lost.
    expect(outbox.filter((m) => m.to === r.email).length, 'it should arrive on the retry').toBe(1);
    const afterOk = await sendRow(r.engagementId, r.personId);
    expect(afterOk?.failed_at, 'success must clear the failure').toBeNull();
    expect(afterOk?.attempts).toBe(2);

    // And a third tick must not send it again — the dedup still holds.
    await runThreadMessageScheduler();
    expect(outbox.filter((m) => m.to === r.email).length, 'exactly once, not twice').toBe(1);
  });

  it('stops after the limit, and leaves a visible trace', async () => {
    const r = await makeRecipient('permanent');
    failuresFor.set(r.email, 99); // a permanently bad address

    // One more tick than the limit, to prove it STOPS rather than merely
    // being slow.
    for (let i = 0; i < MAX_SEND_ATTEMPTS + 2; i += 1) await runThreadMessageScheduler();

    expect(outbox.filter((m) => m.to === r.email).length, 'it never arrives').toBe(0);
    const row = await sendRow(r.engagementId, r.personId);
    expect(row?.attempts, 'it must stop at the limit, not retry for ever').toBe(MAX_SEND_ATTEMPTS);
    expect(row?.failed_at, 'and say plainly that it never went').toBeTruthy();

    // The transport was asked exactly MAX times and then left alone: the
    // remaining scripted failures are still on the counter.
    expect(failuresFor.get(r.email)).toBe(99 - MAX_SEND_ATTEMPTS);
  });

  // THE BILLING ONE. usage-meters.ts charges overage straight off this count,
  // so a failed send that still counted would invoice a paying customer for
  // mail that never left — and warn people at 80% of an allowance they have
  // not used, and hold a Free workspace's queue early. Easy to miss, because
  // nothing about the retry work touches billing by name.
  it('a failed send does not count toward what the workspace has used', async () => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const before = await emailsSentBetween(workspaceId, monthStart);

    const r = await makeRecipient('uncounted');
    failuresFor.set(r.email, 99); // never gets through
    await runThreadMessageScheduler();

    // The row exists — that is the whole mechanism — but nothing was sent.
    const row = await sendRow(r.engagementId, r.personId);
    expect(row?.failed_at, 'the fixture must actually have failed').toBeTruthy();

    const after = await emailsSentBetween(workspaceId, monthStart);
    expect(after, 'a refused message is not an email this workspace sent').toBe(before);
  });

  it('a message that simply sends is untouched by any of this', async () => {
    const r = await makeRecipient('happy');

    await runThreadMessageScheduler();

    expect(outbox.filter((m) => m.to === r.email).length).toBe(1);
    const row = await sendRow(r.engagementId, r.personId);
    expect(row?.failed_at).toBeNull();
    expect(row?.attempts, 'one attempt, as before any of this existed').toBe(1);
  });

  // The other half of the billing case: proving the filter excludes failures
  // is worth nothing if it quietly excludes everything. A real send must
  // still be counted and still be billable.
  it('a delivered message IS counted', async () => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const before = await emailsSentBetween(workspaceId, monthStart);
    const r = await makeRecipient('counted');
    await runThreadMessageScheduler();

    expect(outbox.filter((m) => m.to === r.email).length).toBe(1);
    const after = await emailsSentBetween(workspaceId, monthStart);
    expect(after, 'a delivered message must still count').toBe(before + 1);
  });
});
