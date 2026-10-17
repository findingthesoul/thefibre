// Downloading from a connected Drive folder (Drive folders, slice 3,
// 2026-10-17). Against staging's database, the real routes; Google is FAKED
// at fetch. In the PERMANENT fixture workspace, because a download writes an
// append-only activity row, which pins a workspace for good; what the test
// adds there is removed or soft-deleted afterwards.
//
// Pinned:
//   · POST …/download: a file under the root → an API URL (never Drive's) and
//     a filename; a Doc → ".pdf" and export_as pdf; a file OUTSIDE the root
//     (another community's) → 404; a folder → 404; a form → not_exportable;
//   · GET drive-download?token: streams the bytes with attachment +
//     nosniff + no-store; a Doc arrives as its PDF export; Google's export
//     limit → 413 in words;
//   · the token is the only key, and carries ids only (no '@', no email —
//     it rides in a URL): a forged one → 404; one held by a member who has
//     since LAPSED → 404;
//   · each download is ONE activity row, type drive_file_downloaded, subject
//     ids only — never the file's name.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

type F = { id: string; name: string; mimeType: string; parents?: string[]; description?: string; size?: string };
const FOLDER = 'application/vnd.google-apps.folder';
const tag = randomUUID().replace(/-/g, '').slice(0, 10);
const ROOT = `dlRoot${tag}`;
const PDF = `dlPdf${tag}x`;
const DOC = `dlDoc${tag}x`;
const BIGDOC = `dlBig${tag}x`;
const FORM = `dlForm${tag}x`;
const SUB = `dlSub${tag}x`;
const OUTSIDE = `dlOut${tag}x`;
const files = new Map<string, F>([
  [ROOT, { id: ROOT, name: 'Repository', mimeType: FOLDER, parents: ['driveRoot0000'] }],
  [PDF, { id: PDF, name: 'Statutes.pdf', mimeType: 'application/pdf', size: '9', parents: [ROOT] }],
  [DOC, { id: DOC, name: 'Guide', mimeType: 'application/vnd.google-apps.document', parents: [ROOT] }],
  [BIGDOC, { id: BIGDOC, name: 'Huge', mimeType: 'application/vnd.google-apps.document', parents: [ROOT] }],
  [FORM, { id: FORM, name: 'Survey', mimeType: 'application/vnd.google-apps.form', parents: [ROOT] }],
  [SUB, { id: SUB, name: 'Minutes', mimeType: FOLDER, parents: [ROOT] }],
  [OUTSIDE, { id: OUTSIDE, name: 'secret.pdf', mimeType: 'application/pdf', size: '5', parents: ['someoneElse00'] }],
]);
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!/googleapis\.com/.test(url)) return realFetch(input as RequestInfo, init);
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'fake' }), { status: 200 });
  const u = new URL(url);
  const exp = u.pathname.match(/\/drive\/v3\/files\/([^/]+)\/export$/);
  if (exp) {
    if (decodeURIComponent(exp[1]!) === BIGDOC) return new Response('{"error":{"errors":[{"reason":"exportSizeLimitExceeded"}]}}', { status: 403 });
    return new Response('%PDF-fake-export', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
  }
  const one = u.pathname.match(/\/drive\/v3\/files\/([^/]+)$/);
  if (one) {
    const f = files.get(decodeURIComponent(one[1]!));
    if (!f) return new Response('{}', { status: 404 });
    if (u.searchParams.get('alt') === 'media') return new Response('PDF-BYTES', { status: 200, headers: { 'Content-Length': '9' } });
    return new Response(JSON.stringify(f), { status: 200 });
  }
  return new Response('unexpected', { status: 500 });
});

let app: Hono;
let ws = '';
let admin: FixtureUser;
let member: FixtureUser;
let memberRowId = '';
let personId = '';
let entry = '';

