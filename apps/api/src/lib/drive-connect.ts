// Connecting a Drive folder to a community, and admitting a member to one
// (Drive folders, slice 2, 2026-10-17). The Drive calls are lib/drive.ts;
// this file is who may do what.
//
// CONNECT is two steps, because the stack's one service account reads every
// community's shared folders:
//   1. start  — the folder link → its id; the service account must already
//      see it; a one-time code for THIS workspace and folder.
//   2. verify — the code must be in the folder's Drive description; then the
//      binding row (one workspace per folder, the table's primary key) and
//      the member-page entry.
// ADMIT re-runs, on every request, the same predicate as every other member
// document (memberCommunities + visibleTo), plus "the binding is still this
// workspace's". Access ends with the membership because nothing is granted
// anywhere else.

import { adminClient } from '../db.js';
import {
  DRIVE_ID,
  DriveError,
  FOLDER_MIME,
  chainToRoot,
  descriptionProves,
  downloadName,
  driveStream,
  folderIdFromUrl,
  folderMeta,
  issueCode,
  readDownload,
  serviceAccountEmail,
  signDownload,
  toItem,
} from './drive.js';
import { addDriveDocument, isDrive, memberCommunities, readMemberPage, visibleTo, type DriveDocument } from './member-page.js';

export type ConnectError =
  | { status: 400; code: 'bad_url' | 'bad_folder' }
  | { status: 409; code: 'not_shared' | 'bound_elsewhere' | 'code_missing'; service_account?: string | null }
  | { status: 410; code: 'code_expired' }
  | { status: 503; code: 'drive_not_configured' | 'unavailable' };

/** Whose folder is it, if anyone's. */
async function boundTo(folderId: string): Promise<string | null> {
  const { data, error } = await adminClient
    .from('membership_drive_binding')
    .select('workspace_id')
    .eq('drive_folder_id', folderId)
    .maybeSingle();
  if (error) throw new Error(`drive binding: ${error.message}`);
  return (data?.workspace_id as string | undefined) ?? null;
}

function driveFailure(e: unknown): ConnectError {
  if (e instanceof DriveError) {
    if (e.code === 'drive_not_configured') return { status: 503, code: 'drive_not_configured' };
    if (e.code === 'not_shared' || e.code === 'not_found') return { status: 409, code: 'not_shared', service_account: serviceAccountEmail() };
    return { status: 503, code: 'unavailable' };
  }
  throw e;
}

export async function startConnect(ws: string, folderUrl: unknown, now = Date.now()) {
  const folderId = folderIdFromUrl(folderUrl);
  if (!folderId) return { error: { status: 400, code: 'bad_url' } as ConnectError };
  const sa = serviceAccountEmail();
  if (!sa) return { error: { status: 503, code: 'drive_not_configured' } as ConnectError };
  const owner = await boundTo(folderId);
  if (owner && owner !== ws) return { error: { status: 409, code: 'bound_elsewhere' } as ConnectError };
  let meta;
  try {
    meta = await folderMeta(folderId);
  } catch (e) {
    return { error: driveFailure(e) };
  }
  if (meta.mimeType !== FOLDER_MIME) return { error: { status: 400, code: 'bad_folder' } as ConnectError };
  return { folder_id: folderId, folder_name: meta.name, service_account: sa, ...issueCode(ws, folderId, now) };
}

export async function verifyConnect(ws: string, userId: string | null, folderId: unknown, title: unknown, now = Date.now()) {
  if (typeof folderId !== 'string' || !DRIVE_ID.test(folderId)) return { error: { status: 400, code: 'bad_folder' } as ConnectError };
  if (!serviceAccountEmail()) return { error: { status: 503, code: 'drive_not_configured' } as ConnectError };
  const owner = await boundTo(folderId);
  if (owner && owner !== ws) return { error: { status: 409, code: 'bound_elsewhere' } as ConnectError };
  let meta;
  try {
    meta = await folderMeta(folderId);
  } catch (e) {
    return { error: driveFailure(e) };
  }
  if (meta.mimeType !== FOLDER_MIME) return { error: { status: 400, code: 'bad_folder' } as ConnectError };
  if (!descriptionProves(meta.description, ws, folderId, now)) {
    // A code is there but no longer (or never) valid for us: start again.
    const stale = /fibre-verify-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(meta.description ?? '');
    return { error: (stale ? { status: 410, code: 'code_expired' } : { status: 409, code: 'code_missing' }) as ConnectError };
  }
  // Already connected here (a second Verify): the entry we have.
  const page = await readMemberPage(ws);
  const existing = page.documents.find((d): d is DriveDocument => isDrive(d) && d.folder_id === folderId);
  if (owner === ws && existing) return { doc: existing };
  if (!owner) {
    const { error } = await adminClient
      .from('membership_drive_binding')
      .insert({ drive_folder_id: folderId, workspace_id: ws, verified_by: userId || null });
    if (error) {
      // Another community verified the same folder a moment earlier.
      if (error.code === '23505') return { error: { status: 409, code: 'bound_elsewhere' } as ConnectError };
      throw new Error(`drive binding: ${error.message}`);
    }
  }
  const name = typeof title === 'string' && title.trim() ? title : meta.name;
  return { doc: existing ?? (await addDriveDocument(ws, folderId, name)) };
}

/** The Drive entry this verified address may browse in `ws`, or null — one
 *  answer for "not a member", "not shown to you", "no such entry" and "the
 *  folder is no longer this community's". */
export async function admittedDriveEntry(email: string, ws: string, docId: string): Promise<DriveDocument | null> {
  return (await admitted(email, ws, docId))?.doc ?? null;
}

