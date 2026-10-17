// A Google Drive folder inside my.thread (Drive folders, slice 2,
// 2026-10-17). Against staging's database, the real routes; GOOGLE IS FAKED at
// fetch — only *.googleapis.com is answered here, everything else passes.
//
// Pinned:
//   · config names the stack's service account;
//   · start: a non-folder link → bad_url; a folder the account cannot see →
//     not_shared, naming the account; a shared folder → a one-time code;
//   · verify: without the code in the description → code_missing; with it →
//     the binding row and the member-page entry;
//   · ANOTHER community starting or verifying the same folder →
//     bound_elsewhere, even holding a valid code of its own;
//   · a member lists the folder (folders first, breadcrumbs, limits) and a
//     subfolder; a member of community B passing A's folder id under B's
//     own entry → 404 (the parents walk stops at B's bound root); a
//     non-member and a member outside the audience → 404; the folder
//     unshared → not_shared;
//   · removing the entry drops the binding.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

// THE FAKE DRIVE.
type F = { id: string; name: string; mimeType: string; parents?: string[]; description?: string; size?: string };
const FOLDER = 'application/vnd.google-apps.folder';
const tag = randomUUID().replace(/-/g, '').slice(0, 10);
const ROOT_A = `rootA${tag}`;
const SUB_A = `subA${tag}xx`;
const ROOT_B = `rootB${tag}`;
const UNSEEN = `unseen${tag}`;
const files = new Map<string, F>([
  [ROOT_A, { id: ROOT_A, name: 'Repository', mimeType: FOLDER, parents: ['driveRoot0000'] }],
  [SUB_A, { id: SUB_A, name: 'Minutes', mimeType: FOLDER, parents: [ROOT_A] }],
  [`docA${tag}x`, { id: `docA${tag}x`, name: 'Guide', mimeType: 'application/vnd.google-apps.document', parents: [ROOT_A] }],
  [`pdfA${tag}x`, { id: `pdfA${tag}x`, name: 'a.pdf', mimeType: 'application/pdf', size: '2048', parents: [ROOT_A] }],
  [`imgA${tag}x`, { id: `imgA${tag}x`, name: 'photo.jpg', mimeType: 'image/jpeg', size: '100', parents: [SUB_A] }],
  [ROOT_B, { id: ROOT_B, name: 'B stuff', mimeType: FOLDER, parents: ['driveRoot0000'] }],
]);
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!/googleapis\.com/.test(url)) return realFetch(input as RequestInfo, init);
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'fake' }), { status: 200 });
  const u = new URL(url);
  const one = u.pathname.match(/\/drive\/v3\/files\/([^/]+)$/);
  if (one) {
    const f = files.get(decodeURIComponent(one[1]!));
    return f ? new Response(JSON.stringify(f), { status: 200 }) : new Response('{}', { status: 404 });
  }
  if (u.pathname.endsWith('/drive/v3/files')) {
    const parent = (u.searchParams.get('q') ?? '').match(/^'([^']+)' in parents/)?.[1];
    return new Response(JSON.stringify({ files: [...files.values()].filter((f) => f.parents?.includes(parent ?? '')) }), { status: 200 });
  }
  return new Response('unexpected', { status: 500 });
});

let app: Hono;
let wsA = '';
let wsB = '';
let adminA: FixtureUser;
let adminB: FixtureUser;
let memberA: FixtureUser;
let memberB: FixtureUser;
let outsider: FixtureUser;
let entryA = '';
let entryB = '';
const SA = 'fibre-drive-reader@int.iam.gserviceaccount.com';

