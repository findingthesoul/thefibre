// The community page (item 4, 2026-10-14): what a community's members see in
// my.thread — an intro the admin writes, documents the admin uploads, the
// documents their threads have already sent them, and what is next.
//
// WHO: active or grace members of that community. Not somebody who bought a
// single product or holds one thread — the page is the membership's.
//
// DOCUMENTS live in a PRIVATE bucket (`member-documents`). A member never
// gets a lasting address: the API checks they are a member and answers with a
// signed URL valid for 60 seconds, so a forwarded link stops working within a
// minute. The type is read from the bytes (lib/file-sniff.ts) and images lose
// their metadata before they are stored.
//
// REMOVING a document deletes the stored file as well as its entry. That is
// deliberate and not the soft-delete rule: soft delete is for PERSONAL data,
// and an admin's upload of a flyer or a handbook is not that — keeping the
// file after the admin removed it would keep something they asked to be gone.

import { randomUUID } from 'node:crypto';
import { adminClient } from '../db.js';
import { sanitizeRichText } from './rich-text.js';
import { fillMemberPageTags, safeLinkUrl } from '@thefibre/shared/member-page';
import { greetingName } from './email/membership-templates.js';
import { EXT, MIME, sniff, stripMetadata } from './file-sniff.js';
import { couldJoinByMember } from './could-join.js';
import { loadAgendaByThread, personsForEmail } from './portal-agenda.js';
import { enrolmentIsLive } from './portal.js';
import { placesByThread } from './place-state.js';

export const BUCKET = 'member-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SIGNED_SECONDS = 60;

export type StoredDocument = {
  id: string;
  title: string;
  /** Absent on entries written before links existed: those are files. */
  kind?: 'file';
  path: string;
  mime: string;
  bytes: number;
  uploaded_at: string;
};

/** A document that is an ADDRESS — a Google Doc, a page elsewhere (Sjoerd,
 *  2026-10-14: "A document could also be a link"). Nothing is stored; the
 *  member's browser opens it in a new tab. */
export type LinkDocument = {
  id: string;
  title: string;
  kind: 'link';
  url: string;
  uploaded_at: string;
};

export type PageDocument = StoredDocument | LinkDocument;
export const isLink = (d: PageDocument): d is LinkDocument => d.kind === 'link';

export type MemberPage = { intro_html: string | null; documents: PageDocument[] };

const one = <T>(v: unknown): T | null =>
  !v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T);

export async function readMemberPage(ws: string): Promise<MemberPage> {
  const { data, error } = await adminClient
    .from('membership_settings')
    .select('member_page')
    .eq('workspace_id', ws)
    .maybeSingle();
  if (error) throw new Error(`member page: ${error.message}`);
  const page = (data?.member_page ?? {}) as Partial<MemberPage>;
  return { intro_html: page.intro_html ?? null, documents: Array.isArray(page.documents) ? page.documents : [] };
}

