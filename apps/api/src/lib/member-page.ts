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
//
// PER TIER (Sjoerd 2jj, 2026-10-16), ADDED beside the community-wide page,
// never instead of it: an intro section per tier (`tier_intros`, by tier id)
// and, per document, `tier_ids` — the tiers it is shown to. A document with
// no `tier_ids`, or an empty list, is shown to every member, exactly as
// before. "Holds a tier" is the SAME predicate as access to the page itself
// (liveMemberRows: active or grace, not deleted), and it is enforced here, on
// the server — the list a member is sent AND the signed download address.
//
// PER DIRECTORY CATEGORY (2jj follow-up), the same mechanism beside tiers:
// `category_intros` and, per document, `category_ids`. A member's categories
// are the directory's own (lib/member-categories.ts: the union over the
// products they hold), computed only for their live rows. A document is
// shown when nothing is chosen, or when the member holds ANY chosen tier OR
// ANY chosen category. A category's name reaches only its holders.

import { randomUUID } from 'node:crypto';
import { adminClient } from '../db.js';
import { sanitizeRichText } from './rich-text.js';
import { fillMemberPageTags, safeLinkUrl } from '@thefibre/shared/member-page';
import { greetingName } from './email/membership-templates.js';
import { myThreadUrl } from './message-tokens.js';
import { EXT, MIME, sniff, stripMetadata } from './file-sniff.js';
import { couldJoinByMember } from './could-join.js';
import { loadAgendaByThread, personsForEmail } from './portal-agenda.js';
import { enrolmentIsLive } from './portal.js';
import { placesByThread } from './place-state.js';
import { categoriesByPerson } from './member-categories.js';
import { releasedAt } from './document-release.js';

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
  /** The tiers this document is shown to. Absent or empty: every member. */
  tier_ids?: string[];
  /** The directory categories it is shown to (OR with tier_ids). */
  category_ids?: string[];
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
  /** The tiers this document is shown to. Absent or empty: every member. */
  tier_ids?: string[];
  /** The directory categories it is shown to (OR with tier_ids). */
  category_ids?: string[];
};

export type PageDocument = StoredDocument | LinkDocument;
export const isLink = (d: PageDocument): d is LinkDocument => d.kind === 'link';

export type MemberPage = {
  intro_html: string | null;
  documents: PageDocument[];
  /** A section per tier, shown under the community intro to members who
   *  hold that tier. Sanitised on the way in, like the intro. */
  tier_intros: Record<string, string>;
  /** A section per directory category, for its holders only. */
  category_intros: Record<string, string>;
};

export type Held = { tier_ids: readonly string[]; category_ids?: readonly string[] };

/** Whether a member sees this document. Nothing chosen in either list means
 *  everyone — the behaviour before tiers existed. Otherwise: ANY chosen tier
 *  OR ANY chosen category the member holds. A bare array is tiers only (the
 *  shape from before categories). */
export function visibleTo(doc: { tier_ids?: string[] | null; category_ids?: string[] | null }, held: readonly string[] | Held): boolean {
  const h: Held = Array.isArray(held) ? { tier_ids: held as readonly string[] } : (held as Held);
  const tiers = Array.isArray(doc.tier_ids) ? doc.tier_ids : [];
  const cats = Array.isArray(doc.category_ids) ? doc.category_ids : [];
  if (!tiers.length && !cats.length) return true;
  return tiers.some((t) => h.tier_ids.includes(t)) || cats.some((c) => (h.category_ids ?? []).includes(c));
}

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
  const map = (v: unknown): Record<string, string> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {});
  return {
    intro_html: page.intro_html ?? null,
    documents: Array.isArray(page.documents) ? page.documents : [],
    tier_intros: map(page.tier_intros),
    category_intros: map(page.category_intros),
  };
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

/** One tier's section, sanitised; empty or null removes it. The caller has
 *  checked the tier belongs to `ws`. */
export async function saveTierIntro(ws: string, tierId: string, introHtml: string | null): Promise<void> {
  const page = await readMemberPage(ws);
  const clean = (introHtml ? sanitizeRichText(introHtml) : null) ?? '';
  const intros = { ...page.tier_intros };
  if (clean.trim()) intros[tierId] = clean;
  else delete intros[tierId];
  await writeMemberPage(ws, { ...page, tier_intros: intros });
}

/** One directory category's section, sanitised; empty removes it. The
 *  caller has checked the category belongs to `ws`. */
export async function saveCategoryIntro(ws: string, categoryId: string, introHtml: string | null): Promise<void> {
  const page = await readMemberPage(ws);
  const clean = (introHtml ? sanitizeRichText(introHtml) : null) ?? '';
  const intros = { ...page.category_intros };
  if (clean.trim()) intros[categoryId] = clean;
  else delete intros[categoryId];
  await writeMemberPage(ws, { ...page, category_intros: intros });
}