const call = (u: FixtureUser, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${u.accessToken}`, 'X-App-ID': 'membership', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

async function seatMember(ws: string, u: FixtureUser, tierName: string) {
  const person = (await service.from('person').insert({ workspace_id: ws, first_name: 'M', last_name: tierName, email: u.email }).select('id').single()).data!.id as string;
  const tier = (await service.from('membership_tier').insert({ workspace_id: ws, name: tierName }).select('id').single()).data!.id as string;
  await service.from('membership_member').insert({ workspace_id: ws, person_id: person, tier_id: tier, status: 'active', renews_at: '2099-01-01T00:00:00Z' });
  return tier;
}

async function connect(adminU: FixtureUser, ws: string, root: string): Promise<string> {
  const s = await json(await call(adminU, 'POST', '/membership/member-page/drive/start', { folder_url: `https://drive.google.com/drive/folders/${root}` }));
  files.get(root)!.description = `Our shared files. ${s.code}`;
  const v = await call(adminU, 'POST', '/membership/member-page/drive/verify', { folder_id: root });
  expect(v.status, await v.clone().text()).toBe(201);
  return (await json(v)).id as string;
}

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GOOGLE_DRIVE_SA_JSON = Buffer.from(JSON.stringify({ client_email: SA, private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })).toString('base64');
  process.env.SSO_INTERNAL_SECRET ??= 'int-drive-secret';
  const { appContext } = await import('../middleware/app-context.js');
  const { membershipRoutes } = await import('../routes/membership.js');
  const { portalRoutes } = await import('../routes/portal.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/membership', membershipRoutes);
  v1.route('/me', portalRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('drive-a');
  wsB = await createThrowawayWorkspace('drive-b');
  adminA = await createFixtureUser(wsA, 'drive-admin-a');
  adminB = await createFixtureUser(wsB, 'drive-admin-b');
  await service.from('workspace_member').insert([
    { workspace_id: wsA, user_id: adminA.userId, workspace_role: 'admin' },
    { workspace_id: wsB, user_id: adminB.userId, workspace_role: 'admin' },
  ]);
  memberA = await createFixtureUser(wsA, 'drive-member-a');
  memberB = await createFixtureUser(wsB, 'drive-member-b');
  outsider = await createFixtureUser(wsA, 'drive-outsider');
  await seatMember(wsA, memberA, 'Core');
  await seatMember(wsB, memberB, 'Core');
}, 180_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const u of [adminA, adminB, memberA, memberB, outsider]) {
    if (!u) continue;
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (wsA) expect(await deleteThrowawayWorkspace(wsA)).toBe(true);
  if (wsB) expect(await deleteThrowawayWorkspace(wsB)).toBe(true);
}, 180_000);

describe('connecting a folder', () => {
  it('config names the service account', async () => {
    expect(await json(await call(adminA, 'GET', '/membership/member-page/drive/config'))).toEqual({ service_account: SA });
  });

  it('start: a non-folder link, an unseen folder, then a shared one', async () => {
    const bad = await call(adminA, 'POST', '/membership/member-page/drive/start', { folder_url: 'https://drive.google.com/file/d/abcdefghijk/view' });
    expect(bad.status).toBe(400);
    expect((await json(bad)).code).toBe('bad_url');
    const unseen = await call(adminA, 'POST', '/membership/member-page/drive/start', { folder_url: `https://drive.google.com/drive/folders/${UNSEEN}` });
    expect(unseen.status).toBe(409);
    expect(await json(unseen)).toMatchObject({ code: 'not_shared', service_account: SA });
    const ok = await call(adminA, 'POST', '/membership/member-page/drive/start', { folder_url: `https://drive.google.com/drive/folders/${ROOT_A}?usp=sharing` });
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect(await json(ok)).toMatchObject({ folder_id: ROOT_A, folder_name: 'Repository', service_account: SA });
  });

  it('verify without the code → code_missing; with it → binding + entry', async () => {
    files.get(ROOT_A)!.description = 'no code here';
    const missing = await call(adminA, 'POST', '/membership/member-page/drive/verify', { folder_id: ROOT_A });
    expect(missing.status).toBe(409);
    expect((await json(missing)).code).toBe('code_missing');
    entryA = await connect(adminA, wsA, ROOT_A);
    const { data } = await service.from('membership_drive_binding').select('workspace_id, verified_by').eq('drive_folder_id', ROOT_A).single();
    expect(data).toEqual({ workspace_id: wsA, verified_by: adminA.userId });
  });

  it('another community cannot start or verify the same folder, even with its own valid code', async () => {
    const s = await call(adminB, 'POST', '/membership/member-page/drive/start', { folder_url: `https://drive.google.com/drive/folders/${ROOT_A}` });
    expect(s.status).toBe(409);
    expect((await json(s)).code).toBe('bound_elsewhere');
    const { issueCode } = await import('../lib/drive.js');
    files.get(ROOT_A)!.description = issueCode(wsB, ROOT_A).code;
    const v = await call(adminB, 'POST', '/membership/member-page/drive/verify', { folder_id: ROOT_A });
    expect(v.status).toBe(409);
    expect((await json(v)).code).toBe('bound_elsewhere');
  });
});