async function writeMemberPage(ws: string, page: MemberPage): Promise<void> {
  const { error } = await adminClient
    .from('membership_settings')
    .upsert({ workspace_id: ws, member_page: page, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) throw new Error(`save member page: ${error.message}`);
}

/** The admin's intro, sanitised on the way in. */
export async function saveIntro(ws: string, introHtml: string | null): Promise<void> {
  const page = await readMemberPage(ws);
  await writeMemberPage(ws, { ...page, intro_html: introHtml ? sanitizeRichText(introHtml) : null });
}

export type UploadRefusal = 'too_large' | 'not_allowed' | 'empty' | 'corrupt';

/** Store one document. The kind comes from the BYTES; the title from the
 *  admin (or the file name, without its extension). */
export async function addDocument(
  ws: string,
  file: { name: string; bytes: Uint8Array },
  title: string | null,
): Promise<StoredDocument | UploadRefusal> {
  if (!file.bytes.length) return 'empty';
  if (file.bytes.length > MAX_DOCUMENT_BYTES) return 'too_large';
  const kind = sniff(file.bytes);
  if (!kind) return 'not_allowed';
  const clean = stripMetadata(file.bytes, kind);
  if (!clean) return 'corrupt';
  const id = randomUUID();
  const path = `${ws}/${id}.${EXT[kind]}`;
  const { error } = await adminClient.storage.from(BUCKET).upload(path, clean, { contentType: MIME[kind], upsert: false });
  if (error) throw new Error(`upload: ${error.message}`);
  const doc: StoredDocument = {
    id,
    title: (title?.trim() || file.name.replace(/\.[^.]+$/, '') || 'Document').slice(0, 200),
    path,
    mime: MIME[kind],
    bytes: clean.length,
    uploaded_at: new Date().toISOString(),
  };
  try {
    const page = await readMemberPage(ws);
    await writeMemberPage(ws, { ...page, documents: [...page.documents, doc] });
  } catch (e) {
    // The entry did not save: take the file back out, so nothing is stored
    // that no page lists and no admin can remove.
    await adminClient.storage.from(BUCKET).remove([path]);
    throw e;
  }
  return doc;
}

/** Add a link entry, at the end of the list like an upload. */
export async function addLink(ws: string, rawUrl: unknown, title: string | null): Promise<LinkDocument | 'bad_url'> {
  const url = safeLinkUrl(rawUrl);
  if (!url) return 'bad_url';
  const doc: LinkDocument = {
    id: randomUUID(),
    title: (title?.trim() || new URL(url).hostname).slice(0, 200),
    kind: 'link',
    url,
    uploaded_at: new Date().toISOString(),
  };
  const page = await readMemberPage(ws);
  await writeMemberPage(ws, { ...page, documents: [...page.documents, doc] });
  return doc;
}

export async function renameDocument(ws: string, id: string, title: string): Promise<boolean> {
  const page = await readMemberPage(ws);
  if (!page.documents.some((d) => d.id === id)) return false;
  await writeMemberPage(ws, {
    ...page,
    documents: page.documents.map((d) => (d.id === id ? { ...d, title: title.trim().slice(0, 200) || d.title } : d)),
  });
  return true;
}

/** The new order, as the admin dragged it. Ids not named keep their place
 *  at the end, so a stale client cannot drop a document by omission. */
export async function reorderDocuments(ws: string, ids: string[]): Promise<void> {
  const page = await readMemberPage(ws);
  const byId = new Map(page.documents.map((d) => [d.id, d]));
  const ordered = ids.map((id) => byId.get(id)).filter((d): d is PageDocument => !!d);
  const rest = page.documents.filter((d) => !ids.includes(d.id));
  await writeMemberPage(ws, { ...page, documents: [...ordered, ...rest] });
}

/** Remove the entry AND the stored file (see the head of this file for why
 *  this is not a soft delete). The file goes first: an entry pointing at
 *  nothing is a broken link; a file pointing at no entry is an upload nobody
 *  can remove. */
export async function removeDocument(ws: string, id: string): Promise<boolean> {
  const page = await readMemberPage(ws);
  const doc = page.documents.find((d) => d.id === id);
  if (!doc) return false;
  if (!isLink(doc)) {
    const { error } = await adminClient.storage.from(BUCKET).remove([doc.path]);
    if (error) throw new Error(`remove file: ${error.message}`);
  }
  await writeMemberPage(ws, { ...page, documents: page.documents.filter((d) => d.id !== id) });
  return true;
}

// ---------------------------------------------------------------------------
// THE MEMBER'S SIDE
// ---------------------------------------------------------------------------

/** The communities this verified address is an active or grace member of,
 *  with the person row it is in each. */
export async function memberCommunities(email: string): Promise<{ workspace_id: string; person_id: string; member_id: string }[]> {
  const persons = await personsForEmail(email);
  if (!persons.length) return [];
  const { data, error } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id')
    .in('person_id', persons.map((p) => p.id))
    .in('status', ['active', 'grace'])
    .is('deleted_at', null);
  if (error) throw new Error(`memberships: ${error.message}`);
  const seen = new Set<string>();
  return ((data ?? []) as { id: string; workspace_id: string; person_id: string }[])
    .filter((m) => (seen.has(m.workspace_id) ? false : (seen.add(m.workspace_id), true)))
    .map((m) => ({ workspace_id: m.workspace_id, person_id: m.person_id, member_id: m.id }));
}

/** A 60-second download address for one document, or null when this address
 *  is not a member of that community or the document is not there. PDFs are
 *  served as an attachment named after their title. */
export async function signedDocumentUrl(email: string, ws: string, docId: string): Promise<string | null> {
  const mine = await memberCommunities(email);
  if (!mine.some((m) => m.workspace_id === ws)) return null;
  const found = (await readMemberPage(ws)).documents.find((d) => d.id === docId);
  // A link entry has no stored file to sign; the page links to it directly.
  if (!found || isLink(found)) return null;
  const doc = found;
  const isPdf = doc.mime === 'application/pdf';
  const filename = `${doc.title.replace(/[^\p{L}\p{N} ._-]+/gu, '').trim() || 'document'}.${doc.path.split('.').pop()}`;
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, SIGNED_SECONDS, isPdf ? { download: filename } : undefined);
  if (error || !data) throw new Error(`sign: ${error?.message ?? 'no url'}`);
  return data.signedUrl;
}

