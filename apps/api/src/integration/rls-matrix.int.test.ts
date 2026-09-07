// The two-user cross-workspace RLS matrix — the tenancy guarantee the whole
// data wall rests on, tested with REAL sessions: two throwaway workspaces,
// two fixture auth users (one each), sessions minted via the supported
// magiclink path so the custom_access_token_hook stamps real claims. The
// matrix table is `program` (pure workspace-scoped FOR ALL policy);
// `person` adds a can_see_person visibility gate on top, so for person we
// assert only the cross-tenant denial, which must hold regardless.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  jwtClaims,
  service,
  type FixtureUser,
} from './staging.js';

let wsA: string, wsB: string;
let userA: FixtureUser, userB: FixtureUser;
let programA: string, programB: string;
let personB: string;
let appId: string;

beforeAll(async () => {
  wsA = await createThrowawayWorkspace('rlsA');
  wsB = await createThrowawayWorkspace('rlsB');
  [userA, userB] = await Promise.all([
    createFixtureUser(wsA, 'rls-a'),
    createFixtureUser(wsB, 'rls-b'),
  ]);

  const { data: app } = await service
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  appId = app!.id as string;

  const mkProgram = async (ws: string, title: string) => {
    const { data, error } = await service
      .from('program')
      .insert({ workspace_id: ws, app_id: appId, title, format: 'event' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };
  programA = await mkProgram(wsA, 'int-test program A');
  programB = await mkProgram(wsB, 'int-test program B');

  const { data: p, error: pErr } = await service
    .from('person')
    .insert({ workspace_id: wsB, first_name: 'Int', last_name: 'TestB' })
    .select('id')
    .single();
  if (pErr) throw new Error(pErr.message);
  personB = p.id as string;
}, 60_000);

afterAll(async () => {
  await service.from('program').delete().in('id', [programA, programB].filter(Boolean));
  if (personB) await service.from('person').delete().eq('id', personB);
  if (userA) await deleteFixtureUser(userA);
  if (userB) await deleteFixtureUser(userB);
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
}, 60_000);

describe('the session carries the right tenant', () => {
  it("each user's JWT claims name their own workspace", () => {
    expect(jwtClaims(userA).workspace_id, JSON.stringify(jwtClaims(userA))).toBe(wsA);
    expect(jwtClaims(userB).workspace_id, JSON.stringify(jwtClaims(userB))).toBe(wsB);
  });
});

describe('reads stay inside the tenant', () => {
  it('A sees its own program and not B’s (and vice versa)', async () => {
    const seen = async (u: FixtureUser) => {
      const { data, error } = await u.client
        .from('program')
        .select('id')
        .in('id', [programA, programB]);
      expect(error).toBeNull();
      return (data ?? []).map((r) => r.id);
    };
    expect(await seen(userA)).toEqual([programA]);
    expect(await seen(userB)).toEqual([programB]);
  });

  it("A cannot see B's workspace row", async () => {
    const { data } = await userA.client.from('workspace').select('id').eq('id', wsB);
    expect(data ?? []).toEqual([]);
  });

  it("A cannot see B's person rows (cross-tenant denial holds regardless of can_see_person)", async () => {
    const { data } = await userA.client.from('person').select('id').eq('id', personB);
    expect(data ?? []).toEqual([]);
  });

  it("A cannot see B's user row", async () => {
    const { data } = await userA.client.from('user').select('id').eq('id', userB.userId);
    expect(data ?? []).toEqual([]);
  });
});

describe('writes stay inside the tenant', () => {
  it("A cannot update B's program (0 rows affected, value unchanged)", async () => {
    const { data } = await userA.client
      .from('program')
      .update({ title: 'HIJACKED' })
      .eq('id', programB)
      .select('id');
    expect(data ?? []).toEqual([]);
    const { data: check } = await service.from('program').select('title').eq('id', programB).single();
    expect(check!.title).toBe('int-test program B');
  });

  it("A cannot insert a program into B's workspace", async () => {
    const { data, error } = await userA.client
      .from('program')
      .insert({ workspace_id: wsB, app_id: appId, title: 'smuggled', format: 'event' })
      .select('id');
    // RLS WITH CHECK violation → error; either way, nothing lands.
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
    const { data: check } = await service
      .from('program')
      .select('id')
      .eq('workspace_id', wsB)
      .eq('title', 'smuggled');
    expect(check ?? []).toEqual([]);
  });

  it("A cannot delete B's program", async () => {
    const { data } = await userA.client.from('program').delete().eq('id', programB).select('id');
    expect(data ?? []).toEqual([]);
    const { data: still } = await service.from('program').select('id').eq('id', programB);
    expect(still).toHaveLength(1);
  });
});
