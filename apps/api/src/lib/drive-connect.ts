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
  descriptionProves,
  folderIdFromUrl,
  folderMeta,
  issueCode,
  serviceAccountEmail,
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
  const mine = (await memberCommunities(email)).find((m) => m.workspace_id === ws);
  if (!mine) return null;
  const page = await readMemberPage(ws);
  const doc = page.documents.find((d) => d.id === docId);
  if (!doc || !isDrive(doc)) return null;
  if (!visibleTo(doc, { tier_ids: mine.tier_ids, category_ids: mine.category_ids })) return null;
  if ((await boundTo(doc.folder_id)) !== ws) return null;
  return doc;
}
