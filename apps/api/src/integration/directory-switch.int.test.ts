// Slice 2a's evidence: the route actually running.
//
// Everything else about 2a was proved at the floor — the table, the RLS, the
// consent constraint. The part that matters runs on the SERVICE ROLE inside
// the portal route, where RLS cannot see it and the tenancy test could not
// reach it: write the choice to every person row a proven email owns, write
// a consent record when the switch goes ON, revoke it when it goes OFF, and
// refuse a workspace that does not know you.
//
// So this calls the deployed staging API over HTTP with a real participant
// session, and reads the database back with the service role.
//
// NOT a browser test. apps/my has no SSO land route — a member signs in with
// Google or an emailed code, so the e2e sign-in helper cannot drive it. The
// my.thread CARD is therefore still unrendered by any check of mine; what is
// proved here is everything behind it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let wsMine: string, wsOther: string;
let member: FixtureUser;
/** TWO person rows for one human in one workspace — the duplicate case the
 *  write-to-every-row rule exists for. Both carry the member's address. */
let personA = '';
let personB = '';
let tierId = '';
let memberRowId = '';

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${member.accessToken}`,
      'Content-Type': 'application/json',
      'X-App-ID': 'membership',
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body } as { status: number; body: any };
}

beforeAll(async () => {
  wsMine = await createThrowawayWorkspace('swMine');
  wsOther = await createThrowawayWorkspace('swOther');
  member = await createFixtureUser(wsMine, 'switch');

  const mkPerson = async () => {
    const { data, error } = await service
      .from('person')
      .insert({ workspace_id: wsMine, first_name: 'Int', last_name: 'Switch', email: member.email })
      .select('id')
      .single();
    if (error) throw new Error(`person: ${error.message}`);
    return data.id as string;
  };
  personA = await mkPerson();
  personB = await mkPerson();

  const { data: tier, error: tierErr } = await service
    .from('membership_tier')
    .insert({ workspace_id: wsMine, name: 'int-switch tier' })
    .select('id')
    .single();
  if (tierErr) throw new Error(`tier: ${tierErr.message}`);
  tierId = tier.id as string;

  // Only ONE of the two person rows holds the membership. The other is the
  // duplicate a merge might keep.
  const { data: m, error: mErr } = await service
    .from('membership_member')
    .insert({ workspace_id: wsMine, person_id: personA, tier_id: tierId, status: 'active' })
    .select('id')
    .single();
  if (mErr) throw new Error(`membership: ${mErr.message}`);
  memberRowId = m.id as string;
}, 90_000);

afterAll(async () => {
  for (const p of [personA, personB].filter(Boolean)) {
    await service.from('consent_record').delete().eq('person_id', p);
    await service.from('membership_directory_entry').delete().eq('person_id', p);
  }
  if (memberRowId) await service.from('membership_member').delete().eq('id', memberRowId);
  if (tierId) await service.from('membership_tier').delete().eq('id', tierId);
  for (const p of [personA, personB].filter(Boolean)) {
    await service.from('person').delete().eq('id', p);
  }
  if (member) await deleteFixtureUser(member);
  if (wsMine) await deleteThrowawayWorkspace(wsMine);
  if (wsOther) await deleteThrowawayWorkspace(wsOther);
}, 90_000);

describe('the switch arrives off', () => {
  it('reports the community, not listed, before anything is set', async () => {
    const { status, body } = await call('/api/v1/membership/portal/me/directory');
    expect(status, JSON.stringify(body)).toBe(200);
    const mine = (body.items ?? []).find((i: any) => i.workspace_id === wsMine);
    expect(mine, 'the community that knows them should appear').toBeTruthy();
    expect(mine.listed, 'always opt-in: nothing is listed until they say so').toBe(false);
  });
});

describe('switching on', () => {
  it('lists them, and writes a consent record for EVERY person row', async () => {
    const { status, body } = await call('/api/v1/membership/portal/me/directory', {
      method: 'PATCH',
      body: JSON.stringify({ workspace_id: wsMine, listed: true }),
    });
    expect(status, JSON.stringify(body)).toBe(200);

    const { data: entries } = await service
      .from('membership_directory_entry')
      .select('person_id, listed')
      .in('person_id', [personA, personB]);
    // The rule the merge makes necessary: both rows, not just the one the
    // membership points at.
    expect(entries ?? [], 'both person rows should carry the choice').toHaveLength(2);
    expect((entries ?? []).every((e) => e.listed === true)).toBe(true);

    const { data: consents } = await service
      .from('consent_record')
      .select('person_id, legal_basis, revoked_at')
      .in('person_id', [personA, personB])
      .eq('purpose_code', 'member_directory');
    expect(consents ?? [], 'a consent record per person row').toHaveLength(2);
    expect((consents ?? []).every((r) => r.legal_basis === 'consent')).toBe(true);
    expect((consents ?? []).every((r) => r.revoked_at === null)).toBe(true);
  });

  it('does not stack a second consent record when nothing changed', async () => {
    await call('/api/v1/membership/portal/me/directory', {
      method: 'PATCH',
      body: JSON.stringify({ workspace_id: wsMine, show_contact: true }),
    });
    const { data } = await service
      .from('consent_record')
      .select('id')
      .in('person_id', [personA, personB])
      .eq('purpose_code', 'member_directory');
    expect(data ?? [], 'editing contact visibility is not a new consent').toHaveLength(2);
  });
});

describe('switching off', () => {
  it('unlists them AND revokes the record — the evidence and the behaviour', async () => {
    const { status } = await call('/api/v1/membership/portal/me/directory', {
      method: 'PATCH',
      body: JSON.stringify({ workspace_id: wsMine, listed: false }),
    });
    expect(status).toBe(200);

    const { data: entries } = await service
      .from('membership_directory_entry')
      .select('listed')
      .in('person_id', [personA, personB]);
    expect((entries ?? []).every((e) => e.listed === false)).toBe(true);

    const { data: consents } = await service
      .from('consent_record')
      .select('revoked_at')
      .in('person_id', [personA, personB])
      .eq('purpose_code', 'member_directory');
    expect(
      (consents ?? []).every((r) => r.revoked_at !== null),
      'revoking must stamp the record, not only flip the flag',
    ).toBe(true);
  });
});

describe('a workspace that does not know you', () => {
  it('is refused, rather than quietly creating an entry slice 3 would read', async () => {
    const { status, body } = await call('/api/v1/membership/portal/me/directory', {
      method: 'PATCH',
      body: JSON.stringify({ workspace_id: wsOther, listed: true }),
    });
    expect(status, JSON.stringify(body)).toBe(403);
    const { data } = await service
      .from('membership_directory_entry')
      .select('person_id')
      .eq('workspace_id', wsOther);
    expect(data ?? [], 'nothing should have been written there').toEqual([]);
  });
});
