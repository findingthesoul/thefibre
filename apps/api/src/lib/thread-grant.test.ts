// Which thread a membership `thread` grant means (item 5). The rule:
// the ID decides; a slug is looked up in the grant's own workspace, then in
// the slug history; anything that does not land on exactly ONE thread is
// reported, never guessed — a grant enrols people.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resp = { data: unknown; error: { message: string } | null };
type Op = { table: string; calls: [string, unknown[]][] };
let respond: (op: Op) => Resp = () => ({ data: null, error: null });

function builder(table: string) {
  const op: Op = { table, calls: [] };
  const b: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          const r = respond(op);
          return (res: (v: Resp) => unknown) => Promise.resolve(r).then(res);
        }
        return (...args: unknown[]) => {
          op.calls.push([prop, args]);
          return b;
        };
      },
    },
  );
  return b;
}
vi.mock('../db.js', () => ({ adminClient: { from: (t: string) => builder(t) } }));

const { resolveGrantThread } = await import('./thread-grant.js');

const T = (id: string, slug: string) => ({ id, slug, program_id: `p-${id}`, workspace_id: 'ws' });
const filteredBy = (op: Op, col: string) => op.calls.find(([m, a]) => m === 'eq' && a[0] === col)?.[1][1];

beforeEach(() => {
  respond = () => ({ data: null, error: null });
});

describe('resolveGrantThread', () => {
  it('the ID decides, even when the slug in the config is stale', async () => {
    respond = (op) =>
      op.table === 'thread_thread' && filteredBy(op, 'id') === 't1' ? { data: T('t1', 'renamed'), error: null } : { data: null, error: null };
    const r = await resolveGrantThread('ws', { thread_id: 't1', thread_slug: 'old-name' });
    expect(r).toEqual({ ok: true, thread: T('t1', 'renamed'), via: 'id' });
  });

  it('an id from ANOTHER workspace does not resolve (the query is scoped)', async () => {
    respond = (op) => {
      if (op.table !== 'thread_thread') return { data: null, error: null };
      // Only answers when asked for workspace "other".
      return filteredBy(op, 'workspace_id') === 'other' ? { data: T('t1', 'x'), error: null } : { data: null, error: null };
    };
    expect(await resolveGrantThread('ws', { thread_id: 't1' })).toEqual({ ok: false, reason: 'not_found' });
  });

  it('a slug — or the URL organisers paste — that matches exactly one thread', async () => {
    respond = (op) => (op.table === 'thread_thread' ? { data: [T('t2', 'year-agenda')], error: null } : { data: [], error: null });
    const r = await resolveGrantThread('ws', { thread_slug: 'https://app.thethread.app/soul/year-agenda' });
    expect(r).toMatchObject({ ok: true, via: 'slug', thread: { id: 't2' } });
  });

  it('two threads answer to the slug: AMBIGUOUS, never a pick', async () => {
    respond = (op) => (op.table === 'thread_thread' ? { data: [T('a', 'intro'), T('b', 'intro')], error: null } : { data: [], error: null });
    expect(await resolveGrantThread('ws', { thread_slug: 'intro' })).toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('a renamed thread is found through its slug history', async () => {
    respond = (op) => {
      if (op.table === 'thread_slug_history') return { data: [{ thread_id: 't3' }], error: null };
      if (op.table === 'thread_thread' && filteredBy(op, 'id') === 't3') return { data: T('t3', 'new-name'), error: null };
      return { data: [], error: null };
    };
    expect(await resolveGrantThread('ws', { thread_slug: 'old-name' })).toMatchObject({ ok: true, via: 'history', thread: { slug: 'new-name' } });
  });

  it('a slug two different threads have worn: ambiguous', async () => {
    respond = (op) =>
      op.table === 'thread_slug_history'
        ? { data: [{ thread_id: 'x' }, { thread_id: 'y' }], error: null }
        : { data: [], error: null };
    expect(await resolveGrantThread('ws', { thread_slug: 'old-name' })).toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('nothing at all: not found; no thread named: no_thread', async () => {
    respond = () => ({ data: [], error: null });
    expect(await resolveGrantThread('ws', { thread_slug: 'gone' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await resolveGrantThread('ws', {})).toEqual({ ok: false, reason: 'no_thread' });
  });

  it('a failed read THROWS — it is not "no such thread" (the worker retries)', async () => {
    respond = () => ({ data: null, error: { message: 'pooler went away' } });
    await expect(resolveGrantThread('ws', { thread_slug: 'x' })).rejects.toThrow(/grant thread/);
  });
});
