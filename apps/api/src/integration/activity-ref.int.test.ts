// WHAT an activity row is about (contacts follow the hierarchy, slice 2;
// migration 20261017134857, writer lib/activity-log.ts). Staging's database.
//
// In PERMANENT fixture workspaces: activity is append-only, so the rows this
// writes can never be removed and would pin a throwaway workspace for good.
// Everything else it makes is removed afterwards.
//
// Pinned:
//   · recordActivity writes the row and its ref, in the row's workspace —
//     for a thread and for a Meet booking; without a ref, only the row;
//   · logEnrolmentActivity (every Thread writer) refs its thread;
//   · a ref to ANOTHER workspace's thread is refused by the database; the row
//     is still written and recordActivity does not throw (the timeline never
//     fails the action that caused it);
//   · the database itself refuses: a ref whose workspace is not its row's, a
//     thread or booking of another workspace, an unknown kind, any UPDATE;
//   · nobody but the service role reads the table (RLS on, no policies).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { anon, createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

const tag = randomUUID().slice(0, 8);
let wsA = '';
let wsB = '';
let appId = '';
let uA: FixtureUser;
let uB: FixtureUser;
let personA = '';
let threadA = '';
let threadB = '';
let bookingA = '';
const made: { table: string; id: string }[] = [];

async function ins(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  made.push({ table, id: data!.id as string });
  return data!.id as string;
}

async function rowsOf(type: string) {
  const { data } = await service.from('activity').select('id, workspace_id').eq('person_id', personA).eq('type', type);
  return (data ?? []) as { id: string; workspace_id: string }[];
}
async function refOf(activityId: string) {
  const { data } = await service.from('activity_ref').select('workspace_id, ref_kind, ref_id').eq('activity_id', activityId).maybeSingle();
  return data;
}
async function act(): Promise<string> {
  const { data, error } = await service.from('activity').insert({ workspace_id: wsA, person_id: personA, app_id: appId, type: `int_ref_${tag}`, subject: 'direct' }).select('id').single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

beforeAll(async () => {
  appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  wsA = await getPermanentFixtureWorkspace('int-activity-ref-fixtures');
  wsB = await getPermanentFixtureWorkspace('int-activity-ref-other');
  uA = await createFixtureUser(wsA, 'ar-a');
  uB = await createFixtureUser(wsB, 'ar-b');
  const thread = async (ws: string, u: string, t: string) => {
    const org = await ins('thread_organiser', { user_id: u, workspace_id: ws, slug: `ar-${t}-${tag}` });
    const prog = await ins('program', { workspace_id: ws, app_id: appId, title: `AR ${t} ${tag}`, format: 'event' });
    return ins('thread_thread', { workspace_id: ws, program_id: prog, organiser_id: org, slug: `ar-${t}-${tag}`, language: 'en' });
  };
  threadA = await thread(wsA, uA.userId, 'a');
  threadB = await thread(wsB, uB.userId, 'b');
  // Not in `made`: a person with activity rows cannot be deleted (append-only); soft-deleted after.
  personA = (await service.from('person').insert({ workspace_id: wsA, first_name: 'AR', last_name: tag }).select('id').single()).data!.id as string;
  const host = await ins('meet_host', { user_id: uA.userId, workspace_id: wsA, slug: `ar-host-${tag}`, timezone: 'UTC' });
  const type = await ins('meet_meeting_type', { workspace_id: wsA, host_id: host, slug: `ar-${tag}`, name: 'AR', duration_minutes: 30, conferencing_provider: 'none' });
  const start = new Date(Date.now() + 7 * 86_400_000);
  bookingA = await ins('meet_booking', {
    workspace_id: wsA,
    meeting_type_id: type,
    host_id: host,
    invitee_email: `ar-${tag}@example.com`,
    invitee_name: 'AR',
    invitee_person_id: personA,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    request_id: `ar-${tag}`,
  });
}, 120_000);

afterAll(async () => {
  for (const m of [...made].reverse()) await service.from(m.table).delete().eq('id', m.id);
  if (personA) await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personA);
  if (uA) await deleteFixtureUser(uA);
  if (uB) await deleteFixtureUser(uB);
}, 120_000);