async function admitted(email: string, ws: string, docId: string): Promise<{ doc: DriveDocument; personId: string } | null> {
  const mine = (await memberCommunities(email)).find((m) => m.workspace_id === ws);
  if (!mine) return null;
  const page = await readMemberPage(ws);
  const doc = page.documents.find((d) => d.id === docId);
  if (!doc || !isDrive(doc)) return null;
  if (!visibleTo(doc, { tier_ids: mine.tier_ids, category_ids: mine.category_ids })) return null;
  if ((await boundTo(doc.folder_id)) !== ws) return null;
  return { doc, personId: mine.person_id };
}

// ---------------------------------------------------------------------------
// Downloads (slice 3)
// ---------------------------------------------------------------------------

export type DownloadError =
  | { status: 404; code: 'not_found' }
  | { status: 409; code: 'not_shared' | 'not_exportable' }
  | { status: 413; code: 'too_large' }
  | { status: 503; code: 'unavailable' | 'drive_not_configured' };

function downloadFailure(e: unknown): DownloadError {
  if (e instanceof DriveError) {
    if (e.code === 'not_found') return { status: 404, code: 'not_found' };
    if (e.code === 'not_shared') return { status: 409, code: 'not_shared' };
    if (e.code === 'too_large') return { status: 413, code: 'too_large' };
    if (e.code === 'drive_not_configured') return { status: 503, code: 'drive_not_configured' };
    return { status: 503, code: 'unavailable' };
  }
  throw e;
}

/** The file, IF it sits under this entry's bound root and may be opened. */
type Under = { error: DownloadError } | { item: ReturnType<typeof toItem> };
async function fileUnderRoot(doc: DriveDocument, fileId: string): Promise<Under> {
  if (!DRIVE_ID.test(fileId)) return { error: { status: 404, code: 'not_found' } as DownloadError };
  let chain;
  try {
    chain = await chainToRoot(doc.folder_id, fileId);
  } catch (e) {
    return { error: downloadFailure(e) };
  }
  if (!chain || chain.length < 2) return { error: { status: 404, code: 'not_found' } as DownloadError };
  const meta = chain[chain.length - 1]!;
  if (meta.mimeType === FOLDER_MIME) return { error: { status: 404, code: 'not_found' } as DownloadError };
  const item = toItem({ id: meta.id, name: meta.name, mimeType: meta.mimeType, ...(meta.size !== undefined ? { size: meta.size } : {}) });
  if (item.reason === 'not_exportable') return { error: { status: 409, code: 'not_exportable' } as DownloadError };
  if (item.reason === 'too_large') return { error: { status: 413, code: 'too_large' } as DownloadError };
  return { item };
}

/** POST …/download: a 60-second link to the API's own stream. */
/** `origin` is THIS API's public origin, from the request (publicOrigin in
 *  routes/mcp-discovery.ts — the Stripe callback's lesson): a configured
 *  fallback pointing at production would send a staging member to the
 *  production API, where a staging token can never verify. */
export async function prepareDownload(email: string, ws: string, docId: string, fileId: unknown, origin: string, now = Date.now()) {
  const a = await admitted(email, ws, docId);
  if (!a) return { error: { status: 404, code: 'not_found' } as DownloadError };
  if (typeof fileId !== 'string') return { error: { status: 404, code: 'not_found' } as DownloadError };
  const f = await fileUnderRoot(a.doc, fileId);
  if ('error' in f) return { error: f.error };
  const token = signDownload({ w: ws, d: docId, f: fileId, p: a.personId }, now);
  return {
    url: `${origin}/api/v1/me/portal/drive-download?token=${encodeURIComponent(token)}`,
    expires_at: new Date(now + 60_000).toISOString(),
    filename: downloadName(f.item.name, f.item.export_as),
    export_as: f.item.export_as,
  };
}

/** GET drive-download?token: re-admit, re-walk, record, stream. */
export async function serveDownload(token: unknown, now = Date.now()) {
  const claim = readDownload(token, now);
  if (!claim) return { error: { status: 404, code: 'not_found' } as DownloadError };
  // The token names a person row, never an address: find the address here,
  // then admit exactly as the POST did.
  const { data: person } = await adminClient
    .from('person')
    .select('email')
    .eq('id', claim.p)
    .eq('workspace_id', claim.w)
    .is('deleted_at', null)
    .maybeSingle();
  const email = (person?.email as string | null | undefined) ?? '';
  if (!email) return { error: { status: 404, code: 'not_found' } as DownloadError };
  const a = await admitted(email, claim.w, claim.d);
  if (!a) return { error: { status: 404, code: 'not_found' } as DownloadError };
  const f = await fileUnderRoot(a.doc, claim.f);
  if ('error' in f) return { error: f.error };
  let body: Response;
  try {
    body = await driveStream(f.item);
  } catch (e) {
    return { error: downloadFailure(e) };
  }
  // Type + subject only (hard rule 5): which folder and which file, by id.
  // A file's name is content and never enters the activity log.
  await logDownload(claim.w, a.personId, `${a.doc.folder_id}/${claim.f}`.slice(0, 200));
  return { body, filename: downloadName(f.item.name, f.item.export_as), contentType: f.item.export_as === 'pdf' ? 'application/pdf' : f.item.mime };
}

async function logDownload(ws: string, personId: string, subject: string): Promise<void> {
  try {
    const { data: app } = await adminClient.from('app').select('id').eq('slug', 'membership').single();
    if (!app) return;
    await adminClient.from('activity').insert({
      workspace_id: ws,
      person_id: personId,
      app_id: app.id,
      type: 'drive_file_downloaded',
      subject,
      occurred_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[drive] download not logged (non-fatal)', e);
  }
}
