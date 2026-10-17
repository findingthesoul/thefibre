// A Google Drive folder inside my.thread (Sjoerd, 2026-10-17: "go Drive
// folders"; plan agreed with the coordinator and builder 3).
//
// ONE SERVICE ACCOUNT PER STACK, read-only (drive.readonly), no domain-wide
// delegation: it sees exactly what an admin has shared with it as Viewer, and
// nothing else in anybody's Drive. Its key is the Fly secret
// GOOGLE_DRIVE_SA_JSON (base64 of the downloaded JSON), set by Sjoerd in his
// own terminal. It is NOT the per-workspace delegation account Google
// addresses use (lib/google-admin.ts).
//
// Because that one account reads EVERY community's shared folders, "the
// service account can see it" proves nothing about whose folder it is. A
// community proves control by putting a one-time code in the folder's
// description; the proof is a row in membership_drive_binding, whose primary
// key makes a folder belong to one workspace. Every read walks a requested
// folder's parents up to the BOUND root, so a member can never list or open a
// folder of another community by passing its id.
//
// Nothing about the files is stored: they live in Drive and, for two minutes,
// in this process's memory, keyed per workspace and bound folder.

import { createHmac, createSign, timingSafeEqual } from 'node:crypto';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** What streams as it is (250 MiB), and Google's own PDF export limit. */
export const DRIVE_LIMITS = { max_download_bytes: 250 * 1024 * 1024, max_export_bytes: 10 * 1024 * 1024 } as const;

/** Google-native types we export as PDF. Every other native type (forms,
 *  sites, maps, shortcuts) is shown and cannot be downloaded. */
export const EXPORTABLE = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
]);

// ---------------------------------------------------------------------------
// Config + token
// ---------------------------------------------------------------------------

type ServiceAccount = { client_email: string; private_key: string };

/** The stack's service account, or null when Drive is not set up here. The
 *  secret is base64 so a multi-line JSON key survives a shell; plain JSON is
 *  accepted too. */
export function driveServiceAccount(env: Record<string, string | undefined> = process.env): ServiceAccount | null {
  const raw = env.GOOGLE_DRIVE_SA_JSON?.trim();
  if (!raw) return null;
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  try {
    const sa = JSON.parse(text) as Partial<ServiceAccount>;
    return sa.client_email && sa.private_key ? { client_email: sa.client_email, private_key: sa.private_key } : null;
  } catch {
    return null;
  }
}

/** Whether the key is there and readable — never its value. 'unreadable'
 *  is the case that cost a round trip on 2026-10-17: the secret was set on
 *  staging and config still said "not set up", with nothing saying why. */
export function driveSetupState(env: Record<string, string | undefined> = process.env): 'missing' | 'unreadable' | 'ok' {
  if (!env.GOOGLE_DRIVE_SA_JSON?.trim()) return 'missing';
  return driveServiceAccount(env) ? 'ok' : 'unreadable';
}

let token: { value: string; expires: number } | null = null;