const call = (u: FixtureUser | null, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1${path}`, {
    method,
    headers: { ...(u ? { Authorization: `Bearer ${u.accessToken}` } : {}), 'X-App-ID': 'membership', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const download = async (fileId: string) => call(member, 'POST', `/me/portal/community/${ws}/drive/${entry}/download`, { file_id: fileId });
const streamPath = (url: string) => new URL(url).pathname + new URL(url).search;
const activityRows = async () =>
  ((await service.from('activity').select('type, subject').eq('person_id', personId).eq('type', 'drive_file_downloaded')).data ?? []) as { type: string; subject: string }[];

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GOOGLE_DRIVE_SA_JSON = Buffer.from(JSON.stringify({ client_email: 'dl@int.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })).toString('base64');
  process.env.SSO_INTERNAL_SECRET ??= 'int-drive-secret';
  // The stream URL is this API's origin FROM THE REQUEST (publicOrigin), so
  // the test pins it through API_PUBLIC_URL, which publicOrigin honours.
  process.env.API_PUBLIC_URL = 'https://api.int.example';
  const { appContext } = await import('../middleware/app-context.js');
  const { membershipRoutes } = await import('../routes/membership.js');
  const { portalRoutes } = await import('../routes/portal.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('/membership/*', appContext);
  v1.route('/membership', membershipRoutes);
  // As in server.ts: /me/* is exempt from the app context (the stream URL is
  // reached by a browser redirect, with no X-App-ID and no session).
  v1.route('/me', portalRoutes);
  app.route('/api/v1', v1);

  ws = await getPermanentFixtureWorkspace('int-drive-fixtures');
  admin = await createFixtureUser(ws, 'dl-admin');
  member = await createFixtureUser(ws, 'dl-member');
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  personId = (await service.from('person').insert({ workspace_id: ws, first_name: 'D', last_name: 'L', email: member.email }).select('id').single()).data!.id as string;
  const tier = (await service.from('membership_tier').insert({ workspace_id: ws, name: `DL ${tag}` }).select('id').single()).data!.id as string;
  memberRowId = (await service.from('membership_member').insert({ workspace_id: ws, person_id: personId, tier_id: tier, status: 'active', renews_at: '2099-01-01T00:00:00Z' }).select('id').single()).data!.id as string;

  const s = (await (await call(admin, 'POST', '/membership/member-page/drive/start', { folder_url: `https://drive.google.com/drive/folders/${ROOT}` })).json()) as { code: string };
  files.get(ROOT)!.description = s.code;
  const v = await call(admin, 'POST', '/membership/member-page/drive/verify', { folder_id: ROOT });
  expect(v.status, await v.clone().text()).toBe(201);
  entry = ((await v.json()) as { id: string }).id;
}, 180_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  if (entry) await call(admin, 'DELETE', `/membership/member-page/documents/${entry}`);
  expect((await service.from('membership_drive_binding').select('drive_folder_id').eq('drive_folder_id', ROOT)).data).toEqual([]);
  if (memberRowId) await service.from('membership_member').delete().eq('id', memberRowId);
  await service.from('membership_tier').delete().eq('workspace_id', ws).eq('name', `DL ${tag}`);
  // Soft: the download's activity row pins the person (append-only).
  if (personId) await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  if (admin) {
    await service.from('workspace_member').delete().eq('user_id', admin.userId);
    await deleteFixtureUser(admin);
  }
  if (member) await deleteFixtureUser(member);
}, 180_000);

describe('asking for a download', () => {
  it('a file under the root → the API’s own URL and a filename', async () => {
    const r = await download(PDF);
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await r.json()) as { url: string; filename: string; export_as: string | null };
    expect(j.url.startsWith('https://api.int.example/api/v1/me/portal/drive-download?token=')).toBe(true);
    expect(j.url).not.toMatch(/google/);
    // Nothing personal rides in the URL: the token body is ids only.
    const token = new URL(j.url).searchParams.get('token')!;
    const body = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    expect(body).not.toContain('@');
    expect(body).not.toContain(member.email);
    expect(JSON.parse(body)).toMatchObject({ w: ws, d: entry, f: PDF, p: personId });
    expect(j).toMatchObject({ filename: 'Statutes.pdf', export_as: null });
  });

  it('a Doc → a PDF', async () => {
    expect(await (await download(DOC)).json()).toMatchObject({ filename: 'Guide.pdf', export_as: 'pdf' });
  });

  it('a file outside the root, a folder, a form', async () => {
    expect((await download(OUTSIDE)).status).toBe(404);
    expect((await download(SUB)).status).toBe(404);
    const f = await download(FORM);
    expect(f.status).toBe(409);
    expect(((await f.json()) as { code: string }).code).toBe('not_exportable');
    expect((await download("x' or '1")).status).toBe(404);
  });
});

describe('the stream', () => {
  it('streams the bytes, as an attachment, and records one activity row with ids only', async () => {
    const before = (await activityRows()).length;
    const { url } = (await (await download(PDF)).json()) as { url: string };
    const s = await app.request(streamPath(url));
    expect(s.status).toBe(200);
    expect(await s.text()).toBe('PDF-BYTES');
    expect(s.headers.get('content-disposition')).toMatch(/^attachment; filename="Statutes.pdf"/);
    expect(s.headers.get('x-content-type-options')).toBe('nosniff');
    expect(s.headers.get('cache-control')).toBe('private, no-store');
    const rows = await activityRows();
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)!.subject).toBe(`${ROOT}/${PDF}`);
    expect(rows.every((r) => !r.subject.includes('Statutes'))).toBe(true);
  });

  it('a Doc arrives as its PDF export; past Google’s export limit → 413 in words', async () => {
    const { url } = (await (await download(DOC)).json()) as { url: string };
    const s = await app.request(streamPath(url));
    expect(s.headers.get('content-type')).toBe('application/pdf');
    expect(await s.text()).toBe('%PDF-fake-export');
    const big = (await (await download(BIGDOC)).json()) as { url: string };
    const b = await app.request(streamPath(big.url));
    expect(b.status).toBe(413);
    expect(await b.text()).toMatch(/too large/);
  });

  it('a forged token → 404; a token held by a member who has since lapsed → 404', async () => {
    expect((await app.request('/api/v1/me/portal/drive-download?token=forged.token')).status).toBe(404);
    const { url } = (await (await download(PDF)).json()) as { url: string };
    await service.from('membership_member').update({ status: 'cancelled' }).eq('id', memberRowId);
    const s = await app.request(streamPath(url));
    expect(s.status).toBe(404);
    await service.from('membership_member').update({ status: 'active' }).eq('id', memberRowId);
  });
});
