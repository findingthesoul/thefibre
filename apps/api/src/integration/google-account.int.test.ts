// A member's Google Workspace address (Sjoerd, 2026-10-16). Against staging,
// real tables, a throwaway workspace; GOOGLE IS FAKED at fetch — only calls to
// *.googleapis.com are answered here and recorded, everything else (Supabase)
// passes through. Email is captured, never sent.
//
// What it pins:
//   · before any account is made, a member signed up as x@gmail.com WAITS
//     (pending, with the reason) — and Google is not called for them; until
//     2026-10-16 the worker tried their personal address and stamped `error`;
//   · the suggestion is firstname.lastname@<domain>, steps past an address
//     Google says exists, and two simultaneous first reads store ONE row;
//   · accepting emails the workspace admins ONCE per quiet window;
//   · a DECLINE re-queues nothing; a re-ask keeps the earlier decline reason;
//   · "mark as created" re-queues the grant, and the next tick UNSUSPENDS the
//     created address — not the personal one;
//   · a member whose OWN email is on the domain (mixed case too) HAS the
//     account: 'created' at that address with own_address, no suggestion
//     stored, no request, no admin email; the admin list shows them created,
//     never as one to make — even over a suggestion stored before (Sjoerd,
//     2026-10-17, his own @soul.com card on production);
//   · the Fibre NEVER writes to Google except that unsuspend/suspend PUT: no
//     POST, PATCH or DELETE to the Directory, ever, and the suggestion path is
//     reads only.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

const mails: { to: string; subject: string }[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string }) => {
    mails.push({ to: m.to, subject: m.subject });
  }),
}));

// THE FAKE GOOGLE. Users that "exist" in the domain answer 200 to a GET.
const DOMAIN = `fix-${randomUUID().slice(0, 6)}.example`;
const existing = new Set<string>([`ann.lee@${DOMAIN}`]);
const googleCalls: { method: string; url: string; body: string | null }[] = [];
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!/googleapis\.com/.test(url)) return realFetch(input as RequestInfo, init);
  const method = (init?.method ?? 'GET').toUpperCase();
  googleCalls.push({ method, url, body: typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : null });
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({ access_token: 'fake-token' }), { status: 200 });
  }
  const m = url.match(/\/users\/([^?]+)/);
  const who = m ? decodeURIComponent(m[1]!) : '';
  if (method === 'GET') return new Response(existing.has(who) ? '{}' : 'not found', { status: existing.has(who) ? 200 : 404 });
  if (method === 'PUT') return new Response('{}', { status: 200 });
  return new Response('unexpected', { status: 500 });
});
const directoryCalls = () => googleCalls.filter((c) => c.url.includes('admin.googleapis.com'));

