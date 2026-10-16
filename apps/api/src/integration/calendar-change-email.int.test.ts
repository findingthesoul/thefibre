// The organiser's SEND, as the participant reads it — against staging, real
// tables, email captured and never sent.
//
// Sjoerd, 2026-10-16 ("yes build it"): participants hear about every change.
// The promises here are the email's:
//   · in the reader's OWN language (their profile), else the thread's, else
//     English — one participant set to Dutch, one with no preference;
//   · a move where only the place changed says so ("New place"), with the
//     online link written out;
//   · a session that is already over is not mailed at all, and the change is
//     resolved so the tray does not keep it.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
  }),
}));

let invite: typeof import('../lib/calendar-invite.js');
let ws = '';
let threadId = '';
const made: { table: string; id: string }[] = [];
const dutch = `cce-nl-${randomUUID().slice(0, 6)}@example.com`;
const plain = `cce-en-${randomUUID().slice(0, 6)}@example.com`;
const ids = { future: '', past: '', placeChange: '', pastChange: '' };

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

beforeAll(async () => {
  invite = await import('../lib/calendar-invite.js');
  const threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('calchange');
  const user = await insert('user', { workspace_id: ws, email: `cce-org-${randomUUID().slice(0, 6)}@example.com` });
  const organiserId = await insert('thread_organiser', {
    user_id: user,
    workspace_id: ws,
    slug: `cce-org-${randomUUID().slice(0, 6)}`,
    display_name: 'Olga Organiser',
  });
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Year agenda', format: 'event', status: 'active' });
  threadId = await insert('thread_thread', {
    workspace_id: ws,
    program_id: program,
    organiser_id: organiserId,
    slug: `cce-${randomUUID().slice(0, 8)}`,
    timezone: 'Europe/Amsterdam',
    language: 'en',
  });
  const { error: profErr } = await service.from('identity_profile').insert({ email: dutch, locale: 'nl' });
  if (profErr) throw new Error(`identity_profile: ${profErr.message}`);
  for (const email of [dutch, plain]) {
    const person = await insert('person', { workspace_id: ws, first_name: 'P', email });
    const enr = await insert('enrolment', { program_id: program, person_id: person, status: 'enrolled' });
    await insert('thread_enrolment', { workspace_id: ws, thread_id: threadId, enrolment_id: enr, person_id: person, request_id: `cce-${randomUUID()}` });
  }
  const base = { workspace_id: ws, thread_id: threadId, type: 'event', status: 'published', show_in_agenda: true, calendar_sent_at: day(-30) };
  ids.future = await insert('thread_engagement', { ...base, title: 'Conversation 1', starts_at: day(10), ends_at: day(10.05), location: 'De Nieuwe Kerk', meeting_url: 'https://meet.example.com/c1' });
  ids.past = await insert('thread_engagement', { ...base, title: 'Conversation 0', starts_at: day(-10), ends_at: day(-9.95) });

  // Only the PLACE moved on the future one; the past one was cancelled.
  const st = (starts: string, ends: string, location: string | null, meeting_url: string | null = null) =>
    ({ starts_at: starts, ends_at: ends, location, location_url: null, meeting_url });
  const future = (await service.from('thread_engagement').select('starts_at, ends_at').eq('id', ids.future).single()).data!;
  ids.placeChange = await insert('thread_calendar_change', {
    workspace_id: ws,
    thread_id: threadId,
    engagement_id: ids.future,
    kind: 'moved',
    title: 'Conversation 1',
    was: st(future.starts_at, future.ends_at, 'The old hall'),
    now_state: st(future.starts_at, future.ends_at, 'De Nieuwe Kerk', 'https://meet.example.com/c1'),
  });
  const past = (await service.from('thread_engagement').select('starts_at, ends_at').eq('id', ids.past).single()).data!;
  ids.pastChange = await insert('thread_calendar_change', {
    workspace_id: ws,
    thread_id: threadId,
    engagement_id: ids.past,
    kind: 'cancelled',
    title: 'Conversation 0',
    was: st(past.starts_at, past.ends_at, null),
    now_state: null,
  });
}, 180_000);

afterAll(async () => {
  await service.from('identity_profile').delete().eq('email', dutch);
  await service.from('thread_calendar_change').delete().eq('thread_id', threadId);
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe("the SEND's email", () => {
  it('mails the future change to both, each in their own language; the past one to nobody', async () => {
    sent.length = 0;
    const r = await invite.sendPendingChanges({ threadId });
    expect(r.skipped).toEqual(['Conversation 0: already over']);
    expect(sent.map((m) => m.to).sort()).toEqual([dutch, plain].sort());

    const nl = sent.find((m) => m.to === dutch)!;
    expect(nl.subject).toBe('Nieuwe plek: Conversation 1');
    expect(nl.text).toContain('De tijd blijft hetzelfde.');
    expect(nl.text).toContain('(Amsterdam-tijd)');

    const en = sent.find((m) => m.to === plain)!;
    expect(en.subject).toBe('New place: Conversation 1');
    expect(en.text).toContain('Was: The old hall');
    expect(en.text).toContain('Now: De Nieuwe Kerk');
    expect(en.text).toContain('Online: https://meet.example.com/c1');
    expect(en.text).toContain('(Amsterdam time)');
  });

  it('both changes are resolved — the past one too, though nobody was mailed', async () => {
    const { data } = await service.from('thread_calendar_change').select('id, sent_at').eq('thread_id', threadId);
    expect(data).toHaveLength(2);
    for (const row of data ?? []) expect(row.sent_at).not.toBeNull();
  });
});
