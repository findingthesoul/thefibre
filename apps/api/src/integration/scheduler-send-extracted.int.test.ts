// An ORDINARY scheduled message still goes out, with its tokens rendered.
//
// This is the regression test for the extraction, not for the hold. Part two
// pulled the scheduler's inline send out into `sendEngagementEmail` so that
// releasing a held queue could reuse it. That refactor touches the live path
// every scheduled message in the product travels down, and the failure it
// could cause is specific and has HAPPENED BEFORE: the scheduler once had its
// own copy of the token map, that copy was missing `{start_date}`, and a
// message timed relative to the start date mailed participants the literal
// token instead of the date. Nobody noticed from the code.
//
// So this asserts the thing that broke last time — the rendered BODY — rather
// than merely that a send was recorded.
//
// WHY THIS FILE MOCKS, when the suite's rule is that it must not: it replaces
// the outbound email TRANSPORT and nothing else. The database, RLS, the
// scheduler and the renderer are all real. Without it the body is
// unobservable — lib/email/client.ts no-ops when RESEND_API_KEY is unset and
// logs only to/subject/from — and asserting a send row would prove the send
// happened while saying nothing about what was in it, which is exactly the
// gap that let the {start_date} bug ship.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

const { outbox } = vi.hoisted(() => ({
  outbox: [] as { to: string; subject: string; text?: string; html?: string }[],
}));

vi.mock('../lib/email/client.js', () => ({
  sendEmail: async (msg: { to: string; subject: string; text?: string; html?: string }) => {
    outbox.push(msg);
  },
  platformFromAddress: () => 'The Thread <noreply@example.com>',
}));

let workspaceId = '';
let userId = '';
let organiserId = '';
let programId = '';
let threadId = '';
let personId = '';
let enrolmentId = '';
let engagementId = '';
const tag = randomUUID().slice(0, 8);
const recipient = `int-sched-${tag}@example.com`;

/** The day the thread starts — what {start_date} must become. */
const STARTS_ON = '2026-11-20';
/** How the product formats it: en-GB, day month year. */
const EXPECTED_DATE = '20 November 2026';

let runThreadMessageScheduler: () => Promise<{ due: number; sent: number }>;

beforeAll(async () => {
  ({ runThreadMessageScheduler } = await import('../routes/thread.js'));

  workspaceId = await createThrowawayWorkspace('schedsend');

  const { data: u, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email: `int-schedsend-${tag}@example.com` })
    .select('id')
    .single();
  if (uErr) throw new Error(`user: ${uErr.message}`);
  userId = u!.id as string;

  const { data: o, error: oErr } = await service
    .from('thread_organiser')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      slug: `int-schedsend-${tag}`,
      display_name: 'Scheduler Organiser',
    })
    .select('id')
    .single();
  if (oErr) throw new Error(`organiser: ${oErr.message}`);
  organiserId = o!.id as string;

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { data: prog, error: pErr } = await service
    .from('program')
    .insert({
      workspace_id: workspaceId,
      app_id: appRow!.id,
      title: 'Scheduled send thread',
      format: 'event',
      status: 'active',
      starts_on: STARTS_ON,
    })
    .select('id')
    .single();
  if (pErr) throw new Error(`program: ${pErr.message}`);
  programId = prog!.id as string;

  const { data: th, error: tErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: workspaceId,
      program_id: programId,
      organiser_id: organiserId,
      slug: `int-schedsend-thread-${tag}`,
      intention: 'A thread with a scheduled message.',
      timezone: 'Europe/Amsterdam',
    })
    .select('id')
    .single();
  if (tErr) throw new Error(`thread: ${tErr.message}`);
  threadId = th!.id as string;

  const { data: pers, error: persErr } = await service
    .from('person')
    .insert({
      workspace_id: workspaceId,
      first_name: 'Scheduled',
      last_name: 'Recipient',
      email: recipient,
    })
    .select('id')
    .single();
  if (persErr) throw new Error(`person: ${persErr.message}`);
  personId = pers!.id as string;

  // Enrolled, not invited and not dropped — the scheduler sends content only
  // to people who are actually in.
  const { data: enr, error: enrErr } = await service
    .from('enrolment')
    .insert({
      program_id: programId,
      person_id: personId,
      status: 'enrolled',
      enrolled_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (enrErr) throw new Error(`enrolment: ${enrErr.message}`);
  enrolmentId = enr!.id as string;

  const { error: teErr } = await service.from('thread_enrolment').insert({
    workspace_id: workspaceId,
    thread_id: threadId,
    person_id: personId,
    enrolment_id: enrolmentId,
    // NOT NULL, and the product fills it with `manual:<uuid>` on an
    // admin-added enrolment — the idempotency key the public enrol flow uses.
    request_id: `manual:${randomUUID()}`,
    payment_status: 'not_required',
  });
  if (teErr) throw new Error(`thread_enrolment: ${teErr.message}`);

  // Due an hour ago: past, and comfortably inside the 72-hour lookback.
  const { data: eng, error: engErr } = await service
    .from('thread_engagement')
    .insert({
      workspace_id: workspaceId,
      thread_id: threadId,
      type: 'message',
      title: 'We begin on {start_date}',
      description: 'Hello {first_name} — {thread_title} starts on {start_date}.',
      status: 'published',
      trigger_kind: 'fixed',
      scheduled_at: new Date(Date.now() - 3_600_000).toISOString(),
      position: 1,
    })
    .select('id')
    .single();
  if (engErr) throw new Error(`engagement: ${engErr.message}`);
  engagementId = eng!.id as string;
}, 90_000);

