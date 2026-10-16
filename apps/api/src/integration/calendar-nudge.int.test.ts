// The nudge — against staging, real tables, email captured and never sent.
//
// Sjoerd, 2026-10-16: "keep send manual with nudge". The promises
// (lib/calendar-nudge.ts), each one a way a reminder becomes noise:
//   · the window: 23h59 is too early, 24h is due, a week or more is left alone;
//   · two ticks at once send ONE mail (the claim row);
//   · the same batch is never reminded twice, however long it then sits;
//   · pressing SEND re-arms it: the next batch is reminded on its own clock;
//   · a session that is over is no reason to remind;
//   · an organiser with no address is skipped, once, and nobody else is mailed.
//
// Scoped to its own thread ids throughout (opts.threadIds), so it never
// reminds a real organiser on staging.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let nudge: typeof import('../lib/calendar-nudge.js');
let ws = '';
const made: { table: string; id: string }[] = [];
const sent: { to: string; subject: string }[] = [];
const send = async (m: { to: string; subject: string }) => {
  sent.push(m);
};
const english = async () => 'en' as const;
const HOUR = 3_600_000;

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

let threadAppId = '';
let organiserId = '';
let noAddressOrganiserId = '';
const organiserEmail = `nudge-org-${randomUUID().slice(0, 6)}@example.com`;

async function thread(title: string, organiser = organiserId) {
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title, format: 'event', status: 'active' });
  return insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: organiser, slug: `nudge-${randomUUID().slice(0, 8)}` });
}

/** A waiting change, made `ageHours` before `at`, for a session `inDays` from now. */
async function change(threadId: string, ageHours: number, at: Date, inDays = 10, sentAt: string | null = null) {
  const starts = new Date(Date.now() + inDays * 86_400_000).toISOString();
  return insert('thread_calendar_change', {
    workspace_id: ws,
    thread_id: threadId,
    kind: 'moved',
    title: `Session ${randomUUID().slice(0, 4)}`,
    was: { starts_at: starts, ends_at: null, location: null, location_url: null, meeting_url: null },
    now_state: { starts_at: starts, ends_at: null, location: 'Elsewhere', location_url: null, meeting_url: null },
    created_at: new Date(at.getTime() - ageHours * HOUR).toISOString(),
    sent_at: sentAt,
  });
}

beforeAll(async () => {
  nudge = await import('../lib/calendar-nudge.js');
  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('nudge');
  const user = await insert('user', { workspace_id: ws, email: organiserEmail });
  organiserId = await insert('thread_organiser', { user_id: user, workspace_id: ws, slug: `nudge-o-${randomUUID().slice(0, 6)}` });
  // An organiser with no address to write to. thread_organiser.user_id is
  // NOT NULL, so "no address" is a user row whose email is blank — what the
  // code reads as none.
  const blank = await insert('user', { workspace_id: ws, email: '' });
  noAddressOrganiserId = await insert('thread_organiser', { user_id: blank, workspace_id: ws, slug: `nudge-x-${randomUUID().slice(0, 6)}` });
}, 120_000);

afterAll(async () => {
  await service.from('thread_calendar_nudge').delete().eq('workspace_id', ws);
  await service.from('thread_calendar_change').delete().eq('workspace_id', ws);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('the window', () => {
  it('23h59 is too early, 24h is due, 7 days is left alone', async () => {
    const now = new Date();
    const early = await thread('Early');
    await change(early, 23 + 59 / 60, now);
    const due = await thread('Due');
    await change(due, 24, now);
    const stale = await thread('Stale');
    await change(stale, 7 * 24, now);
    const ids = (await nudge.nudgesDue(now, { threadIds: [early, due, stale] })).map((d) => d.thread_id);
    expect(ids).toEqual([due]);
  });

  it('a change whose session is over is no reason to remind', async () => {
    const now = new Date();
    const past = await thread('Past');
    await change(past, 30, now, -3);
    expect(await nudge.nudgesDue(now, { threadIds: [past] })).toEqual([]);
  });
});

describe('once per batch', () => {
  let t = '';
  const now = new Date();

  it('two ticks at once send one mail, to the organiser, naming the thread', async () => {
    t = await thread('Year agenda');
    await change(t, 30, now);
    await change(t, 26, now);
    sent.length = 0;
    const [a, b] = await Promise.all([
      nudge.runCalendarNudge(now, { threadIds: [t], send, locale: english }),
      nudge.runCalendarNudge(now, { threadIds: [t], send, locale: english }),
    ]);
    expect(a.sent + b.sent).toBe(1);
    expect(a.already + b.already).toBe(1);
    expect(sent).toEqual([expect.objectContaining({ to: organiserEmail, subject: 'Not sent yet: changes to Year agenda' })]);
    const { data } = await service.from('thread_calendar_nudge').select('change_count, sent_at, after_send_at').eq('thread_id', t);
    expect(data).toHaveLength(1);
    expect(data![0]!.change_count).toBe(2);
    expect(data![0]!.sent_at).not.toBeNull();
  });

  it('the same batch is not reminded again, a day later or after another edit', async () => {
    await change(t, 1, now);
    sent.length = 0;
    const r = await nudge.runCalendarNudge(new Date(now.getTime() + 24 * HOUR), { threadIds: [t], send, locale: english });
    expect(r.sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('SEND re-arms it: the next batch is reminded 24h after its own oldest change', async () => {
    // The organiser presses SEND: every waiting change is resolved.
    const sendAt = new Date(now.getTime() + 2 * HOUR).toISOString();
    await service.from('thread_calendar_change').update({ sent_at: sendAt }).eq('thread_id', t).is('sent_at', null);
    const later = new Date(now.getTime() + 3 * HOUR);
    await change(t, 0, later);
    sent.length = 0;
    expect((await nudge.runCalendarNudge(new Date(later.getTime() + 23 * HOUR), { threadIds: [t], send, locale: english })).sent).toBe(0);
    expect((await nudge.runCalendarNudge(new Date(later.getTime() + 24 * HOUR), { threadIds: [t], send, locale: english })).sent).toBe(1);
    const { data } = await service.from('thread_calendar_nudge').select('after_send_at').eq('thread_id', t).order('created_at');
    expect(data).toHaveLength(2);
    expect(new Date(data![1]!.after_send_at as string).toISOString()).toBe(sendAt);
  });
});

describe('no address', () => {
  it('is skipped once and logged; nobody else is mailed', async () => {
    const now = new Date();
    const t = await thread('Left behind', noAddressOrganiserId);
    await change(t, 30, now);
    sent.length = 0;
    const first = await nudge.runCalendarNudge(now, { threadIds: [t], send, locale: english });
    const second = await nudge.runCalendarNudge(now, { threadIds: [t], send, locale: english });
    expect(first.skipped).toBe(1);
    expect(second.already).toBe(1);
    expect(sent).toHaveLength(0);
    const { data } = await service.from('thread_calendar_nudge').select('skipped').eq('thread_id', t);
    expect(data).toEqual([{ skipped: 'no organiser address' }]);
  });
});
