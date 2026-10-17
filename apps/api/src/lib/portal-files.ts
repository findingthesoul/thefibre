// THE FILES PAGE in my.thread (Sjoerd 2ij, 2026-10-14: "in my.thread ->
// files or documents"). Every document one verified address may see, in one
// list: per community, its member page's documents first, then one group per
// thread with the documents that thread has released to them.
//
// NO RULE OF ITS OWN. Each item is admitted by the reader that already admits
// it elsewhere:
//   · community documents — memberCommunities (active/grace, every tier and
//     directory category held) and visibleTo, exactly as the community page and signedDocumentUrl;
//   · thread documents — threadPlaces (a LIVE place) and
//     releasedThreadDocuments (the thread's own trigger has sent it to them),
//     exactly as the community page.
// A stored file is never addressed here: my.thread opens it through the
// existing /community-document proxy, which signs for 60 seconds after the
// same checks. Links pass safeLinkUrl (at write for the member page, at read
// for a thread step); a step with no safe link is left out.

import { adminClient } from '../db.js';
import { personsForEmail } from './portal-agenda.js';
import {
  isDrive,
  isLink,
  memberCommunities,
  readMemberPage,
  releasedThreadDocuments,
  threadPlaces,
  visibleTo,
  type PageDocument,
  type ReleasedGroup,
} from './member-page.js';

export type CommunityFile =
  | { id: string; title: string; kind: 'file'; mime: string; bytes: number }
  | { id: string; title: string; kind: 'link'; url: string }
  // A connected Drive folder (2026-10-17); browsed through the API by entry id.
  | { id: string; title: string; kind: 'drive' };

export type FilesGroup = {
  workspace_id: string;
  name: string;
  logo_url: string | null;
  /** The community's own documents, in the admin's order. Empty for a
   *  workspace where the person holds a thread place but no membership. */
  community: CommunityFile[];
  /** Released document steps, per thread, by thread title. */
  threads: { thread_id: string; thread_title: string; items: { title: string; url: string; sent_at: string }[] }[];
};

/** Pure: put the admitted pieces into the page's shape and order —
 *  communities by name; documents as the admin dragged them; threads by
 *  title; steps as the thread orders them. Nothing empty survives. */
export function groupFiles(input: {
  workspaces: { id: string; name: string; logo_url: string | null }[];
  community: { workspace_id: string; documents: PageDocument[] }[];
  threads: (ReleasedGroup & { workspace_id: string })[];
}): FilesGroup[] {
  const groups = new Map<string, FilesGroup>();
  const ws = new Map(input.workspaces.map((w) => [w.id, w]));
  const group = (id: string): FilesGroup => {
    let g = groups.get(id);
    if (!g) {
      const w = ws.get(id);
      g = { workspace_id: id, name: w?.name ?? '', logo_url: w?.logo_url ?? null, community: [], threads: [] };
      groups.set(id, g);
    }
    return g;
  };
  for (const c of input.community) {
    if (!c.documents.length) continue;
    group(c.workspace_id).community.push(
      ...c.documents.map((d): CommunityFile =>
        isLink(d)
          ? { id: d.id, title: d.title, kind: 'link', url: d.url }
          : isDrive(d)
            ? { id: d.id, title: d.title, kind: 'drive' }
            : { id: d.id, title: d.title, kind: 'file', mime: d.mime, bytes: d.bytes },
      ),
    );
  }
  for (const t of input.threads) {
    const items = t.items.filter((i): i is { title: string; url: string; sent_at: string } => !!i.url);
    if (!items.length) continue;
    group(t.workspace_id).threads.push({ thread_id: t.thread_id, thread_title: t.thread_title, items });
  }
  const out = [...groups.values()];
  for (const g of out) g.threads.sort((a, b) => a.thread_title.localeCompare(b.thread_title));
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Everything one verified address may open, grouped. */
export async function filesFor(email: string): Promise<FilesGroup[]> {
  const persons = await personsForEmail(email);
  const personIds = persons.map((p) => p.id);
  if (!personIds.length) return [];

  const [mine, { live }] = await Promise.all([memberCommunities(email), threadPlaces(personIds)]);

  const community = await Promise.all(
    mine.map(async (m) => ({
      workspace_id: m.workspace_id,
      documents: (await readMemberPage(m.workspace_id)).documents.filter((d) => visibleTo(d, m)),
    })),
  );
  const wsOf = new Map(live.map((p) => [p.thread_id, p.workspace_id]));
  const released = (await releasedThreadDocuments(personIds, live)).map((g) => ({ ...g, workspace_id: wsOf.get(g.thread_id) ?? '' }));

  const ids = [...new Set([...community.map((c) => c.workspace_id), ...released.map((r) => r.workspace_id)])].filter(Boolean);
  const { data: wsRows, error } = ids.length
    ? await adminClient.from('workspace').select('id, name, brand_logo_url').in('id', ids)
    : { data: [], error: null };
  if (error) throw new Error(`files workspaces: ${error.message}`);
  return groupFiles({
    workspaces: ((wsRows ?? []) as { id: string; name: string; brand_logo_url: string | null }[]).map((w) => ({ id: w.id, name: w.name, logo_url: w.brand_logo_url ?? null })),
    community,
    threads: released,
  });
}