afterAll(async () => {
  if (engagementId) {
    await service.from('thread_message_send').delete().eq('engagement_id', engagementId);
    await service.from('thread_message_hold').delete().eq('engagement_id', engagementId);
    await service.from('thread_engagement').delete().eq('id', engagementId);
  }
  await service.from('thread_enrolment').delete().eq('workspace_id', workspaceId);
  if (enrolmentId) await service.from('enrolment').delete().eq('id', enrolmentId);
  await service.from('thread_thread').delete().eq('workspace_id', workspaceId);
  await service.from('program').delete().eq('workspace_id', workspaceId);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('person').delete().eq('workspace_id', workspaceId);
  await service.from('user').delete().eq('workspace_id', workspaceId);
  await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

describe('the extracted send still serves the ordinary scheduler', () => {
  it('mails a due scheduled message, with {start_date} rendered as a date', async () => {
    // runThreadMessageScheduler walks EVERY workspace, not just this fixture,
    // and in this file the transport is mocked. So if somebody else's message
    // happened to be due right now, this test would record it as sent and it
    // would never reach anybody — a silent theft of another workspace's mail.
    //
    // It cannot be prevented from here (the scheduler takes no workspace
    // filter), so it is made LOUD: count the send rows before and after, and
    // fail if anything other than this fixture's message went out. When this
    // fails, nothing is wrong with the code — run it when staging is idle, or
    // give the scheduler a workspace filter.
    const { count: before } = await service
      .from('thread_message_send')
      .select('*', { count: 'exact', head: true });

    await runThreadMessageScheduler();

    const { count: after } = await service
      .from('thread_message_send')
      .select('*', { count: 'exact', head: true });
    const { data: mineSends } = await service
      .from('thread_message_send')
      .select('id')
      .eq('engagement_id', engagementId);
    expect(
      (after ?? 0) - (before ?? 0),
      'the scheduler sent something that is not this fixture — see the note above',
    ).toBe(mineSends?.length ?? 0);

    const mine = outbox.filter((m) => m.to === recipient);
    expect(mine.length, 'the scheduled message should have gone out').toBe(1);
    const msg = mine[0]!;

    // THE regression. The literal token reaching a participant is what
    // happened the last time this path had two implementations.
    const whole = `${msg.subject} ${msg.text ?? ''} ${msg.html ?? ''}`;
    expect(whole, 'a raw token must never reach a participant').not.toContain('{start_date}');
    expect(whole, 'the start date must be rendered').toContain(EXPECTED_DATE);

    // The subject comes from the title, which goes through the same
    // substitution — so this pins both halves, not just the body.
    expect(msg.subject).toContain(EXPECTED_DATE);
  });

  it('records the send, so a second tick does not repeat it', async () => {
    const before = outbox.filter((m) => m.to === recipient).length;
    await runThreadMessageScheduler();
    const after = outbox.filter((m) => m.to === recipient).length;
    expect(after, 'the dedup must survive a second tick').toBe(before);

    const { data: sends } = await service
      .from('thread_message_send')
      .select('id')
      .eq('engagement_id', engagementId);
    expect(sends?.length).toBe(1);
  });

  // The hold is off for this workspace (email_hold is off on every plan), so
  // an ordinary send must NOT be parked. Asserted rather than assumed: if the
  // gate were inverted, every scheduled message in the product would silently
  // stop arriving.
  it('does not park anything while the cap does not apply', async () => {
    const { data: holds } = await service
      .from('thread_message_hold')
      .select('id')
      .eq('workspace_id', workspaceId);
    expect(holds?.length, 'nothing should have been held').toBe(0);
  });
});
