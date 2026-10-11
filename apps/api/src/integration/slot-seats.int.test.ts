// Several people into one slot, and the seat count the dialog is shown.
//
// Sjoerd, 2026-10-09: in Meet → Bookings → New booking, the host books
// SEVERAL people into the same meeting at once; for a group type each takes a
// seat, capacity is respected, and each gets their own confirmation and join
// link.
//
// Reading the route first showed that most of that already existed: capacity
// is enforced per (meeting_type_id, starts_at), and every attendee is already
// a booking of their own. So the feature is the dialog calling the existing
// path once per person — NOT a bulk endpoint, which would have to re-state
// the capacity rule and would be free to drift from it.
//
// What is new is `slotSeats()`: ONE count, asked by three callers.
//
// Who may exceed it is not the same question as what it is, and Sjoerd
// decided the two separately (2026-10-11): *"host can overbook"*. So:
//
//   - The PUBLIC booking page REFUSES past the count. A stranger filling in a
//     form cannot put a fourth body in a room that holds three.
//   - The HOST route ACCEPTS past it. The host is looking at their own room
//     and knows whether a fourth chair fits; a tool that argued with them
//     would just be worked around.
//   - The DIALOG shows the count, disables Add at zero, and offers an
//     explicit "Add anyway" with the over-capacity warning.
//
// That is not the offer and the enforcement drifting apart — the number is
// computed in one place and all three read it. What differs is the POLICY
// applied to it, which is a decision, made once, visible on screen. These
// cases pin both halves, because the easy mistake from here is for somebody
// to "fix" the host route back to a 409 and quietly undo it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let workspaceId = '';
let user: FixtureUser;
let hostId = '';
let meetingTypeId = '';
const tag = randomUUID().slice(0, 8);
const CAPACITY = 3;
/** One fixed moment everybody is booked into. */
const STARTS_AT = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();

