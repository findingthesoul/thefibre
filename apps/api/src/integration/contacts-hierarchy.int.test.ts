// Who you see in Fibre Contacts follows the hierarchy (Sjoerd, 2026-10-17:
// "yes contacts"; migration 20261017133142). REAL sessions on staging: every
// viewer is a fixture user with a hook-stamped JWT, and every read goes
// through the person table's row policy, which calls can_see_person — the
// same path Contacts takes (routes/persons.ts, userClient).
//
// One throwaway workspace:
//   · thread X (team T) with participant P, and a fellow participant F who
//     holds a Fibre account; thread Y (no team) with participant Q;
//   · a round-robin Meet type owned by team V, with a booking for invitee R.
//
// Pinned, one viewer per condition:
//   · X's organiser sees P (and F), not Q; X's host sees P; X's facilitator
//     sees P; a member of T sees P, not Q; a member of another team U sees
//     neither;
//   · a former host (role removed) no longer sees P — stepping off loses it;
//   · the booking's host sees R; a member of V (the type's team) sees R;
//   · an admin sees P, Q and R (today's rule, pinned);
//   · a stranger — workspace role organiser (the non-admin role), internal,
//     no thread role, no team — sees none: the workspace role gives nothing;
//   · F, who only SHARES thread X with P, no longer sees P (the
//     fellow-participant clause is gone);
//   · a viewer whose session is in another workspace sees nothing here.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

const tag = randomUUID().slice(0, 8);
let ws = '';
let otherWs = '';
let threadAppId = '';
const users: Record<string, FixtureUser> = {};
const ids: Record<string, string> = {};

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data!.id as string;
}

/** Which of P, Q, R (and F's person) this viewer's session can read. */
async function sees(u: FixtureUser): Promise<string[]> {
  const names: Record<string, string> = { [ids.P!]: 'P', [ids.Q!]: 'Q', [ids.R!]: 'R', [ids.PF!]: 'F' };
  const { data, error } = await u.client.from('person').select('id').in('id', Object.keys(names));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => names[r.id as string]!).sort();
}

beforeAll(async () => {
  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  ws = await createThrowawayWorkspace('contacts');
  otherWs = await createThrowawayWorkspace('contacts-other');

  const roles = ['organiser', 'host', 'facilitator', 'teamT', 'teamU', 'former', 'booker', 'teamV', 'admin', 'stranger', 'fellow'] as const;
  for (const r of roles) users[r] = await createFixtureUser(ws, `ch-${r}`);
  users.elsewhere = await createFixtureUser(otherWs, 'ch-elsewhere');
  for (const r of roles) {
    const { error } = await service.from('workspace_member').upsert({ workspace_id: ws, user_id: users[r]!.userId, workspace_role: r === 'admin' ? 'admin' : 'organiser' });
    if (error) throw new Error(`workspace_member: ${error.message}`);
  }
  await service.from('workspace_member').upsert({ workspace_id: otherWs, user_id: users.elsewhere!.userId, workspace_role: 'admin' });

  // Teams: T owns thread X; U is unrelated; V owns the Meet type.
  for (const t of ['T', 'U', 'V']) ids[`team${t}`] = await insert('team', { workspace_id: ws, slug: `ch-${t.toLowerCase()}-${tag}`, name: `Team ${t}` });
  for (const [u, t] of [['teamT', 'teamT'], ['teamU', 'teamU'], ['teamV', 'teamV']] as const) {
    await service.from('team_member').insert({ team_id: ids[t], user_id: users[u]!.userId, status: 'active' });
  }

  // Thread organisers (one row per user, unique).
  for (const r of ['organiser', 'host', 'facilitator', 'former']) {
    ids[`org_${r}`] = await insert('thread_organiser', { user_id: users[r]!.userId, workspace_id: ws, slug: `ch-${r}-${tag}` });
  }
  const program = async (title: string) => insert('program', { workspace_id: ws, app_id: threadAppId, title, format: 'event', status: 'active' });
  ids.progX = await program(`Contacts X ${tag}`);
  ids.progY = await program(`Contacts Y ${tag}`);
  ids.threadX = await insert('thread_thread', { workspace_id: ws, program_id: ids.progX, organiser_id: ids.org_organiser, team_id: ids.teamT, slug: `ch-x-${tag}`, language: 'en' });
  ids.threadY = await insert('thread_thread', { workspace_id: ws, program_id: ids.progY, organiser_id: ids.org_former, slug: `ch-y-${tag}`, language: 'en' });
  for (const [r, role] of [['host', 'host'], ['facilitator', 'facilitator'], ['former', 'host']] as const) {
    const { error } = await service.from('thread_thread_organiser').insert({ thread_id: ids.threadX, organiser_id: ids[`org_${r}`], role });
    if (error) throw new Error(`thread_thread_organiser: ${error.message}`);
  }

  // Participants. F holds a Fibre account (users.fellow) and is enrolled in X too.
  ids.P = await insert('person', { workspace_id: ws, first_name: 'Pia', last_name: 'Participant' });
  ids.Q = await insert('person', { workspace_id: ws, first_name: 'Quinn', last_name: 'Other' });
  ids.R = await insert('person', { workspace_id: ws, first_name: 'Rosa', last_name: 'Invitee' });
  ids.PF = await insert('person', { workspace_id: ws, first_name: 'Fay', last_name: 'Fellow', email: users.fellow!.email });
  await service.from('user').update({ person_id: ids.PF }).eq('id', users.fellow!.userId);
  for (const [p, prog] of [['P', 'progX'], ['PF', 'progX'], ['Q', 'progY']] as const) {
    await insert('enrolment', { program_id: ids[prog], person_id: ids[p], status: 'enrolled' });
  }

  // Meet: the booker hosts; the type is round robin, owned by team V.
  ids.meetHost = await insert('meet_host', { user_id: users.booker!.userId, workspace_id: ws, slug: `ch-host-${tag}`, timezone: 'UTC' });
  ids.meetType = await insert('meet_meeting_type', {
    workspace_id: ws,
    host_id: ids.meetHost,
    team_id: ids.teamV,
    slug: `ch-rr-${tag}`,
    name: 'Contacts round robin',
    duration_minutes: 30,
    event_type: 'round_robin',
    conferencing_provider: 'none',
  });
  const start = new Date(Date.now() + 7 * 86_400_000);
  ids.booking = await insert('meet_booking', {
    workspace_id: ws,
    meeting_type_id: ids.meetType,
    host_id: ids.meetHost,
    invitee_email: `ch-rosa-${tag}@example.com`,
    invitee_name: 'Rosa Invitee',
    invitee_person_id: ids.R,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    request_id: `ch-${tag}`,
  });
}, 240_000);

