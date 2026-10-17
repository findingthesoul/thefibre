// What you see of a contact's TIMELINE follows the hierarchy (contacts,
// slice 2, step 4; migration 20261017143224). Real sessions on staging read
// `activity` through its row policy (can_see_activity), the path the contact
// page takes (/activities, userClient).
//
// In the PERMANENT fixture workspace: activity is append-only, so its rows
// pin a workspace for good. Everything else is removed afterwards.
//
// One person P, on thread X (team T) and thread Y, and a booking B of a
// round-robin type owned by team V. Rows about P:
//   aX  ref thread X        aY  ref thread Y        aB  ref booking B
//   aM  no ref (a membership row)                   aN  no ref, written BY the organiser
// Pinned:
//   · X's organiser sees aX and their own aN — not aY, aB, aM;
//   · X's host sees aX; a member of T sees aX; neither sees aY;
//   · B's host sees aB; a member of V sees aB; neither sees aX;
//   · an admin sees all five;
//   · a stranger (workspace role organiser, no role, no team) sees none;
//   · a former host (role removed) no longer sees aX.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

const tag = randomUUID().slice(0, 8);
let ws = '';
const users: Record<string, FixtureUser> = {};
const ids: Record<string, string> = {};
const made: { table: string; id: string }[] = [];

async function ins(table: string, row: Record<string, unknown>, keep = true): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  if (keep) made.push({ table, id: data!.id as string });
  return data!.id as string;
}

async function sees(u: FixtureUser): Promise<string[]> {
  const names: Record<string, string> = { [ids.aX!]: 'aX', [ids.aY!]: 'aY', [ids.aB!]: 'aB', [ids.aM!]: 'aM', [ids.aN!]: 'aN' };
  const { data, error } = await u.client.from('activity').select('id').in('id', Object.keys(names));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => names[r.id as string]!).sort();
}

beforeAll(async () => {
  ws = await getPermanentFixtureWorkspace('int-activity-ref-fixtures');
  const threadApp = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  const roles = ['organiser', 'host', 'teamT', 'booker', 'teamV', 'admin', 'stranger', 'former'] as const;
  for (const r of roles) {
    users[r] = await createFixtureUser(ws, `av-${r}`);
    await service.from('workspace_member').upsert({ workspace_id: ws, user_id: users[r]!.userId, workspace_role: r === 'admin' ? 'admin' : 'organiser' });
  }
  for (const t of ['T', 'V']) ids[`team${t}`] = await ins('team', { workspace_id: ws, slug: `av-${t.toLowerCase()}-${tag}`, name: `AV ${t}` });
  await service.from('team_member').insert({ team_id: ids.teamT, user_id: users.teamT!.userId, status: 'active' });
  await service.from('team_member').insert({ team_id: ids.teamV, user_id: users.teamV!.userId, status: 'active' });
  for (const r of ['organiser', 'host', 'former']) ids[`org_${r}`] = await ins('thread_organiser', { user_id: users[r]!.userId, workspace_id: ws, slug: `av-${r}-${tag}` });
  const thread = async (t: string, org: string, team: string | null) => {
    const prog = await ins('program', { workspace_id: ws, app_id: threadApp, title: `AV ${t} ${tag}`, format: 'event' });
    return ins('thread_thread', { workspace_id: ws, program_id: prog, organiser_id: org, team_id: team, slug: `av-${t}-${tag}`, language: 'en' });
  };
  ids.threadX = await thread('x', ids.org_organiser!, ids.teamT!);
  ids.threadY = await thread('y', ids.org_former!, null);
  await service.from('thread_thread_organiser').insert({ thread_id: ids.threadX, organiser_id: ids.org_host, role: 'host' });
  await service.from('thread_thread_organiser').insert({ thread_id: ids.threadX, organiser_id: ids.org_former, role: 'host' });
  // Not in `made`: a person with activity rows cannot be deleted; soft-deleted after.
  ids.P = await ins('person', { workspace_id: ws, first_name: 'AV', last_name: tag }, false);
  ids.host = await ins('meet_host', { user_id: users.booker!.userId, workspace_id: ws, slug: `av-host-${tag}`, timezone: 'UTC' });
  ids.type = await ins('meet_meeting_type', { workspace_id: ws, host_id: ids.host, team_id: ids.teamV, slug: `av-rr-${tag}`, name: 'AV', duration_minutes: 30, event_type: 'round_robin', conferencing_provider: 'none' });
  const start = new Date(Date.now() + 7 * 86_400_000);
  ids.booking = await ins('meet_booking', { workspace_id: ws, meeting_type_id: ids.type, host_id: ids.host, invitee_email: `av-${tag}@example.com`, invitee_name: 'AV', invitee_person_id: ids.P, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 1_800_000).toISOString(), request_id: `av-${tag}` });
  const act = (type: string, extra: Record<string, unknown> = {}) =>
    ins('activity', { workspace_id: ws, person_id: ids.P, app_id: threadApp, type, subject: `AV ${tag}`, ...extra }, false);
  ids.aX = await act('event_registered');
  ids.aY = await act('event_registered');
  ids.aB = await act('meeting_booked');
  ids.aM = await act('membership_joined');
  ids.aN = await act('fibre-flow.note.logged', { created_by: users.organiser!.userId });
  const ref = (activity_id: string, ref_kind: string, ref_id: string) => service.from('activity_ref').insert({ activity_id, workspace_id: ws, ref_kind, ref_id });
  await ref(ids.aX, 'thread', ids.threadX);
  await ref(ids.aY, 'thread', ids.threadY);
  await ref(ids.aB, 'meet_booking', ids.booking);
}, 240_000);

afterAll(async () => {
  await service.from('activity_ref').delete().in('activity_id', [ids.aX, ids.aY, ids.aB].filter(Boolean) as string[]);
  if (ids.threadX) await service.from('thread_thread_organiser').delete().eq('thread_id', ids.threadX);
  for (const t of ['teamT', 'teamV']) if (ids[t]) await service.from('team_member').delete().eq('team_id', ids[t]);
  for (const m of [...made].reverse()) await service.from(m.table).delete().eq('id', m.id);
  if (ids.P) await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', ids.P);
  for (const u of Object.values(users)) {
    await service.from('workspace_member').delete().eq('user_id', u.userId).eq('workspace_id', ws);
    await deleteFixtureUser(u);
  }
}, 240_000);

describe('a contact’s timeline follows the hierarchy', () => {
  it('the organiser of X: X’s row and their own note — nothing else', async () => {
    expect(await sees(users.organiser!)).toEqual(['aN', 'aX']);
  });
  it('X’s host and a member of X’s team: X’s row only', async () => {
    expect(await sees(users.host!)).toEqual(['aX']);
    expect(await sees(users.teamT!)).toEqual(['aX']);
  });
  it('the booking’s host and a member of the type’s team: the booking’s row only', async () => {
    expect(await sees(users.booker!)).toEqual(['aB']);
    expect(await sees(users.teamV!)).toEqual(['aB']);
  });
  it('an admin: all five, the membership row included', async () => {
    expect(await sees(users.admin!)).toEqual(['aB', 'aM', 'aN', 'aX', 'aY']);
  });
  it('a stranger: none', async () => {
    expect(await sees(users.stranger!)).toEqual([]);
  });
  it('stepping off loses it: a host of X who leaves keeps only Y (which they organise)', async () => {
    expect(await sees(users.former!)).toEqual(['aX', 'aY']);
    await service.from('thread_thread_organiser').delete().eq('thread_id', ids.threadX).eq('organiser_id', ids.org_former);
    expect(await sees(users.former!)).toEqual(['aY']);
  });
});
