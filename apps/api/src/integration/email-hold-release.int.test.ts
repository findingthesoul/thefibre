// Letting a held queue go — the half that makes holding safe at all.
//
// Part one (v1.126.0) could park a message. Parking without releasing is
// worse than not parking, so this is the piece that had to exist before the
// `email_hold` key could be switched on anywhere.
//
// Three properties, and the second and third are the ones that would be
// silent if they broke:
//
//  1. A released message is SENT, and the hold stops counting as waiting.
//  2. The row is SOFT-released — released_at stamped, email nulled, row still
//     there. Hard rule 4 forbids deleting personal data, and the row is the
//     only answer to "did everything we parked go out?".
//  3. A message the ordinary scheduler already sent is NOT sent twice. That
//     race is real: when the month turns, a held message still inside the
//     72-hour window can be mailed by the scheduler while its hold row is
//     still waiting. The insert-first dedup is what stops the double send,
//     and nothing else would notice it happening.
//
// Nothing is actually mailed: RESEND_API_KEY is absent from .env.staging, so
// lib/email/client.ts no-ops and logs. Checked before writing this, not
// assumed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
} from './staging.js';

let workspaceId = '';
let userId = '';
let organiserId = '';
let programId = '';
let threadId = '';
let personId = '';
/** One engagement per case, so a dedup in one cannot mask another. */
const engagementIds: string[] = [];

let releaseHeldMessages: (ws: string) => Promise<{ released: number; alreadySent: number }>;
let heldCount: (ws: string) => Promise<number>;

async function makeEngagement(title: string): Promise<string> {
  const { data, error } = await service
    .from('thread_engagement')
    .insert({
      workspace_id: workspaceId,
      thread_id: threadId,
      type: 'message',
      title,
      description: 'Held message body.',
      status: 'published',
      trigger_kind: 'fixed',
      position: engagementIds.length + 1,
    })
    .select('id')
    .single();
  if (error) throw new Error(`engagement fixture: ${error.message}`);
  engagementIds.push(data!.id as string);
  return data!.id as string;
}

async function hold(engagementId: string): Promise<string> {
  const { data, error } = await service
    .from('thread_message_hold')
    .insert({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      person_id: personId,
      email: 'int-hold@example.com',
      due_at: new Date(Date.now() - 86_400_000).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`hold fixture: ${error.message}`);
  return data!.id as string;
}

async function holdRow(id: string) {
  const { data } = await service
    .from('thread_message_hold')
    .select('id, released_at, email')
    .eq('id', id)
    .maybeSingle();
  return data;
}

beforeAll(async () => {
  ({ releaseHeldMessages } = await import('../routes/thread.js'));
  ({ heldCount } = await import('../lib/email-cap.js'));

  workspaceId = await createThrowawayWorkspace('holdrelease');
  const tag = randomUUID().slice(0, 8);

  const { data: u, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email: `int-holdrel-${tag}@example.com` })
    .select('id')
    .single();
  if (uErr) throw new Error(`user: ${uErr.message}`);
  userId = u!.id as string;

  const { data: o, error: oErr } = await service
    .from('thread_organiser')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      slug: `int-holdrel-${tag}`,
      display_name: 'Hold Release Organiser',
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
      title: 'Held thread',
      format: 'event',
      status: 'active',
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
      slug: `int-holdrel-thread-${tag}`,
      intention: 'A thread whose mail was parked.',
    })
    .select('id')
    .single();
  if (tErr) throw new Error(`thread: ${tErr.message}`);
  threadId = th!.id as string;

  const { data: pers, error: persErr } = await service
    .from('person')
    .insert({
      workspace_id: workspaceId,
      first_name: 'Held',
      last_name: 'Recipient',
      email: `int-holdrel-person-${tag}@example.com`,
    })
    .select('id')
    .single();
  if (persErr) throw new Error(`person: ${persErr.message}`);
  personId = pers!.id as string;
}, 90_000);

afterAll(async () => {
  await service.from('thread_message_hold').delete().eq('workspace_id', workspaceId);
  if (engagementIds.length) {
    await service.from('thread_message_send').delete().in('engagement_id', engagementIds);
    await service.from('thread_engagement').delete().in('id', engagementIds);
  }
  await service.from('thread_thread').delete().eq('workspace_id', workspaceId);
  await service.from('program').delete().eq('workspace_id', workspaceId);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await service.from('person').delete().eq('workspace_id', workspaceId);
  await service.from('user').delete().eq('workspace_id', workspaceId);
  await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

describe('releasing a held queue', () => {
  it('sends what was waiting, and records the send', async () => {
    const engagementId = await makeEngagement('Released message');
    const holdId = await hold(engagementId);
    expect(await heldCount(workspaceId), 'it should be waiting first').toBeGreaterThan(0);

    const r = await releaseHeldMessages(workspaceId);
    expect(r.released).toBe(1);
    expect(r.alreadySent).toBe(0);

    // The send is recorded, which is what stops it going again.
    const { data: sends } = await service
      .from('thread_message_send')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('person_id', personId);
    expect(sends?.length).toBe(1);

    // And it no longer counts as waiting.
    expect(await heldCount(workspaceId)).toBe(0);
    expect(holdId).toBeTruthy();
  });

  it('soft-releases: the row stays, the address does not', async () => {
    const engagementId = await makeEngagement('Soft released');
    const holdId = await hold(engagementId);

    await releaseHeldMessages(workspaceId);

    const row = await holdRow(holdId);
    // Hard rule 4: the row is still there.
    expect(row, 'the hold row must not be deleted').not.toBeNull();
    expect(row?.released_at, 'released_at must be stamped').toBeTruthy();
    // Minimisation: thread_message_send carries the address from here on.
    expect(row?.email, 'the address must be let go on release').toBeNull();
  });

  // THE RACE. When the month turns, a held message still inside the 72-hour
  // window can be sent by the ordinary scheduler while its hold row is still
  // waiting. Releasing afterwards must not send it a second time — and a
  // double send is exactly the kind of thing nobody reports politely.
  it('does not send again what the scheduler already sent', async () => {
    const engagementId = await makeEngagement('Already sent');
    const holdId = await hold(engagementId);

    // Stand in for the scheduler having got there first.
    const { error } = await service.from('thread_message_send').insert({
      engagement_id: engagementId,
      person_id: personId,
      email: 'int-holdrel-person@example.com',
    });
    if (error) throw new Error(`pre-existing send: ${error.message}`);

    const r = await releaseHeldMessages(workspaceId);
    expect(r.alreadySent, 'it should notice the send already happened').toBe(1);
    expect(r.released, 'and must not count it as a fresh send').toBe(0);

    // Still exactly one send row: no duplicate.
    const { data: sends } = await service
      .from('thread_message_send')
      .select('id')
      .eq('engagement_id', engagementId);
    expect(sends?.length, 'a second send row would mean the person got it twice').toBe(1);

    // And the hold is finished with, not left to be retried for ever.
    const row = await holdRow(holdId);
    expect(row?.released_at).toBeTruthy();
  });

  it('releasing an empty queue is a no-op, not an error', async () => {
    const r = await releaseHeldMessages(workspaceId);
    expect(r).toEqual({ released: 0, alreadySent: 0 });
  });
});
