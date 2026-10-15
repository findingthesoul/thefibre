// POST /meet/bookings/:id/link — the host adds the join link a booking went
// out without, and the guest's calendar entry is updated in place.
//
// The other half of v1.213.0's Zoom fallback: a Zoom booking with no Zoom
// meeting and no personal room confirms with no link, the host's mail says
// so, and this is where the host fixes it. What has to hold:
//   · the link is stored and the invitation's SEQUENCE goes up by one, in the
//     row, BEFORE the mail is built — a calendar ignores an update numbered
//     at or below the one it holds;
//   · the guest is mailed an invitation carrying the link at that sequence;
//   · only the booking's own host may do it, only with an https link, and
//     never on a cancelled booking.
//
// Real routes in process, staging database, a throwaway workspace with a
// fixture host session, the mail client replaced by a recorder.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

type Sent = { to: string; subject?: string; text?: string; attachments?: { filename: string; content: string }[] };
const sent: Sent[] = [];
vi.mock('../lib/email/client.js', () => ({
  sendEmail: async (msg: Sent) => {
    sent.push(msg);
  },
  platformFromAddress: () => 'noreply@thefibre.app',
}));

let app: Hono;
let workspaceId = '';
let host: FixtureUser;
let stranger: FixtureUser;
let hostId = '';
let mtId = '';
const GUEST = `int-link-guest-${randomUUID().slice(0, 6)}@example.com`;
const LINK = `https://example.zoom.us/j/link${Date.now()}`;

const call = (who: FixtureUser, path: string, body: unknown) =>
  app.request(`/api/v1/meet${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${who.accessToken}`,
      'X-App-ID': 'fibre-meet',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

async function seat(user: FixtureUser) {
  const { error: wmErr } = await service
    .from('workspace_member')
    .insert({ workspace_id: workspaceId, user_id: user.userId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'fibre-meet').single();
  const { error: amErr } = await service
    .from('app_membership')
    .upsert({ user_id: user.userId, app_id: appRow!.id, role: 'admin', is_direct: true }, { onConflict: 'user_id,app_id' });
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);
}

async function booking(status: string, meetUrl: string | null = null): Promise<string> {
  const starts = new Date(Date.now() + 5 * 86400_000);
  starts.setUTCHours(10, 0, 0, 0);
  const { data, error } = await service
    .from('meet_booking')
    .insert({
      workspace_id: workspaceId, host_id: hostId, meeting_type_id: mtId, status,
      invitee_email: GUEST, invitee_name: 'Link Guest', request_id: randomUUID(),
      starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + 1800_000).toISOString(),
      meet_url: meetUrl,
    })
    .select('id')
    .single();
  if (error) throw new Error(`booking: ${error.message}`);
  return data.id as string;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  workspaceId = await createThrowawayWorkspace('bookinglink');
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'fibre-meet').single();
  await service.from('workspace_app').upsert({ workspace_id: workspaceId, app_id: appRow!.id }, { onConflict: 'workspace_id,app_id' });
  host = await createFixtureUser(workspaceId, 'linkhost');
  stranger = await createFixtureUser(workspaceId, 'linkother');
  await seat(host);
  await seat(stranger);
  const h = await service
    .from('meet_host')
    .insert({ workspace_id: workspaceId, user_id: host.userId, slug: `int-link-${randomUUID().slice(0, 8)}`, timezone: 'UTC' })
    .select('id')
    .single();
  if (h.error) throw new Error(`meet_host: ${h.error.message}`);
  hostId = h.data.id as string;
  const mt = await service
    .from('meet_meeting_type')
    .insert({
      workspace_id: workspaceId, host_id: hostId, name: 'Zoom call', slug: `int-link-${randomUUID().slice(0, 6)}`,
      duration_minutes: 30, conferencing_provider: 'zoom', event_type: 'one_on_one', is_active: true,
    })
    .select('id')
    .single();
  if (mt.error) throw new Error(`meeting type: ${mt.error.message}`);
  mtId = mt.data.id as string;
}, 90_000);

afterAll(async () => {
  await service.from('meet_booking').delete().eq('workspace_id', workspaceId);
  await service.from('meet_meeting_type').delete().eq('workspace_id', workspaceId);
  await service.from('meet_host').delete().eq('workspace_id', workspaceId);
  for (const u of [host, stranger].filter(Boolean)) {
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
  }
  await service.from('workspace_app').delete().eq('workspace_id', workspaceId);
  for (const u of [host, stranger].filter(Boolean)) await deleteFixtureUser(u);
  if (workspaceId) await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

beforeEach(() => {
  sent.length = 0;
});

describe('POST /meet/bookings/:id/link', () => {
  it('stores the link, raises the sequence, and sends the guest the updated invitation', async () => {
    const id = await booking('confirmed');
    const r = await call(host, `/bookings/${id}/link`, { meet_url: LINK });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, meet_url: LINK, guest_notified: true });

    const { data } = await service.from('meet_booking').select('meet_url, invite_sequence').eq('id', id).single();
    expect(data).toEqual({ meet_url: LINK, invite_sequence: 1 });

    const mail = sent.find((m) => m.to === GUEST);
    expect(mail, `nothing to the guest; sent: ${sent.map((m) => m.to).join(', ')}`).toBeTruthy();
    expect(mail!.text ?? '').toContain(LINK);
    const ics = Buffer.from(mail!.attachments?.[0]?.content ?? '', 'base64').toString('utf8').replace(/\r?\n[ \t]/g, '');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('SEQUENCE:1');
    expect(ics).toContain(`URL:${LINK}`);
    expect(ics).toContain(`UID:meet-${id}@thefibre.app`);

    // And again: the next change is numbered higher still.
    const again = await call(host, `/bookings/${id}/link`, { meet_url: `${LINK}2` });
    expect(again.status).toBe(200);
    const { data: twice } = await service.from('meet_booking').select('invite_sequence').eq('id', id).single();
    expect(twice?.invite_sequence).toBe(2);
  });

  it('refuses anybody but the booking’s host, and changes nothing', async () => {
    const id = await booking('confirmed');
    const r = await call(stranger, `/bookings/${id}/link`, { meet_url: LINK });
    expect(r.status).toBe(403);
    const { data } = await service.from('meet_booking').select('meet_url, invite_sequence').eq('id', id).single();
    expect(data).toEqual({ meet_url: null, invite_sequence: 0 });
    expect(sent).toHaveLength(0);
  });

  it('refuses a link that is not https', async () => {
    const id = await booking('confirmed');
    for (const bad of ['http://example.com/j/1', 'javascript:alert(1)', 'not a url']) {
      const r = await call(host, `/bookings/${id}/link`, { meet_url: bad });
      expect(r.status, bad).toBe(400);
    }
    expect(sent).toHaveLength(0);
  });

  it('refuses a cancelled booking', async () => {
    const id = await booking('cancelled');
    const r = await call(host, `/bookings/${id}/link`, { meet_url: LINK });
    expect(r.status).toBe(409);
  });

  it('stores the link on a pending request without mailing — approval sends the first invitation', async () => {
    const id = await booking('pending_approval');
    const r = await call(host, `/bookings/${id}/link`, { meet_url: LINK });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ guest_notified: false });
    const { data } = await service.from('meet_booking').select('meet_url').eq('id', id).single();
    expect(data?.meet_url).toBe(LINK);
    expect(sent).toHaveLength(0);
  });
});
