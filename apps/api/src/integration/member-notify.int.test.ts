// Members told about their team calendars — against staging, real tables.
//
// The promises worth a test, each one a way this could embarrass somebody:
//   · the first deploy emails NOBODY about threads that were always there;
//   · "new" fires once per person and thread, ever — not again after a
//     thread is hidden and shown, not twice on two passes;
//   · somebody who already holds a place is never told it is "new";
//   · the community switch off means nothing is announced, then or later;
//   · one email per person after the quiet window, none before it, none
//     after they opted out;
//   · at the organiser's SEND, participants get in-app only (they had the
//     calendar update by email) and followers get in-app plus the digest;
//     past sessions tell nobody;
//   · the SEND dialog's reach line counts the same people.
//
// Scoped to a throwaway workspace and a baseline key of its own, so it never
// moves staging's real baseline. Email is captured, never sent.

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

let notify: typeof import('../lib/member-notify.js');
let ws = '';
let teamId = '';
let threadAppId = '';
let organiserId = '';
let tierId = '';
const BASELINE = `member_notify_baseline_test_${randomUUID().slice(0, 8)}`;
const people: Record<'a' | 'b' | 'c', { id: string; email: string }> = {} as never;
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

/** A thread on the team calendar: team published, programme active, open. */
async function calendarThread(title: string, status = 'active') {
  const program = await insert('program', {
    workspace_id: ws,
    app_id: threadAppId,
    title,
    format: 'event',
    status,
    starts_on: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
  });
  const id = await insert('thread_thread', {
    workspace_id: ws,
    program_id: program,
    organiser_id: organiserId,
    team_id: teamId,
    slug: `mn-${randomUUID().slice(0, 8)}`,
    public_scope: 'team',
    public_enrolment_open: true,
    price_cents: 0,
  });
  return { id, program };
}

async function rowsFor(threadId: string) {
  const { data } = await service
    .from('member_notification')
    .select('person_id, kind, email_state')
    .eq('thread_id', threadId);
  return data ?? [];
}

const pass = () => notify.runNewThreadPass(new Date(), { workspaceIds: [ws], baselineKey: BASELINE });

beforeAll(async () => {
  notify = await import('../lib/member-notify.js');
  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('membernotify');
  teamId = await insert('team', { workspace_id: ws, name: 'Notify team', slug: `mn-team-${randomUUID().slice(0, 6)}` });
  await service.from('team').update({ is_published: true, is_active: true }).eq('id', teamId);
  const user = await insert('user', { workspace_id: ws, email: `mn-org-${randomUUID().slice(0, 6)}@example.com` });
  organiserId = await insert('thread_organiser', { user_id: user, workspace_id: ws, slug: `mn-org-${randomUUID().slice(0, 6)}` });

  for (const k of ['a', 'b', 'c'] as const) {
    const email = `mn-${k}-${randomUUID().slice(0, 6)}@example.com`;
    people[k] = { id: await insert('person', { workspace_id: ws, first_name: k.toUpperCase(), email }), email };
  }
  tierId = await insert('membership_tier', { workspace_id: ws, name: 'Follows the calendar' });
  await insert('membership_access_grant', {
    workspace_id: ws,
    tier_id: tierId,
    kind: 'team_calendar',
    config: { team_id: teamId, discount_pct: 100 },
  });
  // A and B follow the calendar; C is no member at all.
  for (const k of ['a', 'b'] as const) {
    await insert('membership_member', {
      workspace_id: ws,
      person_id: people[k].id,
      tier_id: tierId,
      status: 'active',
      renews_at: '2099-01-01T00:00:00Z',
    });
  }
}, 180_000);

