// Member directory slice 2a: the floor under the member's own choice.
//
// WHAT THIS REACHES, AND WHAT IT DOES NOT. The interesting logic of 2a lives
// in the portal ROUTE — write the choice to every person row a proven email
// owns, record consent on switch-on, revoke on switch-off, refuse a
// workspace that does not know you. That route runs on the service role, so
// RLS cannot test it and nor can this file; it needs a deployed API and is
// listed as unverified in the release request.
//
// What this file does test is the floor beneath it, and one thing that would
// otherwise fail only in production:
//
// 1. the CHECK constraint actually accepts 'member_directory' — a migration
//    that drops and re-adds a constraint by DISCOVERING its name is exactly
//    the kind of thing that works locally and fails on a remote whose
//    generated name differs;
// 2. an ordinary authenticated user of another workspace cannot read entries;
// 3. NOBODY can write through RLS, including an admin of the right
//    workspace. That is deliberate and worth asserting: an admin who could
//    flip `listed` could list a member who declined, which is the single
//    thing this table exists to prevent.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let wsA: string, wsB: string;
let userA: FixtureUser, userB: FixtureUser;
let personA: string;
let membershipAppId: string;

async function makeMembershipAdmin(ws: string, u: FixtureUser) {
  await service
    .from('workspace_app')
    .upsert({ workspace_id: ws, app_id: membershipAppId }, { onConflict: 'workspace_id,app_id' });
  await service
    .from('app_membership')
    .upsert(
      { user_id: u.userId, app_id: membershipAppId, role: 'admin', is_direct: true },
      { onConflict: 'user_id,app_id' },
    );
  await service
    .from('workspace_member')
    .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
}

beforeAll(async () => {
  wsA = await createThrowawayWorkspace('entA');
  wsB = await createThrowawayWorkspace('entB');
  [userA, userB] = await Promise.all([
    createFixtureUser(wsA, 'ent-a'),
    createFixtureUser(wsB, 'ent-b'),
  ]);

  const { data: app } = await service.from('app').select('id').eq('slug', 'membership').single();
  membershipAppId = app!.id as string;
  await makeMembershipAdmin(wsA, userA);
  await makeMembershipAdmin(wsB, userB);

  const { data: p, error } = await service
    .from('person')
    .insert({ workspace_id: wsA, first_name: 'Int', last_name: 'DirEntry' })
    .select('id')
    .single();
  if (error) throw new Error(`person: ${error.message}`);
  personA = p.id as string;

  const { error: entryErr } = await service
    .from('membership_directory_entry')
    .insert({ workspace_id: wsA, person_id: personA, listed: true });
  if (entryErr) throw new Error(`entry: ${entryErr.message}`);
}, 90_000);

afterAll(async () => {
  if (personA) {
    await service.from('consent_record').delete().eq('person_id', personA);
    await service.from('membership_directory_entry').delete().eq('person_id', personA);
    await service.from('person').delete().eq('id', personA);
  }
  for (const u of [userA, userB]) {
    if (!u) continue;
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
}, 90_000);

describe('the consent purpose exists on the remote', () => {
  it("accepts 'member_directory' — the constraint really was re-added", async () => {
    const { data, error } = await service
      .from('consent_record')
      .insert({
        person_id: personA,
        purpose_code: 'member_directory',
        legal_basis: 'consent',
        text_version: 'int-test',
      })
      .select('id')
      .single();
    expect(error, error ? error.message : undefined).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it('still refuses a purpose that is not in the list', async () => {
    const { error } = await service
      .from('consent_record')
      .insert({ person_id: personA, purpose_code: 'not_a_purpose', legal_basis: 'consent' });
    expect(error, 'an unknown purpose must still be refused').not.toBeNull();
  });
});

describe('reading entries', () => {
  it("an admin of the entry's own workspace can read it (positive control)", async () => {
    const { data, error } = await userA.client
      .from('membership_directory_entry')
      .select('person_id, listed')
      .eq('person_id', personA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("an admin of another workspace cannot read it", async () => {
    const { data, error } = await userB.client
      .from('membership_directory_entry')
      .select('person_id')
      .eq('person_id', personA);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});

describe('writing entries through RLS', () => {
  // The member's choice is theirs. The only sanctioned writer is the portal
  // route acting for a proven email, which runs on the service role.
  it("an admin of the right workspace cannot flip someone's listing", async () => {
    const { data } = await userA.client
      .from('membership_directory_entry')
      .update({ listed: false })
      .eq('person_id', personA)
      .select('person_id');
    expect(data ?? [], 'no update policy exists for authenticated').toEqual([]);
    const { data: check } = await service
      .from('membership_directory_entry')
      .select('listed')
      .eq('person_id', personA)
      .single();
    expect(check!.listed, 'the choice must be unchanged').toBe(true);
  });

  it('an admin cannot insert an entry for somebody either', async () => {
    const { data: p } = await service
      .from('person')
      .insert({ workspace_id: wsA, first_name: 'Int', last_name: 'DirEntry2' })
      .select('id')
      .single();
    const other = p!.id as string;
    const { error } = await userA.client
      .from('membership_directory_entry')
      .insert({ workspace_id: wsA, person_id: other, listed: true });
    expect(error, 'no insert policy exists for authenticated').not.toBeNull();
    const { data: check } = await service
      .from('membership_directory_entry')
      .select('person_id')
      .eq('person_id', other);
    expect(check ?? []).toEqual([]);
    await service.from('person').delete().eq('id', other);
  });
});
