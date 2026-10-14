// Which thread a membership `thread` grant means — by ID, not by slug
// (item 5, 2026-10-14).
//
// A grant used to store what the organiser typed: a slug, often a whole
// public URL. Renaming the thread broke every grant pointing at it, silently:
// the worker stamped `error`, the member got nothing, and nobody was told.
// Now a grant stores the thread's id beside the slug; the id decides, and the
// slug is kept for showing a person which thread it is.
//
// For a grant that has only a slug (written before this), the slug is looked
// up in the grant's own workspace, then in the thread's slug HISTORY — and if
// that does not land on exactly one thread, it is reported, never guessed: a
// grant enrols people, and enrolling them in the wrong thread is worse than
// enrolling them in none.

import { adminClient } from '../db.js';
import { threadSlugFromConfig } from './thread-access.js';

export type ResolvedThread = { id: string; slug: string; program_id: string; workspace_id: string };
export type GrantThread =
  | { ok: true; thread: ResolvedThread; via: 'id' | 'slug' | 'history' }
  | { ok: false; reason: 'no_thread' | 'not_found' | 'ambiguous' };

const SELECT = 'id, slug, program_id, workspace_id';

export async function resolveGrantThread(
  workspaceId: string,
  config: Record<string, unknown> | null,
): Promise<GrantThread> {
  const id = typeof config?.thread_id === 'string' ? config.thread_id : null;
  if (id) {
    // Scoped to the workspace even by id: a grant can never reach a thread in
    // another community, whatever its config says.
    const { data, error } = await adminClient.from('thread_thread').select(SELECT).eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
    if (error) throw new Error(`grant thread by id: ${error.message}`);
    return data ? { ok: true, thread: data as ResolvedThread, via: 'id' } : { ok: false, reason: 'not_found' };
  }

  const slug = threadSlugFromConfig(config);
  if (!slug) return { ok: false, reason: 'no_thread' };
  const { data: bySlug, error } = await adminClient.from('thread_thread').select(SELECT).eq('workspace_id', workspaceId).eq('slug', slug);
  if (error) throw new Error(`grant thread by slug: ${error.message}`);
  // Slugs are unique per ORGANISER, not per workspace: two organisers can
  // both have "intro". Two matches is a question for a person, not a pick.
  if ((bySlug ?? []).length > 1) return { ok: false, reason: 'ambiguous' };
  if (bySlug?.length === 1) return { ok: true, thread: bySlug[0] as ResolvedThread, via: 'slug' };

  const old = await threadIdByOldSlug(workspaceId, slug);
  if (old === 'ambiguous') return { ok: false, reason: 'ambiguous' };
  if (!old) return { ok: false, reason: 'not_found' };
  const { data: moved, error: mErr } = await adminClient.from('thread_thread').select(SELECT).eq('id', old).maybeSingle();
  if (mErr) throw new Error(`grant thread by history: ${mErr.message}`);
  return moved ? { ok: true, thread: moved as ResolvedThread, via: 'history' } : { ok: false, reason: 'not_found' };
}

/** The thread that USED to answer to this slug in this workspace: null when
 *  none did, 'ambiguous' when more than one thread has worn it. */
export async function threadIdByOldSlug(workspaceId: string, slug: string): Promise<string | 'ambiguous' | null> {
  const { data, error } = await adminClient
    .from('thread_slug_history')
    .select('thread_id')
    .eq('workspace_id', workspaceId)
    .eq('old_slug', slug.toLowerCase());
  if (error) throw new Error(`slug history: ${error.message}`);
  const ids = [...new Set((data ?? []).map((r) => r.thread_id as string))];
  if (ids.length > 1) return 'ambiguous';
  return ids[0] ?? null;
}

/** Remember a thread's previous address when its slug changes. */
export async function recordSlugChange(threadId: string, workspaceId: string, oldSlug: string): Promise<void> {
  const { error } = await adminClient
    .from('thread_slug_history')
    .upsert(
      { thread_id: threadId, workspace_id: workspaceId, old_slug: oldSlug.toLowerCase(), changed_at: new Date().toISOString() },
      { onConflict: 'thread_id,old_slug' },
    );
  if (error) throw new Error(`slug history write: ${error.message}`);
}

/** The words a person reads when a grant does not resolve. */
export const GRANT_THREAD_PROBLEM: Record<Exclude<GrantThread, { ok: true }>['reason'], string> = {
  no_thread: 'This grant names no thread.',
  not_found: 'No thread with that address in this community — it may have been deleted.',
  ambiguous: 'More than one thread in this community answers to that address. Pick the thread again.',
};

/** What points at this thread from Members: grants (by id, or by its current
 *  slug for a grant not yet backfilled) and product links (by slug). For the
 *  editor's rename warning — a rename no longer breaks any of them (ids and
 *  the slug history), but the organiser should know they exist. */
export async function threadReferenceCounts(
  thread: { id: string; slug: string; workspace_id: string },
): Promise<{ grants: number; product_links: number }> {
  const [{ data: grants }, { data: products }] = await Promise.all([
    adminClient.from('membership_access_grant').select('config').eq('workspace_id', thread.workspace_id).eq('kind', 'thread'),
    adminClient.from('membership_product').select('links').eq('workspace_id', thread.workspace_id),
  ]);
  const grantsHere = (grants ?? []).filter((g) => {
    const c = (g.config ?? {}) as Record<string, unknown>;
    return c.thread_id ? c.thread_id === thread.id : threadSlugFromConfig(c) === thread.slug;
  }).length;
  let links = 0;
  for (const p of products ?? []) {
    const list = Array.isArray(p.links) ? (p.links as { kind?: unknown; ref?: unknown }[]) : [];
    links += list.filter((l) => l?.kind === 'thread' && threadSlugFromConfig({ thread_slug: l.ref }) === thread.slug).length;
  }
  return { grants: grantsHere, product_links: links };
}