/** Tests only. */
export function _resetDriveToken(): void {
  token = null;
  listCache.clear();
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (v: string) => Buffer.from(v).toString('base64url');
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64(JSON.stringify({ iss: sa.client_email, scope: DRIVE_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key, 'base64url');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new DriveError('unavailable', `token exchange ${res.status}`);
  token = { value: body.access_token, expires: Date.now() + 50 * 60_000 };
  return token.value;
}

export class DriveError extends Error {
  constructor(
    readonly code: 'not_shared' | 'unavailable' | 'not_found' | 'drive_not_configured' | 'too_large',
    message: string,
  ) {
    super(message);
  }
}

async function driveGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const sa = driveServiceAccount();
  if (!sa) throw new DriveError('drive_not_configured', 'GOOGLE_DRIVE_SA_JSON is not set');
  const qs = new URLSearchParams({ supportsAllDrives: 'true', ...params });
  const res = await fetch(`${API}${path}?${qs}`, { headers: { Authorization: `Bearer ${await accessToken(sa)}` } });
  if (res.status === 404 || res.status === 403) throw new DriveError('not_shared', `drive ${res.status}`);
  if (!res.ok) throw new DriveError('unavailable', `drive ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Folder links + the one-time code
// ---------------------------------------------------------------------------

/** The folder id in a Drive folder link, or null. File links are refused:
 *  this connects folders. */
export function folderIdFromUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'drive.google.com') return null;
  const m = u.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,200})\/?$/);
  if (m) return m[1]!;
  if (u.pathname === '/open') {
    const id = u.searchParams.get('id');
    return id && /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : null;
  }
  return null;
}

/** A Drive id's own alphabet (the binding table checks the same). */
export const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

const HOUR = 3_600_000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function verifyKey(env: Record<string, string | undefined>): Buffer {
  const secret = env.SSO_INTERNAL_SECRET;
  if (!secret) throw new Error('SSO_INTERNAL_SECRET is not set');
  return createHmac('sha256', secret).update('drive-verify-v1').digest();
}

/** The code for (workspace, folder) in one hour bucket: "fibre-verify-XXXX-XXXX". */
export function verifyCode(workspaceId: string, folderId: string, bucket: number, env: Record<string, string | undefined> = process.env): string {
  const mac = createHmac('sha256', verifyKey(env)).update(`${workspaceId}:${folderId}:${bucket}`).digest();
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[mac[i]! % ALPHABET.length];
  return `fibre-verify-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** A code issued now: valid through the end of the NEXT hour, so a code made
 *  at 10:59 still works at 11:30 (the coordinator's hour edge). */
export function issueCode(workspaceId: string, folderId: string, now = Date.now(), env: Record<string, string | undefined> = process.env) {
  const bucket = Math.floor(now / HOUR);
  return { code: verifyCode(workspaceId, folderId, bucket, env), expires_at: new Date((bucket + 2) * HOUR).toISOString() };
}

/** Does this description carry a code for (workspace, folder), issued this
 *  hour or the one before? Constant-time on each candidate. */
export function descriptionProves(
  description: string | null | undefined,
  workspaceId: string,
  folderId: string,
  now = Date.now(),
  env: Record<string, string | undefined> = process.env,
): boolean {
  const found = (description ?? '').match(/fibre-verify-[A-Z0-9]{4}-[A-Z0-9]{4}/g) ?? [];
  if (!found.length) return false;
  const bucket = Math.floor(now / HOUR);
  const valid = [bucket, bucket - 1].map((b) => Buffer.from(verifyCode(workspaceId, folderId, b, env)));
  return found.some((f) => {
    const got = Buffer.from(f);
    return valid.some((v) => v.length === got.length && timingSafeEqual(v, got));
  });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type DriveMeta = { id: string; name: string; mimeType: string; description?: string; parents?: string[]; trashed?: boolean; size?: string };

export async function folderMeta(id: string): Promise<DriveMeta> {
  const f = await driveGet<DriveMeta>(`/files/${encodeURIComponent(id)}`, { fields: 'id,name,mimeType,description,parents,trashed,size' });
  if (f.trashed) throw new DriveError('not_shared', 'trashed');
  return f;
}

/** The chain from `id` up to `rootId` (root first, `id` last), or null when
 *  `id` does not sit under `rootId` within 10 levels. */
export async function chainToRoot(rootId: string, id: string): Promise<DriveMeta[] | null> {
  const chain: DriveMeta[] = [];
  let cur = id;
  for (let depth = 0; depth <= 10; depth++) {
    let meta: DriveMeta;
    try {
      meta = await folderMeta(cur);
    } catch (e) {
      if (e instanceof DriveError && e.code === 'not_shared') return null;
      throw e;
    }
    chain.unshift(meta);
    if (meta.id === rootId) return chain;
    const parent = meta.parents?.[0];
    if (!parent) return null;
    cur = parent;
  }
  return null;
}

export type DriveItem = {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  mime: string;
  bytes: number | null;
  modified_at: string;
  export_as: 'pdf' | null;
  downloadable: boolean;
  reason: 'too_large' | 'not_exportable' | null;
};

type RawFile = { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string };

/** Pure: Drive's file → the item the member sees. */
export function toItem(f: RawFile): DriveItem {
  const folder = f.mimeType === FOLDER_MIME;
  const native = f.mimeType.startsWith('application/vnd.google-apps.');
  const exportable = native && EXPORTABLE.has(f.mimeType);
  const bytes = f.size !== undefined && !native ? Number(f.size) : null;
  const tooLarge = bytes !== null && bytes > DRIVE_LIMITS.max_download_bytes;
  const reason = folder ? null : native && !exportable ? 'not_exportable' : tooLarge ? 'too_large' : null;
  return {
    id: f.id,
    name: f.name,
    kind: folder ? 'folder' : 'file',
    mime: f.mimeType,
    bytes,
    modified_at: f.modifiedTime ?? '',
    export_as: exportable ? 'pdf' : null,
    downloadable: !folder && reason === null,
    reason,
  };
}

/** Folders first, then files, each by name in the reader's language. */
export function orderItems(items: DriveItem[], locale = 'en'): DriveItem[] {
  const c = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...items].sort((a, b) => (a.kind === b.kind ? c.compare(a.name, b.name) : a.kind === 'folder' ? -1 : 1));
}

async function children(folderId: string): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const r = await driveGet<{ files?: RawFile[]; nextPageToken?: string }>('/files', {
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
      pageSize: '1000',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    out.push(...(r.files ?? []).map(toItem));
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export type FolderListing = {
  folder: { id: string; name: string };
  breadcrumbs: { id: string; name: string }[];
  items: DriveItem[];
  limits: typeof DRIVE_LIMITS;
};

const LIST_TTL = 2 * 60_000;
/** Bounded (coordinator, 2026-10-17): a busy member browsing many folders
 *  cannot grow this forever. A Map keeps insertion order, so the first key
 *  is the oldest. */
export const LIST_CACHE_MAX = 500;
const listCache = new Map<string, { at: number; value: FolderListing }>();
function remember(key: string, value: FolderListing): void {
  listCache.delete(key);
  listCache.set(key, { at: Date.now(), value });
  while (listCache.size > LIST_CACHE_MAX) listCache.delete(listCache.keys().next().value as string);
}
/** Tests only. */
export const _listCacheSize = (): number => listCache.size;
/** Tests only: put a listing straight into the cache. */
export function _remember(key: string, value: FolderListing): void {
  remember(key, value);
}

/**
 * One folder under a bound root, for a member already admitted. `folderId`
 * absent = the root. A folder that is not under the root answers not_found —
 * the same as a folder that does not exist, so another community's folder id
 * tells the caller nothing.
 */
export async function listFolder(workspaceId: string, rootId: string, folderId?: string | null, locale = 'en'): Promise<FolderListing> {
  const target = folderId || rootId;
  // The id goes into Drive's query string below: only an id's own alphabet.
  if (!DRIVE_ID.test(target)) throw new DriveError('not_found', 'not a folder id');
  const key = `${workspaceId}:${rootId}:${target}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL) return hit.value;
  try {
    const chain = await chainToRoot(rootId, target);
    if (!chain) {
      // The root itself unreadable is "not shared any more"; anything else
      // outside the root is simply not here.
      if (target === rootId) throw new DriveError('not_shared', 'root not readable');
      throw new DriveError('not_found', 'not under the bound folder');
    }
    const here = chain[chain.length - 1]!;
    if (here.mimeType !== FOLDER_MIME) throw new DriveError('not_found', 'not a folder');
    const value: FolderListing = {
      folder: { id: here.id, name: here.name },
      breadcrumbs: chain.map((c) => ({ id: c.id, name: c.name })),
      items: orderItems(await children(here.id), locale),
      limits: DRIVE_LIMITS,
    };
    remember(key, value);
    return value;
  } catch (e) {
    // Google busy: the last listing we had, if any, rather than nothing.
    if (e instanceof DriveError && e.code === 'unavailable' && hit) return hit.value;
    throw e;
  }
}

/** The stack's service-account address, for "share it with …". */
export function serviceAccountEmail(): string | null {
  return driveServiceAccount()?.client_email ?? null;
}

// ---------------------------------------------------------------------------
// Downloads (slice 3)
//
// The member never gets a Drive URL. my.thread asks the API (with the
// member's session) for a token naming the workspace, the entry, the file and
// the member; the browser is sent to the API's own stream URL with it; the
// stream re-admits the member and re-walks the file's parents to the bound
// root before a byte moves. Sixty seconds, so a copied link dies quickly.
// ---------------------------------------------------------------------------

export const TOKEN_SECONDS = 60;

function downloadKey(env: Record<string, string | undefined>): Buffer {
  const secret = env.SSO_INTERNAL_SECRET;
  if (!secret) throw new Error('SSO_INTERNAL_SECRET is not set');
  return createHmac('sha256', secret).update('drive-download-v1').digest();
}

/** w = workspace, d = member-page entry, f = Drive file, p = the PERSON row
 *  that admitted the member, x = expiry. No email and nothing else personal:
 *  this rides in a URL, which ends up in history, access logs and
 *  screenshots (coordinator, 2026-10-17). The email is looked up server-side
 *  from p when the file is served. */
export type DownloadClaim = { w: string; d: string; f: string; p: string; x: number };

export function signDownload(claim: Omit<DownloadClaim, 'x'>, now = Date.now(), env: Record<string, string | undefined> = process.env): string {
  const body = Buffer.from(JSON.stringify({ ...claim, x: now + TOKEN_SECONDS * 1000 })).toString('base64url');
  const mac = createHmac('sha256', downloadKey(env)).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** The claim, or null when forged, malformed or expired. */
export function readDownload(token: unknown, now = Date.now(), env: Record<string, string | undefined> = process.env): DownloadClaim | null {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = Buffer.from(createHmac('sha256', downloadKey(env)).update(body).digest('base64url'));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let c: DownloadClaim;
  try {
    c = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DownloadClaim;
  } catch {
    return null;
  }
  if (typeof c.x !== 'number' || c.x < now) return null;
  if (![c.w, c.d, c.f, c.p].every((v) => typeof v === 'string' && v.length > 0)) return null;
  return c;
}

/** The name the browser saves: an export gets ".pdf"; nothing that could
 *  break a header. */
export function downloadName(name: string, exportAs: 'pdf' | null): string {
  const clean = name.replace(/[\r\n"\\/]+/g, ' ').trim().slice(0, 180) || 'file';
  return exportAs === 'pdf' && !/\.pdf$/i.test(clean) ? `${clean}.pdf` : clean;
}

/** Drive's bytes for one file, as a stream: the file itself, or its PDF. */
export async function driveStream(item: DriveItem): Promise<Response> {
  const sa = driveServiceAccount();
  if (!sa) throw new DriveError('drive_not_configured', 'GOOGLE_DRIVE_SA_JSON is not set');
  const path = item.export_as === 'pdf'
    ? `${API}/files/${encodeURIComponent(item.id)}/export?mimeType=application/pdf`
    : `${API}/files/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(path, { headers: { Authorization: `Bearer ${await accessToken(sa)}` } });
  if (res.ok) return res;
  const text = await res.text().catch(() => '');
  // Google's own export limit (10 MB) arrives as a 403 with this reason.
  if (res.status === 403 && /exportSizeLimitExceeded/.test(text)) throw new DriveError('too_large', 'export too large');
  if (res.status === 404 || res.status === 403) throw new DriveError('not_shared', `drive ${res.status}`);
  throw new DriveError('unavailable', `drive ${res.status}`);
}