let app: Hono;
let ws = '';
let member: FixtureUser;
let admin: FixtureUser;
let memberId = '';
let personId = '';
let accessRowId = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const portal = (method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/membership/portal${path}`, {
    method,
    headers: { Authorization: `Bearer ${member.accessToken}`, 'X-App-ID': 'membership', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const adminCall = (method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/membership${path}`, {
    method,
    headers: { Authorization: `Bearer ${admin.accessToken}`, 'X-App-ID': 'membership', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const journal = async () =>
  (await service.from('membership_member_access').select('status, last_error, external_ref').eq('id', accessRowId).single()).data!;
const sync = async () => (await import('../lib/google-admin.js')).runGoogleUserSync({ workspaceIds: [ws] });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { membershipPortalRoutes } = await import('../routes/membership-portal.js');
  const { membershipRoutes } = await import('../routes/membership.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/membership', membershipRoutes);
  v1.route('/membership/portal', membershipPortalRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('google-account');
  member = await createFixtureUser(ws, 'gacc-member');
  admin = await createFixtureUser(ws, 'gacc-admin');
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'sa@fix.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  await service.from('membership_settings').upsert({ workspace_id: ws, google_sa_json: sa, google_admin_email: `admin@${DOMAIN}` }, { onConflict: 'workspace_id' });

  // Ann Lee, signed up with her personal address (the fixture's), not one in the domain.
  personId = await insert('person', { workspace_id: ws, first_name: 'Ann', last_name: 'Lée', email: member.email });
  const tier = await insert('membership_tier', { workspace_id: ws, name: 'With Google' });
  const grant = await insert('membership_access_grant', { workspace_id: ws, tier_id: tier, kind: 'google_user', config: {} });
  memberId = await insert('membership_member', { workspace_id: ws, person_id: personId, tier_id: tier, status: 'active', renews_at: '2099-01-01T00:00:00Z' });
  accessRowId = await insert('membership_member_access', { member_id: memberId, access_grant_id: grant, status: 'pending' });
}, 180_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  if (ws) {
    await service.from('membership_google_account').delete().eq('workspace_id', ws);
    await service.from('membership_settings').delete().eq('workspace_id', ws);
  }
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  if (admin) {
    await service.from('workspace_member').delete().eq('user_id', admin.userId);
    await deleteFixtureUser(admin);
  }
  if (member) await deleteFixtureUser(member);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('before any account is made', () => {
  it('the worker WAITS (pending, with the reason) and does not call Google for her', async () => {
    googleCalls.length = 0;
    await sync();
    expect(await journal()).toMatchObject({ status: 'pending', last_error: 'waiting for the Google account to be created' });
    expect(directoryCalls()).toEqual([]);
  });
});

describe('the suggestion', () => {
  it('is firstname.lastname@domain, past an address Google says exists; two first reads store ONE row', async () => {
    googleCalls.length = 0;
    const [a, b] = await Promise.all([portal('GET', `/me/google?member_id=${memberId}`), portal('GET', `/me/google?member_id=${memberId}`)]);
    expect(a.status, await a.clone().text()).toBe(200);
    const ja = (await a.json()) as { applies: boolean; status: string; suggested_address: string; domain: string; own_address: boolean };
    const jb = (await b.json()) as { suggested_address: string };
    // Her own address is on another domain: a suggestion, as before.
    expect(ja).toMatchObject({ applies: true, status: 'suggested', domain: DOMAIN, own_address: false });
    // ann.lee is taken in Google; the accent in "Lée" is stripped.
    expect(ja.suggested_address).toBe(`ann.lee.2@${DOMAIN}`);
    expect(jb.suggested_address).toBe(ja.suggested_address);
    const { data: rows } = await service.from('membership_google_account').select('id').eq('member_id', memberId);
    expect(rows).toHaveLength(1);
    // Reads only.
    expect(directoryCalls().length).toBeGreaterThan(0);
    expect(directoryCalls().every((c) => c.method === 'GET')).toBe(true);
  });
});

describe('asking', () => {
  it('accepting emails the admins once; a quick second ask sends no second email', async () => {
    mails.length = 0;
    const r = await portal('POST', '/me/google', { member_id: memberId, action: 'accept' });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await r.json()) as { status: string; requested_address: string })).toMatchObject({ status: 'requested', requested_address: `ann.lee.2@${DOMAIN}` });
    expect(mails.filter((m) => m.to === admin.email)).toHaveLength(1);
    const again = await portal('POST', '/me/google', { member_id: memberId, action: 'ask', local_part: 'ann', note: 'shorter please' });
    expect(again.status, await again.clone().text()).toBe(200);
    expect(((await again.json()) as { requested_address: string }).requested_address).toBe(`ann@${DOMAIN}`);
    expect(mails.filter((m) => m.to === admin.email)).toHaveLength(1);
  });

  it('a bad local part is refused', async () => {
    const r = await portal('POST', '/me/google', { member_id: memberId, action: 'ask', local_part: 'Ann Lee!' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe('bad_local_part');
  });
});

describe('the admin', () => {
  let id = '';
  it('sees the request in the list', async () => {
    const r = await adminCall('GET', '/google-accounts');
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await r.json()) as { items: { id: string; requested_address: string; person_name: string; note: string }[]; domain: string };
    const it = j.items.find((i) => i.requested_address === `ann@${DOMAIN}`);
    expect(it).toMatchObject({ person_name: 'Ann Lée', note: 'shorter please' });
    expect(j.domain).toBe(DOMAIN);
    id = it!.id;
  });

  it('a DECLINE re-queues nothing; a re-ask keeps the earlier reason', async () => {
    await service.from('membership_member_access').update({ status: 'error', last_error: 'marker' }).eq('id', accessRowId);
    const r = await adminCall('POST', `/google-accounts/${id}/decline`, { reason: 'we use first names only' });
    expect(r.status).toBe(200);
    expect(await journal()).toMatchObject({ status: 'error', last_error: 'marker' });
    const again = await portal('POST', '/me/google', { member_id: memberId, action: 'ask', local_part: 'ann.l' });
    const j = (await again.json()) as { status: string; decline_reason: string };
    expect(j).toMatchObject({ status: 'requested', decline_reason: 'we use first names only' });
  });

  it('an address outside the domain is refused', async () => {
    expect((await adminCall('POST', `/google-accounts/${id}/created`, { address: 'ann@gmail.com' })).status).toBe(400);
  });

  it('"mark as created" re-queues; the next tick UNSUSPENDS the created address, not the personal one', async () => {
    const r = await adminCall('POST', `/google-accounts/${id}/created`, { address: `ann.l@${DOMAIN}` });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await journal()).toMatchObject({ status: 'pending', last_error: null });
    googleCalls.length = 0;
    await sync();
    expect(await journal()).toMatchObject({ status: 'granted', external_ref: `ann.l@${DOMAIN}` });
    const puts = directoryCalls().filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.url).toContain(encodeURIComponent(`ann.l@${DOMAIN}`));
    expect(JSON.parse(puts[0]!.body!)).toEqual({ suspended: false });
    expect(directoryCalls().some((c) => c.url.includes(encodeURIComponent(member.email)))).toBe(false);
  });

  it('the member sees it created; asking again is refused', async () => {
    const g = (await (await portal('GET', `/me/google?member_id=${memberId}`)).json()) as { status: string; created_address: string; decline_reason: string | null };
    expect(g).toMatchObject({ status: 'created', created_address: `ann.l@${DOMAIN}`, decline_reason: null });
    const r = await portal('POST', '/me/google', { member_id: memberId, action: 'accept' });
    expect(r.status).toBe(409);
  });
});