const call = (path: string, init?: RequestInit) =>
  app.request(`/api/v1/meet${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-meet',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

const book = (who: string) =>
  call('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      meeting_type_id: meetingTypeId,
      invitee_name: `Guest ${who}`,
      invitee_email: `int-seats-${who}-${tag}@example.com`,
      starts_at: STARTS_AT,
      notify: false,
    }),
  });

const seats = async () => {
  const r = await call(`/slot-seats?meeting_type_id=${meetingTypeId}&starts_at=${encodeURIComponent(STARTS_AT)}`);
  return { status: r.status, body: (await r.json()) as { capacity?: number; taken?: number; left?: number } };
};

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  workspaceId = await createThrowawayWorkspace('slotseats');
  user = await createFixtureUser(workspaceId, 'slotseats');
  const { error: wmErr } = await service
    .from('workspace_member')
    .insert({ workspace_id: workspaceId, user_id: user.userId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'fibre-meet').single();
  const { error: waErr } = await service
    .from('workspace_app')
    .upsert({ workspace_id: workspaceId, app_id: appRow!.id }, { onConflict: 'workspace_id,app_id' });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
  const { error: amErr } = await service
    .from('app_membership')
    .upsert(
      { user_id: user.userId, app_id: appRow!.id, role: 'admin', is_direct: true },
      { onConflict: 'user_id,app_id' },
    );
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);

  const { data: host, error: hErr } = await service
    .from('meet_host')
    .insert({ workspace_id: workspaceId, user_id: user.userId, slug: `int-seats-${tag}`, timezone: 'Europe/Amsterdam' })
    .select('id')
    .single();
  if (hErr) throw new Error(`meet_host: ${hErr.message}`);
  hostId = host!.id as string;

  const { data: mt, error: mtErr } = await service
    .from('meet_meeting_type')
    .insert({
      workspace_id: workspaceId,
      host_id: hostId,
      name: 'Group workshop',
      slug: `int-seats-mt-${tag}`,
      duration_minutes: 60,
      is_active: true,
      event_type: 'group',
      capacity: CAPACITY,
    })
    .select('id')
    .single();
  if (mtErr) throw new Error(`meeting_type: ${mtErr.message}`);
  meetingTypeId = mt!.id as string;
}, 90_000);

afterAll(async () => {
  await service.from('meet_booking').delete().eq('workspace_id', workspaceId);
  await service.from('meet_meeting_type').delete().eq('workspace_id', workspaceId);
  await service.from('meet_host').delete().eq('workspace_id', workspaceId);
  await service.from('app_membership').delete().eq('user_id', user.userId);
  await service.from('workspace_member').delete().eq('user_id', user.userId);
  await service.from('workspace_app').delete().eq('workspace_id', workspaceId);
  if (user) await deleteFixtureUser(user);
  if (workspaceId) await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

describe('booking several people into one slot', () => {
  it('starts with every seat free, and says so', async () => {
    const s = await seats();
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body).toMatchObject({ capacity: CAPACITY, taken: 0, left: CAPACITY });
  });

  it('gives each person their own booking, one seat each', async () => {
    for (const who of ['one', 'two', 'three']) {
      const r = await book(who);
      expect(r.status, `${who}: ${await r.clone().text()}`).toBe(200);
    }
    // Three separate bookings, which is what makes three confirmations and
    // three join links — not one booking with three names on it.
    const { data } = await service
      .from('meet_booking')
      .select('id, invitee_email')
      .eq('meeting_type_id', meetingTypeId);
    expect(data?.length).toBe(CAPACITY);
    expect(new Set((data ?? []).map((b) => b.invitee_email)).size).toBe(CAPACITY);
  });

  it('counts the seats down as they go', async () => {
    const s = await seats();
    expect(s.body).toMatchObject({ capacity: CAPACITY, taken: CAPACITY, left: 0 });
  });

  // Sjoerd, 2026-10-11: "host can overbook". The host route takes the
  // instruction — and the booking is really written, which is the part worth
  // asserting: a 200 that saved nothing would be the worst of both answers.
  it('lets the HOST past the limit, and writes the booking', async () => {
    const r = await book('four');
    expect(r.status, `host overbooking must be allowed: ${await r.clone().text()}`).toBe(200);
    const { count } = await service
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_type_id', meetingTypeId);
    expect(count, 'the fourth booking must exist, not just be answered 200').toBe(CAPACITY + 1);
  });

  // The other half of the same decision, and the reason the first half is
  // safe: the limit still binds the people the host is not watching.
  it('still refuses the PUBLIC path, which is where strangers book', async () => {
    const r = await app.request('/api/v1/meet/public/bookings', {
      method: 'POST',
      headers: { 'X-App-ID': 'fibre-meet', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_type_id: meetingTypeId,
        invitee_name: 'Walk-in',
        invitee_email: `int-seats-public-${tag}@example.com`,
        starts_at: STARTS_AT,
        // Required by the public route: its idempotency key, so a
        // double-submitted form does not become two bookings.
        request_id: `int-seats-public-${tag}`,
        notify: false,
      }),
    });
    expect(r.status, `public booking into a full slot: ${await r.clone().text()}`).toBe(409);
    expect((await r.json()) as { code?: string }).toMatchObject({ code: 'slot_full' });
    const { count } = await service
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_type_id', meetingTypeId);
    expect(count, 'a refused public booking must not have been written').toBe(CAPACITY + 1);
  });

  // The count the dialog reads says NONE LEFT, and the host route says yes
  // anyway. Spelled out as its own case because it reads like a bug: the
  // dialog is not lying, it is reporting a full room and then letting the
  // host override it on purpose ("Add anyway", with the warning). The count
  // also keeps counting past the limit rather than clamping, so the host can
  // see how far over they are.
  it('says none left, and lets the host in anyway', async () => {
    const before = await seats();
    expect(before.body, 'the slot is over its capacity by now').toMatchObject({
      capacity: CAPACITY,
      taken: CAPACITY + 1,
      left: 0,
    });

    const r = await book('five');
    expect(r.status, `the host is not stopped by left=0: ${await r.clone().text()}`).toBe(200);

    const after = await seats();
    expect(after.body, 'the count keeps counting; it does not stop at capacity').toMatchObject({
      taken: CAPACITY + 2,
      left: 0,
    });
  });

  // A seat count tells you somebody has a meeting at a given minute, which is
  // not another workspace's business.
  it('does not answer for another workspace’s meeting type', async () => {
    const otherWs = await createThrowawayWorkspace('slotseats-other');
    let otherUser: FixtureUser | null = null;
    try {
      // Its own user: meet_host.user_id is UNIQUE GLOBALLY, one host row per
      // person, so the first fixture's user cannot also host here. (Found by
      // the constraint — the first version of this case reused `user` and got
      // a null row back.)
      otherUser = await createFixtureUser(otherWs, 'slotseats-other');
      const { data: otherHost } = await service
        .from('meet_host')
        .insert({ workspace_id: otherWs, user_id: otherUser.userId, slug: `int-seats-other-${tag}`, timezone: 'UTC' })
        .select('id')
        .single();
      const { data: otherMt } = await service
        .from('meet_meeting_type')
        .insert({
          workspace_id: otherWs,
          host_id: otherHost!.id,
          name: 'Someone else',
          slug: `int-seats-othermt-${tag}`,
          duration_minutes: 30,
          is_active: true,
          event_type: 'group',
          capacity: 5,
        })
        .select('id')
        .single();

      const r = await call(
        `/slot-seats?meeting_type_id=${otherMt!.id}&starts_at=${encodeURIComponent(STARTS_AT)}`,
      );
      expect(r.status, 'another workspace’s slot must not be readable').toBe(404);

      await service.from('meet_meeting_type').delete().eq('workspace_id', otherWs);
      await service.from('meet_host').delete().eq('workspace_id', otherWs);
    } finally {
      if (otherUser) await deleteFixtureUser(otherUser);
      await deleteThrowawayWorkspace(otherWs);
    }
  });
});