describe('a member browses it', () => {
  it('lists the root: folders first, breadcrumbs, limits', async () => {
    const r = await call(memberA, 'GET', `/me/portal/community/${wsA}/drive/${entryA}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await json(r)) as { folder: { id: string }; breadcrumbs: { id: string }[]; items: { name: string; kind: string; export_as: string | null }[]; limits: { max_download_bytes: number } };
    expect(j.folder.id).toBe(ROOT_A);
    expect(j.breadcrumbs.map((b) => b.id)).toEqual([ROOT_A]);
    expect(j.items.map((i) => i.name)).toEqual(['Minutes', 'a.pdf', 'Guide']);
    expect(j.items.find((i) => i.name === 'Guide')?.export_as).toBe('pdf');
    expect(j.limits.max_download_bytes).toBe(250 * 1024 * 1024);
  });

  it('opens a subfolder, with the trail to it', async () => {
    const r = await call(memberA, 'GET', `/me/portal/community/${wsA}/drive/${entryA}?folder=${SUB_A}`);
    const j = (await json(r)) as { breadcrumbs: { id: string; name: string }[]; items: { name: string }[] };
    expect(j.breadcrumbs.map((b) => b.name)).toEqual(['Repository', 'Minutes']);
    expect(j.items.map((i) => i.name)).toEqual(['photo.jpg']);
  });

  it('a member of B cannot reach A’s folder through B’s own entry (the parents walk stops at B’s root)', async () => {
    entryB = await connect(adminB, wsB, ROOT_B);
    expect((await call(memberB, 'GET', `/me/portal/community/${wsB}/drive/${entryB}`)).status).toBe(200);
    const r = await call(memberB, 'GET', `/me/portal/community/${wsB}/drive/${entryB}?folder=${ROOT_A}`);
    expect(r.status).toBe(404);
    expect((await call(memberB, 'GET', `/me/portal/community/${wsB}/drive/${entryB}?folder=${SUB_A}`)).status).toBe(404);
    // Nor through A's entry, not being A's member.
    expect((await call(memberB, 'GET', `/me/portal/community/${wsA}/drive/${entryA}`)).status).toBe(404);
  });

  it('a non-member, and a member outside the audience, get 404', async () => {
    expect((await call(outsider, 'GET', `/me/portal/community/${wsA}/drive/${entryA}`)).status).toBe(404);
    const other = (await service.from('membership_tier').insert({ workspace_id: wsA, name: 'Other' }).select('id').single()).data!.id as string;
    expect((await call(adminA, 'PUT', `/membership/member-page/documents/${entryA}/audience`, { tier_ids: [other], category_ids: [] })).status).toBe(200);
    expect((await call(memberA, 'GET', `/me/portal/community/${wsA}/drive/${entryA}`)).status).toBe(404);
    expect((await call(adminA, 'PUT', `/membership/member-page/documents/${entryA}/audience`, { tier_ids: [], category_ids: [] })).status).toBe(200);
  });

  it('the folder unshared → not_shared', async () => {
    const { _resetDriveToken } = await import('../lib/drive.js');
    _resetDriveToken();
    const saved = files.get(ROOT_A)!;
    files.delete(ROOT_A);
    const r = await call(memberA, 'GET', `/me/portal/community/${wsA}/drive/${entryA}`);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe('not_shared');
    files.set(ROOT_A, saved);
  });
});

describe('removing it', () => {
  it('drops the binding, so the folder can be connected again', async () => {
    expect((await call(adminA, 'DELETE', `/membership/member-page/documents/${entryA}`)).status).toBe(204);
    expect((await service.from('membership_drive_binding').select('drive_folder_id').eq('drive_folder_id', ROOT_A)).data).toEqual([]);
    expect((await call(memberA, 'GET', `/me/portal/community/${wsA}/drive/${entryA}`)).status).toBe(404);
  });
});
