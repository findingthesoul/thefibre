// The Google grant worker, with no database and no Google: the database is a
// fake that answers per table (the member-notify failclosed pattern) and
// Google is a fake at fetch that records every call.
//
// What it pins (google-account.int.test.ts runs the same story on staging):
//   · a member signed up as x@gmail.com WAITS — pending, with the reason —
//     and Google is never called for them (until 2026-10-16: an error on an
//     address that can never exist in the domain);
//   · once an admin marked an account created, THAT address is unsuspended;
//   · a member whose own address is in the domain works as before;
//   · a failed read of the accounts table stops the tick;
//   · the Fibre never writes to Google beyond PUT { suspended }.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

type Resp = { data: unknown; error: { message: string } | null };
type Op = { table: string; calls: [string, unknown[]][] };

const state = { respond: (_op: Op): Resp => ({ data: [], error: null }), writes: [] as Op[] };

function builder(table: string) {
  const op: Op = { table, calls: [] };
  const b: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          if (op.calls.some(([m]) => ['insert', 'upsert', 'update', 'delete'].includes(m))) state.writes.push(op);
          const r = state.respond(op);
          return (res: (v: Resp) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej);
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

const DOMAIN = 'example.org';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });

const calls: { method: string; url: string; body: string | null }[] = [];
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method ?? 'GET').toUpperCase();
  calls.push({ method, url, body: typeof init?.body === 'string' ? init.body : null });
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 });
  if (method === 'GET') return new Response('{}', { status: url.includes('taken%40') ? 200 : 404 });
  return new Response('{}', { status: 200 });
});

const { runGoogleUserSync, googleUserExists } = await import('./google-admin.js');
const directory = () => calls.filter((c) => c.url.includes('admin.googleapis.com'));

/** One pending google_user row for member m1 (person p1, `email`), and
 *  optionally an account row. */
function db(email: string, account: Record<string, unknown> | null, broken: Partial<Record<string, Resp>> = {}) {
  return (op: Op): Resp => {
    const write = op.calls.find(([m]) => ['insert', 'upsert', 'update'].includes(m))?.[0];
    const key = write ? `${op.table}.${write}` : `${op.table}.select`;
    if (broken[key]) return broken[key]!;
    switch (key) {
      case 'membership_member_access.select':
        return {
          data: [{ id: 'a1', status: 'pending', member_id: 'm1', grant: { id: 'g1', kind: 'google_user', config: {} }, member: { id: 'm1', workspace_id: 'w1', person_id: 'p1' } }],
          error: null,
        };
      case 'membership_settings.select':
        return { data: [{ workspace_id: 'w1', google_sa_json: SA, google_admin_email: `admin@${DOMAIN}` }], error: null };
      case 'person.select':
        return { data: [{ id: 'p1', email }], error: null };
      case 'membership_google_account.select':
        return { data: account ? [{ member_id: 'm1', ...account }] : [], error: null };
      default:
        return { data: null, error: null };
    }
  };
}
const accessUpdates = () =>
  state.writes.filter((w) => w.table === 'membership_member_access').map((w) => w.calls.find(([m]) => m === 'update')?.[1][0] as Record<string, unknown>);

beforeEach(() => {
  state.writes = [];
  calls.length = 0;
});

describe('which address the worker manages', () => {
  it('x@gmail.com with no account made: waits (pending + reason), Google is not called', async () => {
    state.respond = db('ann@gmail.com', null);
    const r = await runGoogleUserSync();
    expect(r).toEqual({ granted: 0, revoked: 0, errors: 0 });
    expect(directory()).toEqual([]);
    expect(accessUpdates()).toEqual([expect.objectContaining({ last_error: 'waiting for the Google account to be created' })]);
    expect(accessUpdates()[0]).not.toHaveProperty('status');
  });

  it('a requested (not created) account still waits', async () => {
    state.respond = db('ann@gmail.com', { status: 'requested', created_address: null });
    await runGoogleUserSync();
    expect(directory()).toEqual([]);
  });

  it('a created account: THAT address is unsuspended and recorded', async () => {
    state.respond = db('ann@gmail.com', { status: 'created', created_address: `ann.lee@${DOMAIN}` });
    const r = await runGoogleUserSync();
    expect(r.granted).toBe(1);
    const puts = directory().filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.url).toContain(encodeURIComponent(`ann.lee@${DOMAIN}`));
    expect(JSON.parse(puts[0]!.body!)).toEqual({ suspended: false });
    expect(accessUpdates()).toEqual([expect.objectContaining({ status: 'granted', external_ref: `ann.lee@${DOMAIN}` })]);
  });

  it('a member whose own address is in the domain: managed there, as before', async () => {
    state.respond = db(`bob@${DOMAIN}`, null);
    await runGoogleUserSync();
    expect(directory().filter((c) => c.method === 'PUT').map((c) => c.url)).toEqual([expect.stringContaining(encodeURIComponent(`bob@${DOMAIN}`))]);
  });

  it('a failed read of the accounts table stops the tick and writes nothing', async () => {
    state.respond = db('ann@gmail.com', null, { 'membership_google_account.select': { data: null, error: { message: 'pooler went away' } } });
    await expect(runGoogleUserSync()).rejects.toThrow(/google accounts/);
    expect(state.writes).toEqual([]);
    expect(directory()).toEqual([]);
  });
});

describe('the Fibre never writes to Google beyond (un)suspend', () => {
  it('the address lookup is a GET', async () => {
    expect(await googleUserExists('t', `taken@${DOMAIN}`)).toBe(true);
    expect(await googleUserExists('t', `free@${DOMAIN}`)).toBe(false);
    expect(directory().every((c) => c.method === 'GET')).toBe(true);
  });

  it('across every case above, no POST/PATCH/DELETE, and a PUT only ever sets `suspended`', async () => {
    for (const [email, account] of [
      ['ann@gmail.com', null],
      ['ann@gmail.com', { status: 'created', created_address: `ann.lee@${DOMAIN}` }],
      [`bob@${DOMAIN}`, null],
    ] as const) {
      state.respond = db(email, account as Record<string, unknown> | null);
      await runGoogleUserSync();
    }
    expect(directory().some((c) => ['POST', 'PATCH', 'DELETE'].includes(c.method))).toBe(false);
    for (const c of directory().filter((x) => x.method === 'PUT')) expect(Object.keys(JSON.parse(c.body!))).toEqual(['suspended']);
  });
});