describe('the Fibre never writes to Google beyond (un)suspend', () => {
  it('no POST, PATCH or DELETE ever reached the Directory, and every PUT only set `suspended`', () => {
    const all = directoryCalls();
    expect(all.some((c) => ['POST', 'PATCH', 'DELETE'].includes(c.method))).toBe(false);
    for (const c of all.filter((x) => x.method === 'PUT')) expect(Object.keys(JSON.parse(c.body!))).toEqual(['suspended']);
  });
});

describe('a member whose personal address IS in the domain (the case that already worked)', () => {
  it('is managed at that address with no request at all', async () => {
    const { managedAddress } = await import('../lib/google-admin.js');
    expect(managedAddress(null, `bob@${DOMAIN}`, DOMAIN)).toBe(`bob@${DOMAIN}`);
    expect(managedAddress(null, 'bob@gmail.com', DOMAIN)).toBeNull();
    expect(managedAddress({ status: 'declined', created_address: null }, 'bob@gmail.com', DOMAIN)).toBeNull();
    expect(managedAddress({ status: 'created', created_address: `b@${DOMAIN}` }, `bob@${DOMAIN}`, DOMAIN)).toBe(`b@${DOMAIN}`);
  });
});

describe('a member whose OWN email is on the community domain (Sjoerd, 2026-10-17)', () => {
  // A second community whose Google domain IS the fixtures' (example.com),
  // so the member signs in with an address on it. The person row holds it in
  // mixed case, as a signup form might.
  let ws2 = '';
  let own: FixtureUser | undefined;
  let admin2: FixtureUser | undefined;
  let ownMemberId = '';
  let ownPersonId = '';
  const made2: { table: string; id: string }[] = [];
  const ins = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await service.from(table).insert(row).select('id').single();
    if (error) throw new Error(`fixture ${table}: ${error.message}`);
    made2.unshift({ table, id: data!.id as string });
    return data!.id as string;
  };
  const as = (u: FixtureUser, path: string, method = 'GET', body?: unknown) =>
    app.request(`/api/v1/membership${path}`, {
      method,
      headers: { Authorization: `Bearer ${u.accessToken}`, 'X-App-ID': 'membership', 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  beforeAll(async () => {
    ws2 = await createThrowawayWorkspace('google-own');
    own = await createFixtureUser(ws2, 'gacc-own');
    admin2 = await createFixtureUser(ws2, 'gacc-own-admin');
    await service.from('workspace_member').insert({ workspace_id: ws2, user_id: admin2.userId, workspace_role: 'admin' });
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = JSON.stringify({ client_email: 'sa@fix.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    // The admin's domain in capitals: matching is case-insensitive both ways.
    await service.from('membership_settings').upsert({ workspace_id: ws2, google_sa_json: sa, google_admin_email: 'admin@EXAMPLE.com' }, { onConflict: 'workspace_id' });
    const [local] = own.email.split('@');
    ownPersonId = await ins('person', { workspace_id: ws2, first_name: 'Sam', last_name: 'Own', email: `${local!.toUpperCase()}@Example.COM` });
    const tier = await ins('membership_tier', { workspace_id: ws2, name: 'With Google' });
    const grant = await ins('membership_access_grant', { workspace_id: ws2, tier_id: tier, kind: 'google_user', config: {} });
    ownMemberId = await ins('membership_member', { workspace_id: ws2, person_id: ownPersonId, tier_id: tier, status: 'active', renews_at: '2099-01-01T00:00:00Z' });
    await ins('membership_member_access', { member_id: ownMemberId, access_grant_id: grant, status: 'pending' });
  }, 180_000);

  afterAll(async () => {
    if (ws2) {
      await service.from('membership_google_account').delete().eq('workspace_id', ws2);
      await service.from('membership_settings').delete().eq('workspace_id', ws2);
    }
    for (const { table, id } of made2) await service.from(table).delete().eq('id', id);
    if (admin2) {
      await service.from('workspace_member').delete().eq('user_id', admin2.userId);
      await deleteFixtureUser(admin2);
    }
    if (own) await deleteFixtureUser(own);
    if (ws2) await deleteThrowawayWorkspace(ws2);
  }, 180_000);

  it('the card says their account is their own address; nothing is stored, Google is not asked', async () => {
    googleCalls.length = 0;
    const r = await as(own!, `/portal/me/google?member_id=${ownMemberId}`);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toMatchObject({
      applies: true,
      domain: 'example.com',
      status: 'created',
      created_address: own!.email.toLowerCase(),
      suggested_address: null,
      own_address: true,
    });
    const { data: rows } = await service.from('membership_google_account').select('id').eq('member_id', ownMemberId);
    expect(rows).toEqual([]);
    expect(directoryCalls()).toEqual([]);
  });

  it('asking is refused, and no admin is emailed', async () => {
    mails.length = 0;
    const r = await as(own!, '/portal/me/google', 'POST', { member_id: ownMemberId, action: 'accept' });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe('already_created');
    expect(mails).toEqual([]);
  });

  it('over a suggestion stored before, the card and the admin list still say created', async () => {
    // Production had stored one for Sjoerd before this rule existed.
    const { error } = await service.from('membership_google_account').insert({
      workspace_id: ws2, member_id: ownMemberId, person_id: ownPersonId, status: 'suggested', suggested_address: 'sam.own@example.com',
    });
    expect(error).toBeNull();
    const card = await (await as(own!, `/portal/me/google?member_id=${ownMemberId}`)).json();
    expect(card).toMatchObject({ status: 'created', created_address: own!.email.toLowerCase(), own_address: true });

    const rowsIn = async (q: string) => {
      const r = await as(admin2!, `/google-accounts${q}`);
      expect(r.status, await r.clone().text()).toBe(200);
      return ((await r.json()) as { items: { member_id: string; status: string; created_address: string; own_address: boolean }[] }).items.filter((i) => i.member_id === ownMemberId);
    };
    expect(await rowsIn('')).toEqual([]);
    expect(await rowsIn('?status=suggested')).toEqual([]);
    const created = await rowsIn('?status=created');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ status: 'created', created_address: own!.email.toLowerCase(), own_address: true });
    // Derived, never written: the stored row is untouched.
    const { data: row } = await service.from('membership_google_account').select('status, created_address').eq('member_id', ownMemberId).single();
    expect(row).toEqual({ status: 'suggested', created_address: null });
  });
});
