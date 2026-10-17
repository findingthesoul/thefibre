// The accessor's promise, checked on a client that records every call: no
// verb leaves without the workspace filter, no write names another workspace.
// tenant-db.int.test.ts proves the same against the staging database.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceRole, tenantDb, TenancyError } from './tenant-db.js';

type Call = [string, ...unknown[]];

/** A stand-in for supabase-js: every builder method is recorded, and an
 *  awaited chain resolves to `rows` (what the parent check reads). */
function recorder(rows: Record<string, unknown>[] = []) {
  const calls: Call[] = [];
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const m of ['eq', 'in', 'is', 'neq', 'select', 'single', 'maybeSingle', 'order', 'limit']) {
      c[m] = (...args: unknown[]) => {
        calls.push([m, ...args]);
        return c;
      };
    }
    c.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
    return c;
  };
  const client = {
    from(table: string) {
      calls.push(['from', table]);
      const verb = (name: string) => (...args: unknown[]) => {
        calls.push([name, ...args]);
        return chain();
      };
      return {
        select: verb('select'),
        update: verb('update'),
        delete: verb('delete'),
        insert: verb('insert'),
        upsert: verb('upsert'),
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const WS = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('tenantDb', () => {
  it('refuses to exist without a workspace', () => {
    const { client } = recorder();
    expect(() => tenantDb('', client)).toThrow(TenancyError);
    expect(() => tenantDb({ workspaceId: '' }, client)).toThrow(TenancyError);
  });

  it('select, update and delete each carry workspace_id = the caller', () => {
    for (const run of [
      (db: ReturnType<typeof tenantDb>) => db.from('person').select('id').eq('id', 'p1'),
      (db: ReturnType<typeof tenantDb>) => db.from('person').update({ first_name: 'A' }).eq('id', 'p1'),
      (db: ReturnType<typeof tenantDb>) => db.from('person').delete().eq('id', 'p1'),
    ]) {
      const { client, calls } = recorder();
      run(tenantDb({ workspaceId: WS }, client));
      expect(calls).toContainEqual(['eq', 'workspace_id', WS]);
      // the forced filter comes before anything the caller chains
      const i = calls.findIndex((c) => c[0] === 'eq' && c[1] === 'workspace_id');
      const j = calls.findIndex((c) => c[0] === 'eq' && c[1] === 'id');
      expect(i).toBeGreaterThan(-1);
      expect(i).toBeLessThan(j);
    }
  });

  it('insert stamps the workspace, and refuses a row naming another', () => {
    const { client, calls } = recorder();
    const db = tenantDb(WS, client);
    db.from('person').insert({ first_name: 'A' });
    expect(calls).toContainEqual(['insert', { first_name: 'A', workspace_id: WS }, undefined]);
    db.from('person').insert([{ first_name: 'B', workspace_id: WS }]);
    expect(calls).toContainEqual(['insert', [{ first_name: 'B', workspace_id: WS }], undefined]);
    expect(() => db.from('person').insert({ first_name: 'C', workspace_id: OTHER })).toThrow(TenancyError);
    expect(() => db.from('person').insert([{ a: 1 }, { a: 2, workspace_id: OTHER }])).toThrow(TenancyError);
  });

  it('update may not move a row to another workspace, or out of one', () => {
    const { client } = recorder();
    const db = tenantDb(WS, client);
    expect(() => db.from('person').update({ workspace_id: OTHER })).toThrow(TenancyError);
    expect(() => db.from('person').update({ workspace_id: null })).toThrow(TenancyError);
    expect(() => db.from('person').update({ workspace_id: WS, first_name: 'A' })).not.toThrow();
  });

  it('upsert must have the workspace in its conflict target', () => {
    const { client, calls } = recorder();
    const db = tenantDb(WS, client);
    expect(() => db.from('workspace_app').upsert({ app_id: 'x' }, { onConflict: 'app_id' })).toThrow(/onConflict/);
    expect(() => db.from('workspace_app').upsert({ app_id: 'x' }, { onConflict: '' })).toThrow(TenancyError);
    db.from('workspace_app').upsert({ app_id: 'x' }, { onConflict: 'workspace_id, app_id' });
    expect(calls).toContainEqual(['upsert', { app_id: 'x', workspace_id: WS }, { onConflict: 'workspace_id, app_id' }]);
  });

  it('from() refuses a table without workspace_id; child() refuses one with it', async () => {
    const { client } = recorder();
    const db = tenantDb(WS, client);
    // @ts-expect-error — the type refuses it too
    expect(() => db.from('person_tag')).toThrow(/child\(\)/);
    await expect(db.child('thread_engagement', { via: 'thread_thread', key: 'thread_id', id: 't1' })).rejects.toThrow(
      /own workspace_id/,
    );
  });

  it('workspace() is the caller’s own row only', () => {
    const { client, calls } = recorder();
    tenantDb(WS, client).workspace().select('name');
    expect(calls).toContainEqual(['from', 'workspace']);
    expect(calls).toContainEqual(['eq', 'id', WS]);
  });
});

describe('child()', () => {
  it('checks the parent inside the workspace, then pins the child to it', async () => {
    const { client, calls } = recorder([{ id: 'p1' }]);
    const tags = await tenantDb(WS, client).child('person_tag', { via: 'person', key: 'person_id', id: 'p1' });
    expect(tags).not.toBeNull();
    // the parent lookup: from person, workspace filter, id in [p1]
    expect(calls.slice(0, 4)).toEqual([
      ['from', 'person'],
      ['select', 'id', undefined],
      ['eq', 'workspace_id', WS],
      ['in', 'id', ['p1']],
    ]);
    calls.length = 0;
    tags!.select('tag');
    expect(calls).toContainEqual(['eq', 'person_id', 'p1']);
    calls.length = 0;
    tags!.insert({ tag: 'x' });
    expect(calls).toContainEqual(['insert', { tag: 'x', person_id: 'p1' }, undefined]);
    expect(() => tags!.insert({ tag: 'x', person_id: 'p2' })).toThrow(TenancyError);
  });

  it('is null when the parent is not in the workspace — the same answer as no such row', async () => {
    const { client } = recorder([]); // the scoped lookup finds nothing
    expect(await tenantDb(WS, client).child('person_tag', { via: 'person', key: 'person_id', id: 'p-elsewhere' })).toBeNull();
  });

  it('with several parents, every one must be found, and inserts must name theirs', async () => {
    const some = recorder([{ id: 'p1' }]);
    expect(
      await tenantDb(WS, some.client).child('person_tag', { via: 'person', key: 'person_id', id: ['p1', 'p2'] }),
    ).toBeNull();
    const all = recorder([{ id: 'p1' }, { id: 'p2' }]);
    const tags = await tenantDb(WS, all.client).child('person_tag', { via: 'person', key: 'person_id', id: ['p1', 'p2', 'p1'] });
    expect(tags).not.toBeNull();
    all.calls.length = 0;
    tags!.select('tag');
    expect(all.calls).toContainEqual(['in', 'person_id', ['p1', 'p2']]);
    expect(() => tags!.insert({ tag: 'x' })).toThrow(/must name/);
    expect(() => tags!.insert({ tag: 'x', person_id: 'p2' })).not.toThrow();
  });

  it('an empty id list is no access, not a query without a filter', async () => {
    const { client, calls } = recorder([{ id: 'p1' }]);
    expect(await tenantDb(WS, client).child('person_tag', { via: 'person', key: 'person_id', id: [] })).toBeNull();
    expect(await tenantDb(WS, client).child('person_tag', { via: 'person', key: 'person_id', id: '' })).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('serviceRole()', () => {
  it('needs a reason', () => {
    expect(() => serviceRole('')).toThrow(TenancyError);
    expect(() => serviceRole('because')).toThrow(TenancyError);
    expect(serviceRole('stripe webhook: keyed on the subscription id')).toBeTruthy();
  });
});