afterAll(async () => {
  if (ids.booking) await service.from('meet_booking').delete().eq('id', ids.booking);
  if (ids.meetType) await service.from('meet_meeting_type').delete().eq('id', ids.meetType);
  if (ids.meetHost) await service.from('meet_host').delete().eq('id', ids.meetHost);
  for (const t of ['threadX', 'threadY']) if (ids[t]) await service.from('thread_thread').delete().eq('id', ids[t]);
  for (const k of Object.keys(ids).filter((k) => k.startsWith('org_'))) await service.from('thread_organiser').delete().eq('id', ids[k]);
  for (const p of ['progX', 'progY']) {
    if (!ids[p]) continue;
    await service.from('enrolment').delete().eq('program_id', ids[p]);
    await service.from('program').delete().eq('id', ids[p]);
  }
  if (users.fellow) await service.from('user').update({ person_id: null }).eq('id', users.fellow.userId);
  for (const p of ['P', 'Q', 'R', 'PF']) if (ids[p]) await service.from('person').delete().eq('id', ids[p]);
  for (const t of ['teamT', 'teamU', 'teamV']) {
    if (!ids[t]) continue;
    await service.from('team_member').delete().eq('team_id', ids[t]);
    await service.from('team').delete().eq('id', ids[t]);
  }
  for (const u of Object.values(users)) {
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
  if (otherWs) expect(await deleteThrowawayWorkspace(otherWs)).toBe(true);
}, 240_000);

describe('a thread: organiser → host / facilitator, and its team', () => {
  it('the organiser of X sees X’s participants, not Y’s', async () => {
    expect(await sees(users.organiser!)).toEqual(['F', 'P']);
  });
  it('a host and a facilitator of X see X’s participants', async () => {
    expect(await sees(users.host!)).toEqual(['F', 'P']);
    expect(await sees(users.facilitator!)).toEqual(['F', 'P']);
  });
  it('a member of the team that owns X sees X’s participants; another team’s member sees none', async () => {
    expect(await sees(users.teamT!)).toEqual(['F', 'P']);
    expect(await sees(users.teamU!)).toEqual([]);
  });
  it('stepping off loses it: a host whose role is removed no longer sees X’s participants', async () => {
    // `former` organises Y and hosted X. Before: both. After stepping off X: Y only.
    expect(await sees(users.former!)).toEqual(['F', 'P', 'Q']);
    await service.from('thread_thread_organiser').delete().eq('thread_id', ids.threadX).eq('organiser_id', ids.org_former);
    expect(await sees(users.former!)).toEqual(['Q']);
  });
});

describe('Meet', () => {
  it('the booking’s host sees the invitee; so does a member of the team that owns the type', async () => {
    expect(await sees(users.booker!)).toEqual(['R']);
    expect(await sees(users.teamV!)).toEqual(['R']);
  });
});

describe('everyone else', () => {
  it('an admin sees everyone in the workspace', async () => {
    expect(await sees(users.admin!)).toEqual(['F', 'P', 'Q', 'R']);
  });
  it('a stranger — workspace role organiser, internal, no thread role, no team — sees no one', async () => {
    expect(await sees(users.stranger!)).toEqual([]);
  });
  it('a fellow participant no longer sees the others on the thread (only themself)', async () => {
    expect(await sees(users.fellow!)).toEqual(['F']);
  });
  it('an admin of ANOTHER workspace sees nothing here', async () => {
    expect(await sees(users.elsewhere!)).toEqual([]);
  });
});