/** Who one document is shown to: tiers and/or categories. Both empty =
 *  every member. The caller has checked every id belongs to `ws`. */
export async function setDocumentAudience(ws: string, id: string, audience: { tier_ids: string[]; category_ids: string[] }): Promise<boolean> {
  const page = await readMemberPage(ws);
  if (!page.documents.some((d) => d.id === id)) return false;
  const tiers = [...new Set(audience.tier_ids)];
  const cats = [...new Set(audience.category_ids)];
  await writeMemberPage(ws, {
    ...page,
    documents: page.documents.map((d) => {
      if (d.id !== id) return d;
      const { tier_ids: _t, category_ids: _c, ...rest } = d;
      return { ...rest, ...(tiers.length ? { tier_ids: tiers } : {}), ...(cats.length ? { category_ids: cats } : {}) } as PageDocument;
    }),
  });
  return true;
}

/** Who one document is shown to, by tier only — keeps its categories. An
 *  empty list = no tier limit. (The tiers-only route, kept beside the
 *  audience route it is a subset of.) */
export async function setDocumentTiers(ws: string, id: string, tierIds: string[]): Promise<boolean> {
  const doc = (await readMemberPage(ws)).documents.find((d) => d.id === id);
  if (!doc) return false;
  return setDocumentAudience(ws, id, { tier_ids: tierIds, category_ids: doc.category_ids ?? [] });
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

type LiveRow = { id: string; workspace_id: string; person_id: string; tier_id: string | null };

/** THE predicate for "is a member here": active or grace, not deleted. The
 *  page's access AND the tier sections both ask this, so "holds a tier" can
 *  never mean something different from "may open the page". */
async function liveMemberRows(personIds: string[], workspaceId?: string): Promise<LiveRow[]> {
  if (!personIds.length) return [];
  let q = adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id')
    .in('person_id', personIds)
    .in('status', ['active', 'grace'])
    .is('deleted_at', null);
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const { data, error } = await q;
  if (error) throw new Error(`memberships: ${error.message}`);
  return (data ?? []) as LiveRow[];
}

const tiersOf = (rows: LiveRow[], ws: string) =>
  [...new Set(rows.filter((r) => r.workspace_id === ws && r.tier_id).map((r) => r.tier_id as string))];

export type MemberCommunity = { workspace_id: string; person_id: string; member_id: string; tier_ids: string[]; category_ids: string[] };

/** The directory categories these LIVE rows hold in `ws` — the directory's
 *  own reader, asked only for people the access predicate admitted. */
async function categoriesOf(rows: LiveRow[], ws: string): Promise<string[]> {
  const people = [...new Set(rows.filter((r) => r.workspace_id === ws).map((r) => r.person_id))];
  if (!people.length) return [];
  const byPerson = await categoriesByPerson(ws, people);
  return [...new Set([...byPerson.values()].flatMap((set) => [...set]))];
}

/** The communities this verified address is an active or grace member of,
 *  with the person row it is in each and EVERY tier it holds there (one
 *  address can sit in more than one person row, each with its own tier). */
export async function memberCommunities(email: string): Promise<MemberCommunity[]> {
  const persons = await personsForEmail(email);
  const rows = await liveMemberRows(persons.map((p) => p.id));
  const seen = new Set<string>();
  const firsts = rows.filter((m) => (seen.has(m.workspace_id) ? false : (seen.add(m.workspace_id), true)));
  return Promise.all(
    firsts.map(async (m) => ({
      workspace_id: m.workspace_id,
      person_id: m.person_id,
      member_id: m.id,
      tier_ids: tiersOf(rows, m.workspace_id),
      category_ids: await categoriesOf(rows, m.workspace_id),
    })),
  );
}

/** A 60-second download address for one document, or null when this address
 *  is not a member of that community or the document is not there. PDFs are
 *  served as an attachment named after their title. */
export async function signedDocumentUrl(email: string, ws: string, docId: string): Promise<string | null> {
  const mine = (await memberCommunities(email)).find((m) => m.workspace_id === ws);
  if (!mine) return null;
  const found = (await readMemberPage(ws)).documents.find((d) => d.id === docId);
  // A link entry has no stored file to sign; the page links to it directly.
  if (!found || isLink(found)) return null;
  // Not shown to this member's tiers: not signed for them either — the same
  // answer as a document that is not there.
  if (!visibleTo(found, mine)) return null;
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
  /** The sections for the tiers this member holds, in the tiers' own order,
   *  shown under the community intro. Empty when none is written. */
  tier_sections: { tier_id: string; tier_name: string; intro_html: string }[];
  /** The sections for the directory categories this member holds, under the
   *  tier sections. Named only to holders. */
  category_sections: { category_id: string; category_name: string; intro_html: string }[];
  /** A file (kind 'file', fetched through the signed route) or a link
   *  (kind 'link', opened directly). */
  documents: ({ id: string; title: string; kind: 'file'; mime: string; bytes: number } | { id: string; title: string; kind: 'link'; url: string })[];
  /** Document steps from the member's own threads in this community, ONLY
   *  those already released to them by the thread's own triggers. */
  thread_documents: { thread_title: string; items: { title: string; url: string | null; sent_at: string }[] }[];
  next: { title: string; starts_at: string; thread_title: string | null; url: string | null; kind: 'yours' | 'upcoming' } | null;
};

export type LivePlace = { thread_id: string; workspace_id: string; title: string };

/** A person's thread places: every row (for the place-state readers) and
 *  the LIVE ones — enrolmentIsLive, the rule every portal surface uses. One
 *  reader for the community page and the Files page, so "holds a place"
 *  cannot mean two things. Scoped by person id: the portal has no RLS
 *  identity in these workspaces. */
export async function threadPlaces(personIds: string[]): Promise<{ all: Record<string, unknown>[]; live: LivePlace[] }> {
  if (!personIds.length) return { all: [], live: [] };
  const { data: places, error } = await adminClient
    .from('thread_enrolment')
    .select('id, thread_id, payment_status, enrolment:enrolment_id (status), thread:thread_id (id, workspace_id, program:program_id (title))')
    .in('person_id', personIds);
  if (error) throw new Error(`places: ${error.message}`);
  const all = (places ?? []) as Record<string, unknown>[];
  const seen = new Set<string>();
  const live: LivePlace[] = [];
  for (const p of all) {
    const t = one<{ workspace_id?: string; program?: unknown }>(p.thread);
    const s = (one(p.enrolment) as { status?: string | null } | null)?.status ?? null;
    const tid = p.thread_id as string;
    if (!t?.workspace_id || !enrolmentIsLive(s) || seen.has(tid)) continue;
    seen.add(tid);
    live.push({ thread_id: tid, workspace_id: t.workspace_id, title: (one(t.program) as { title?: string } | null)?.title ?? '' });
  }
  return { all, live };
}

export type ReleasedGroup = {
  thread_id: string;
  thread_title: string;
  items: { title: string; url: string | null; sent_at: string }[];
};

/** RELEASED document steps of these threads, for these people. The thread's
 *  own triggers deliver a document and log the delivery per person in
 *  thread_message_send. That log IS the release — a document scheduled for
 *  week 3 has no row in week 1 — so it is read rather than restated. The
 *  link is the organiser's typed text, so it passes safeLinkUrl (http/https
 *  only) here, at read time; anything else becomes null. */
export async function releasedThreadDocuments(personIds: string[], threads: { thread_id: string; title: string }[]): Promise<ReleasedGroup[]> {
  if (!personIds.length || !threads.length) return [];
  const titleOf = new Map(threads.map((t) => [t.thread_id, t.title]));
  const { data: docs, error: dErr } = await adminClient
    .from('thread_engagement')
    .select('id, thread_id, title, content, position')
    .in('thread_id', [...titleOf.keys()])
    .eq('type', 'document')
    .eq('status', 'published')
    .order('position', { ascending: true });
  if (dErr) throw new Error(`document steps: ${dErr.message}`);
  const ids = (docs ?? []).map((d) => d.id as string);
  if (!ids.length) return [];
  // The release log, through the one reader every participant surface uses.
  const sent = await releasedAt(ids, personIds);
  const byThread = new Map<string, ReleasedGroup>();
  for (const d of docs ?? []) {
    const at = sent.get(d.id as string);
    if (!at) continue;
    const content = (d.content ?? {}) as { external_url?: string; file_url?: string };
    const tid = d.thread_id as string;
    const g = byThread.get(tid) ?? { thread_id: tid, thread_title: titleOf.get(tid) ?? '', items: [] };
    g.items.push({ title: d.title as string, url: safeLinkUrl(content.external_url ?? content.file_url ?? null), sent_at: at });
    byThread.set(tid, g);
  }
  return [...byThread.values()];
}

/** Everything one member sees on one community's page. `tier_ids` comes from
 *  memberCommunities; without it (the admin's preview) the member row's own
 *  person is asked, by the same predicate. */
export async function communityView(
  member: { workspace_id: string; person_id: string; member_id: string; tier_ids?: string[]; category_ids?: string[] },
  now: Date = new Date(),
): Promise<CommunityView> {
  const ws = member.workspace_id;
  const liveRows = member.tier_ids && member.category_ids ? null : await liveMemberRows([member.person_id], ws);
  const held = member.tier_ids ?? tiersOf(liveRows!, ws);
  const heldCats = member.category_ids ?? (await categoriesOf(liveRows!, ws));
  const [{ data: wsRow }, page, { data: who }, { data: tierRows, error: tErr }, { data: catRows, error: cErr }] = await Promise.all([
    adminClient.from('workspace').select('name, brand_logo_url').eq('id', ws).maybeSingle(),
    readMemberPage(ws),
    // For the intro's tags only — the member's own name and tier.
    adminClient
      .from('membership_member')
      .select('tier:tier_id (name), person:person_id (first_name, last_name, email)')
      .eq('id', member.member_id)
      .maybeSingle(),
    // Names and order for the tier sections. Archived tiers too: a member
    // can still hold one, and its section is still theirs.
    held.length
      ? adminClient.from('membership_tier').select('id, name, sort_order').eq('workspace_id', ws).in('id', held).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    heldCats.length
      ? adminClient.from('membership_directory_category').select('id, name, sort_order').eq('workspace_id', ws).in('id', heldCats).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);
  if (tErr) throw new Error(`tiers: ${tErr.message}`);
  if (cErr) throw new Error(`categories: ${cErr.message}`);

  // The member's own live places in this community, and the documents their
  // threads have released to them — the same two readers the Files page uses.
  const { all: places, live: everywhere } = await threadPlaces([member.person_id]);
  const live = everywhere.filter((p) => p.workspace_id === ws);
  const threadIds = live.map((p) => p.thread_id);
  const titleOf = new Map(live.map((p) => [p.thread_id, p.title]));
  const threadDocuments: CommunityView['thread_documents'] = (await releasedThreadDocuments([member.person_id], live)).map((g) => ({
    thread_title: g.thread_title,
    items: g.items,
  }));

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
  const tags = memberTagValues({
    firstName,
    lastName: person?.last_name ?? null,
    email: person?.email ?? null,
    community,
    tier: one<{ name?: string | null }>(who?.tier)?.name ?? null,
    nextEvent: next?.title ?? null,
  });
  const intro = page.intro_html ? fillMemberPageTags(page.intro_html, tags) : null;
  const tierSections = ((tierRows ?? []) as { id: string; name: string }[])
    .filter((t) => page.tier_intros[t.id]?.trim())
    .map((t) => ({ tier_id: t.id, tier_name: t.name, intro_html: fillMemberPageTags(page.tier_intros[t.id]!, tags) }));
  const categorySections = ((catRows ?? []) as { id: string; name: string }[])
    .filter((x) => page.category_intros[x.id]?.trim())
    .map((x) => ({ category_id: x.id, category_name: x.name, intro_html: fillMemberPageTags(page.category_intros[x.id]!, tags) }));

  return {
    workspace_id: ws,
    name: community,
    logo_url: (wsRow?.brand_logo_url as string | null | undefined) ?? null,
    intro_html: intro,
    tier_sections: tierSections,
    category_sections: categorySections,
    documents: page.documents.filter((d) => visibleTo(d, { tier_ids: held, category_ids: heldCats })).map((d) =>
      isLink(d)
        ? { id: d.id, title: d.title, kind: 'link' as const, url: d.url }
        : { id: d.id, title: d.title, kind: 'file' as const, mime: d.mime, bytes: d.bytes },
    ),
    thread_documents: threadDocuments,
    next,
  };
}

/**
 * The values the member page fills, by canonical key of THE registry
 * (@thefibre/shared/merge-tokens). Pure, so a test can hold it against the
 * registry's member-page list: every tag offered there is filled here.
 */
export function memberTagValues(v: {
  firstName: string;
  lastName: string | null;
  email: string | null;
  community: string;
  tier: string | null;
  nextEvent: string | null;
}): Record<string, string> {
  // A name derived from the mailbox is capitalised, as the welcome email
  // does; a typed name is left as its owner wrote it.
  const first = v.firstName ? greetingName(v.firstName, v.email) : '';
  return {
    first_name: first,
    last_name: v.lastName ?? '',
    full_name: [first, v.lastName ?? ''].filter(Boolean).join(' '),
    community: v.community,
    tier: v.tier ?? '',
    next_event: v.nextEvent ?? '',
    // The member's own page — as text: the intro is the admin's HTML and a
    // value never becomes markup.
    'my.thread': myThreadUrl(),
  };
}