export type CommunityView = {
  workspace_id: string;
  name: string;
  logo_url: string | null;
  intro_html: string | null;
  /** A file (kind 'file', fetched through the signed route) or a link
   *  (kind 'link', opened directly). */
  documents: ({ id: string; title: string; kind: 'file'; mime: string; bytes: number } | { id: string; title: string; kind: 'link'; url: string })[];
  /** Document steps from the member's own threads in this community, ONLY
   *  those already released to them by the thread's own triggers. */
  thread_documents: { thread_title: string; items: { title: string; url: string | null; sent_at: string }[] }[];
  next: { title: string; starts_at: string; thread_title: string | null; url: string | null; kind: 'yours' | 'upcoming' } | null;
};

/** Everything one member sees on one community's page. */
export async function communityView(
  member: { workspace_id: string; person_id: string; member_id: string },
  now: Date = new Date(),
): Promise<CommunityView> {
  const ws = member.workspace_id;
  const [{ data: wsRow }, page, { data: who }] = await Promise.all([
    adminClient.from('workspace').select('name, brand_logo_url').eq('id', ws).maybeSingle(),
    readMemberPage(ws),
    // For the intro's tags only — the member's own name and tier.
    adminClient
      .from('membership_member')
      .select('tier:tier_id (name), person:person_id (first_name, last_name, email)')
      .eq('id', member.member_id)
      .maybeSingle(),
  ]);

  // The member's own live places in this community.
  const { data: places, error: pErr } = await adminClient
    .from('thread_enrolment')
    .select('id, thread_id, payment_status, enrolment:enrolment_id (status), thread:thread_id (id, workspace_id, program:program_id (title))')
    .eq('person_id', member.person_id);
  if (pErr) throw new Error(`places: ${pErr.message}`);
  const live = ((places ?? []) as Record<string, unknown>[]).filter((p) => {
    const t = one(p.thread) as { workspace_id?: string } | null;
    const s = (one(p.enrolment) as { status?: string | null } | null)?.status ?? null;
    return t?.workspace_id === ws && enrolmentIsLive(s);
  });
  const threadIds = live.map((p) => p.thread_id as string);
  const titleOf = new Map(
    live.map((p) => [p.thread_id as string, (one(one<{ program?: unknown }>(p.thread)?.program) as { title?: string } | null)?.title ?? '']),
  );

  // RELEASED document steps: the thread's own triggers deliver a document and
  // log the delivery per person in thread_message_send. That log IS the
  // release — a document scheduled for week 3 has no row in week 1 — so it is
  // read rather than restated.
  const threadDocuments: CommunityView['thread_documents'] = [];
  if (threadIds.length) {
    const { data: docs, error: dErr } = await adminClient
      .from('thread_engagement')
      .select('id, thread_id, title, content, position')
      .in('thread_id', threadIds)
      .eq('type', 'document')
      .eq('status', 'published')
      .order('position', { ascending: true });
    if (dErr) throw new Error(`document steps: ${dErr.message}`);
    const ids = (docs ?? []).map((d) => d.id as string);
    const sent = new Map<string, string>();
    if (ids.length) {
      const { data: sends, error: sErr } = await adminClient
        .from('thread_message_send')
        .select('engagement_id, sent_at')
        .in('engagement_id', ids)
        .eq('person_id', member.person_id);
      if (sErr) throw new Error(`document releases: ${sErr.message}`);
      for (const s of sends ?? []) sent.set(s.engagement_id as string, s.sent_at as string);
    }
    const byThread = new Map<string, CommunityView['thread_documents'][number]['items']>();
    for (const d of docs ?? []) {
      const at = sent.get(d.id as string);
      if (!at) continue;
      const content = (d.content ?? {}) as { external_url?: string; file_url?: string };
      const list = byThread.get(d.thread_id as string) ?? [];
      list.push({ title: d.title as string, url: content.external_url ?? content.file_url ?? null, sent_at: at });
      byThread.set(d.thread_id as string, list);
    }
    for (const [tid, items] of byThread) threadDocuments.push({ thread_title: titleOf.get(tid) ?? '', items });
  }

  // NEXT: the soonest thing on their own agenda here; failing that, the
  // soonest thread their calendars offer (the Upcoming walk, which prices
  // and filters exactly as that page does).
  let next: CommunityView['next'] = null;
  if (threadIds.length) {
    const agenda = await loadAgendaByThread({ threadIds, personIds: [member.person_id], droppedThreads: new Set() });
    const soonest = [...agenda.entries()]
      .flatMap(([tid, items]) => items.map((i) => ({ ...i, thread_id: tid })))
      .filter((i) => i.starts_at && new Date(i.starts_at).getTime() >= now.getTime())
      .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
    if (soonest) {
      next = { title: soonest.title, starts_at: soonest.starts_at!, thread_title: titleOf.get(soonest.thread_id) ?? null, url: null, kind: 'yours' };
    }
  }
  if (!next) {
    const placeMap = await placesByThread(
      ((places ?? []) as Record<string, unknown>[]).map((e) => ({
        id: e.id as string,
        thread_id: (e.thread_id as string | null) ?? null,
        payment_status: (e.payment_status as string | null) ?? null,
        enrolment_status: (one(e.enrolment) as { status?: string | null } | null)?.status ?? null,
      })),
    );
    const offers = (await couldJoinByMember([{ id: member.member_id, person_id: member.person_id, workspace_id: ws }], placeMap, 1)).get(member.member_id) ?? [];
    const first = offers.find((o) => o.starts_on);
    if (first?.starts_on) next = { title: first.title, starts_at: first.starts_on, thread_title: null, url: first.url, kind: 'upcoming' };
  }

  const community = (wsRow?.name as string | undefined) ?? '';
  const person = one<{ first_name?: string | null; last_name?: string | null; email?: string | null }>(who?.person);
  const firstName = (person?.first_name ?? '').trim();
  const intro = page.intro_html
    ? fillMemberPageTags(page.intro_html, {
        // A name derived from the mailbox is capitalised, as the welcome
        // email does; a typed name is left as its owner wrote it.
        first_name: firstName ? greetingName(firstName, person?.email) : '',
        last_name: person?.last_name ?? '',
        community,
        tier: one<{ name?: string | null }>(who?.tier)?.name ?? '',
        next_event: next?.title ?? '',
      })
    : null;

  return {
    workspace_id: ws,
    name: community,
    logo_url: (wsRow?.brand_logo_url as string | null | undefined) ?? null,
    intro_html: intro,
    documents: page.documents.map((d) =>
      isLink(d)
        ? { id: d.id, title: d.title, kind: 'link' as const, url: d.url }
        : { id: d.id, title: d.title, kind: 'file' as const, mime: d.mime, bytes: d.bytes },
    ),
    thread_documents: threadDocuments,
    next,
  };
}
