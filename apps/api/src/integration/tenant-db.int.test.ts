// lib/tenant-db.ts against the real staging database: workspace A's accessor,
// handed workspace B's ids, reads nothing, changes nothing, writes nothing.
//
// The unit test (lib/tenant-db.test.ts) proves the filter is attached. This
// proves it MEANS what it says on Postgres, through PostgREST, with the
// service role — the client the accessor wraps and RLS does not see.
// The shape is the September tenancy tests': attack from a second workspace.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { tenantDb, TenancyError } from '../lib/tenant-db.js';

let wsA: string, wsB: string;
let personA: string, personB: string, tagB: string;

beforeAll(async () => {
  wsA = await createThrowawayWorkspace('tenantdbA');
  wsB = await createThrowawayWorkspace('tenantdbB');
  const ins = async (ws: string, name: string) => {
    const { data, error } = await service
      .from('person')
      .insert({ workspace_id: ws, first_name: 'Int', last_name: name })
      .select('id')
      .single();
    if (error) throw new Error(`person: ${error.message}`);
    return data.id as string;
  };
  personA = await ins(wsA, 'TenantA');
  personB = await ins(wsB, 'TenantB');
  const { data: t, error: tErr } = await service.from('tag').insert({ workspace_id: wsB, name: 'int-tenantdb' }).select('id').single();
  if (tErr) throw new Error(`tag: ${tErr.message}`);
  tagB = t.id as string;
  const { error: ptErr } = await service.from('person_tag').insert({ person_id: personB, tag_id: tagB });
  if (ptErr) throw new Error(`person_tag: ${ptErr.message}`);
}, 90_000);

afterAll(async () => {
  await service.from('person_tag').delete().eq('tag_id', tagB);
  await service.from('tag').delete().eq('id', tagB);
  for (const ws of [wsA, wsB]) if (ws) await deleteThrowawayWorkspace(ws);
}, 90_000);

describe('tenantDb on staging', () => {
  it('reads its own workspace’s row', async () => {
    const { data, error } = await tenantDb(wsA, service).from('person').select('id').eq('id', personA);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: personA }]);
  });

  it('reads nothing of another workspace by id', async () => {
    const { data, error } = await tenantDb(wsA, service).from('person').select('id, last_name').eq('id', personB);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('updates nothing of another workspace by id', async () => {
    const { data, error } = await tenantDb(wsA, service)
      .from('person')
      .update({ last_name: 'Overwritten' })
      .eq('id', personB)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: still } = await service.from('person').select('last_name').eq('id', personB).single();
    expect(still!.last_name).toBe('TenantB');
  });

  it('deletes nothing of another workspace by id', async () => {
    const { data, error } = await tenantDb(wsA, service).from('person').delete().eq('id', personB).select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: still } = await service.from('person').select('id').eq('id', personB);
    expect(still).toHaveLength(1);
  });

  it('refuses to insert into another workspace, before any request', () => {
    expect(() =>
      tenantDb(wsA, service).from('person').insert({ workspace_id: wsB, first_name: 'Int', last_name: 'Planted' }),
    ).toThrow(TenancyError);
  });

  it('stamps its own workspace on an insert that names none', async () => {
    const { data, error } = await tenantDb(wsA, service)
      .from('person')
      .insert({ first_name: 'Int', last_name: 'Stamped' })
      .select('id, workspace_id')
      .single();
    expect(error).toBeNull();
    expect(data!.workspace_id).toBe(wsA);
  });

  it('child(): another workspace’s parent is no access, the same answer as no row', async () => {
    const db = tenantDb(wsA, service);
    expect(await db.child('person_tag', { via: 'person', key: 'person_id', id: personB })).toBeNull();
    expect(await db.child('person_tag', { via: 'person', key: 'person_id', id: [personA, personB] })).toBeNull();
    expect(await db.child('person_tag', { via: 'person', key: 'person_id', id: '00000000-0000-0000-0000-000000000000' })).toBeNull();
  });

  it('child(): the owning workspace reaches its own child rows', async () => {
    const tags = await tenantDb(wsB, service).child('person_tag', { via: 'person', key: 'person_id', id: personB });
    expect(tags).not.toBeNull();
    const { data, error } = await tags!.select('tag_id');
    expect(error).toBeNull();
    expect(data).toEqual([{ tag_id: tagB }]);
  });
});