afterAll(async () => {
  await service.from('member_notification').delete().eq('workspace_id', ws);
  await service.from('member_notification_pref').delete().eq('workspace_id', ws);
  await service.from('thread_calendar_seen').delete().eq('workspace_id', ws);
  await service.from('membership_settings').delete().eq('workspace_id', ws);
  await service.from('platform_setting').delete().eq('key', BASELINE);
  const { data: tes } = await service.from('thread_enrolment').select('id').eq('workspace_id', ws);
  if (tes?.length) await service.from('thread_enrolment').delete().in('id', tes.map((t) => t.id));
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

let t1 = { id: '', program: '' };

describe('new on the calendar', () => {
  it('the FIRST pass records what is already there and tells nobody', async () => {
    const t0 = await calendarThread('Was always there');
    const r = await pass();
    expect(r).toMatchObject({ baseline: 1, told: 0 });
    expect(await rowsFor(t0.id)).toEqual([]);
  });

  it('a thread published after that is announced to its followers — not to one who holds a place, not to a non-member', async () => {
    t1 = await calendarThread('Brand new');
    // B already has a place on it.
    const enr = await insert('enrolment', { program_id: t1.program, person_id: people.b.id, status: 'enrolled' });
    await insert('thread_enrolment', {
      workspace_id: ws,
      thread_id: t1.id,
      enrolment_id: enr,
      person_id: people.b.id,
      request_id: `mn-${randomUUID()}`,
    });
    const r = await pass();
    expect(r.told).toBe(1);
    expect(await rowsFor(t1.id)).toEqual([{ person_id: people.a.id, kind: 'new_thread', email_state: 'pending' }]);
  });

  it('once, ever: a second pass and a hide-and-show announce nothing more', async () => {
    expect((await pass()).told).toBe(0);
    await service.from('program').update({ status: 'draft' }).eq('id', t1.program);
    await pass();
    await service.from('program').update({ status: 'active' }).eq('id', t1.program);
    expect((await pass()).told).toBe(0);
    expect(await rowsFor(t1.id)).toHaveLength(1);
  });

  it('with the community switch OFF nothing is announced — then or after switching back on', async () => {
    await service.from('membership_settings').upsert({ workspace_id: ws, notify_members: false }, { onConflict: 'workspace_id' });
    const t2 = await calendarThread('Published during a restructure');
    expect((await pass()).told).toBe(0);
    await service.from('membership_settings').update({ notify_members: true }).eq('workspace_id', ws);
    expect((await pass()).told).toBe(0);
    expect(await rowsFor(t2.id)).toEqual([]);
  });
});

describe('the digest', () => {
  it('nothing before the quiet window; ONE email after it, with the thread and the price', async () => {
    sent.length = 0;
    expect((await notify.runNotificationDigest(new Date(), { personIds: [people.a.id] })).sent).toBe(0);
    expect(sent).toHaveLength(0);

    const later = new Date(Date.now() + notify.QUIET_MS + 60_000);
    const r = await notify.runNotificationDigest(later, { personIds: [people.a.id] });
    expect(r.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(people.a.email);
    expect(sent[0]!.text).toContain('Brand new');
    expect(sent[0]!.text).toContain('included in your membership');
    expect(sent[0]!.text).toMatch(/unsubscribe\/[0-9a-f]{48}/);
    expect(await rowsFor(t1.id)).toEqual([{ person_id: people.a.id, kind: 'new_thread', email_state: 'sent' }]);
  });

  it('after opting out, rows stay in-app and no email goes', async () => {
    const pref = await notify.ensurePref(people.a.id, ws);
    await service.from('member_notification_pref').update({ email_off: true }).eq('unsubscribe_token', pref.unsubscribe_token);
    await service.from('member_notification').insert({
      workspace_id: ws,
      person_id: people.a.id,
      kind: 'session_moved',
      thread_id: t1.id,
      subject: 'Brand new · Day 1',
      starts_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      email_state: 'pending',
    });
    sent.length = 0;
    const later = new Date(Date.now() + notify.QUIET_MS + 60_000);
    const r = await notify.runNotificationDigest(later, { personIds: [people.a.id] });
    expect(sent).toHaveLength(0);
    expect(r.skipped).toBe(1);
    await service.from('member_notification_pref').update({ email_off: false }).eq('unsubscribe_token', pref.unsubscribe_token);
  });
});

describe("the organiser's SEND", () => {
  const change = (kind: 'moved' | 'cancelled' | 'added', startsInDays: number) => ({
    id: randomUUID(),
    engagement_id: randomUUID(),
    kind,
    title: 'Day 1',
    was: { starts_at: new Date(Date.now() + startsInDays * 86_400_000).toISOString(), ends_at: null, location: null, location_url: null, meeting_url: null },
    now_state: { starts_at: new Date(Date.now() + (startsInDays + 1) * 86_400_000).toISOString(), ends_at: null, location: null, location_url: null, meeting_url: null },
    created_at: new Date().toISOString(),
  });

  it('the dialog reach counts participants and followers without a place', async () => {
    expect(await notify.sendReach(t1.id)).toEqual({ participants: 1, followers: 1 });
  });

  it('a move: the participant in-app only, the follower in-app plus the digest', async () => {
    await service.from('member_notification').delete().eq('workspace_id', ws).neq('kind', 'new_thread');
    const n = await notify.notifyCalendarSend(t1.id, [change('moved', 3)]);
    expect(n).toBe(2);
    const moved = (await rowsFor(t1.id)).filter((r) => r.kind === 'session_moved');
    expect(moved).toEqual(
      expect.arrayContaining([
        { person_id: people.b.id, kind: 'session_moved', email_state: 'none' },
        { person_id: people.a.id, kind: 'session_moved', email_state: 'pending' },
      ]),
    );
    expect(moved).toHaveLength(2);
  });

  it('a past session, or a newly added one, tells nobody', async () => {
    expect(await notify.notifyCalendarSend(t1.id, [change('moved', -5)])).toBe(0);
    expect(await notify.notifyCalendarSend(t1.id, [change('added', 3)])).toBe(0);
  });
});