describe('the writer', () => {
  it('a thread: the row and its ref, in the row’s workspace', async () => {
    const { recordActivity } = await import('../lib/activity-log.js');
    await recordActivity(wsA, { personId: personA, appSlug: 'the-thread', type: `int_thread_${tag}`, subject: 'x' }, { kind: 'thread', id: threadA });
    const rows = await rowsOf(`int_thread_${tag}`);
    expect(rows).toEqual([{ id: expect.any(String), workspace_id: wsA }]);
    expect(await refOf(rows[0]!.id)).toEqual({ workspace_id: wsA, ref_kind: 'thread', ref_id: threadA });
  });

  it('a Meet booking: its ref; and with no ref, only the row', async () => {
    const { recordActivity } = await import('../lib/activity-log.js');
    await recordActivity(wsA, { personId: personA, appSlug: 'fibre-meet', type: `int_booking_${tag}`, subject: 'x' }, { kind: 'meet_booking', id: bookingA });
    const [b] = await rowsOf(`int_booking_${tag}`);
    expect(await refOf(b!.id)).toEqual({ workspace_id: wsA, ref_kind: 'meet_booking', ref_id: bookingA });
    await recordActivity(wsA, { personId: personA, appSlug: 'the-thread', type: `int_noref_${tag}`, subject: 'x' });
    const [n] = await rowsOf(`int_noref_${tag}`);
    expect(await refOf(n!.id)).toBeNull();
  });

  it('logEnrolmentActivity — every Thread writer — refs its thread', async () => {
    const { logEnrolmentActivity } = await import('../routes/thread.js');
    await logEnrolmentActivity(wsA, personA, `int_enrol_${tag}`, 'Registered: AR', threadA);
    const [r] = await rowsOf(`int_enrol_${tag}`);
    expect(await refOf(r!.id)).toEqual({ workspace_id: wsA, ref_kind: 'thread', ref_id: threadA });
  });

  it('another workspace’s thread: the ref is refused, the row is kept, nothing throws', async () => {
    const { recordActivity } = await import('../lib/activity-log.js');
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void errors.push(a));
    try {
      await expect(
        recordActivity(wsA, { personId: personA, appSlug: 'the-thread', type: `int_foreign_${tag}`, subject: 'x' }, { kind: 'thread', id: threadB }),
      ).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
    const [r] = await rowsOf(`int_foreign_${tag}`);
    expect(r).toBeDefined();
    expect(await refOf(r!.id)).toBeNull();
    expect(errors.some((e) => e[0] === '[activity] ref not recorded')).toBe(true);
  });
});

describe('the database refuses', () => {
  it('a wrong workspace, a foreign thread or booking, an unknown kind', async () => {
    const a = await act();
    const refuse = async (row: Record<string, unknown>) => (await service.from('activity_ref').insert({ activity_id: a, ...row })).error?.code;
    expect(await refuse({ workspace_id: wsB, ref_kind: 'thread', ref_id: threadB })).toBe('23514');
    expect(await refuse({ workspace_id: wsA, ref_kind: 'thread', ref_id: threadB })).toBe('23514');
    expect(await refuse({ workspace_id: wsA, ref_kind: 'meet_booking', ref_id: randomUUID() })).toBe('23514');
    expect(await refuse({ workspace_id: wsA, ref_kind: 'team', ref_id: threadA })).toBe('23514');
    expect(await refOf(a)).toBeNull();
  });

  it('a ref is final: no UPDATE', async () => {
    const a = await act();
    await service.from('activity_ref').insert({ activity_id: a, workspace_id: wsA, ref_kind: 'thread', ref_id: threadA });
    const { error } = await service.from('activity_ref').update({ ref_id: threadB }).eq('activity_id', a);
    expect(error?.code).toBe('23514');
    expect((await refOf(a))?.ref_id).toBe(threadA);
  });

  it('nobody but the service role reads it', async () => {
    const a = await act();
    await service.from('activity_ref').insert({ activity_id: a, workspace_id: wsA, ref_kind: 'thread', ref_id: threadA });
    expect((await anon.from('activity_ref').select('activity_id').eq('activity_id', a)).data ?? []).toEqual([]);
    expect((await uA.client.from('activity_ref').select('activity_id').eq('activity_id', a)).data ?? []).toEqual([]);
  });
});
