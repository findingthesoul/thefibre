import { notFound } from 'next/navigation';
import { fetchPublicThread, PublicThreadView } from '../thread-view';

// /{workspace}/{organiser}/{thread} — the deeper address for a
// WORKSPACE-scoped thread (docs/brief-workspace-urls.md D2). An address,
// not a second scope: it resolves only when the middle segment matches the
// thread's creating organiser, and the rendered page carries a canonical
// link to the 2-segment form /{workspace}/{thread}.
//
// Param names are inherited from the parent segments ([organiserSlug] and
// [threadSlug] already exist as directories); here they mean:
//   organiserSlug = the WORKSPACE slug
//   threadSlug    = the creating ORGANISER's slug
//   deepSlug      = the THREAD slug
export default async function PublicWorkspaceThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ organiserSlug: string; threadSlug: string; deepSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organiserSlug: wsSlug, threadSlug: orgSlug, deepSlug } = await params;
  const sp = await searchParams;
  const paidNotice =
    sp.paid === 'success' ? ('success' as const) : sp.paid === 'cancelled' ? ('cancelled' as const) : null;

  // Fetched under the WORKSPACE slug — the resolver checks workspace first
  // (D3), so a hit here is already scoped to public_scope='workspace'
  // threads of that workspace.
  const data = await fetchPublicThread(wsSlug, deepSlug);
  if (!data) notFound();

  const { thread } = data;
  // The middle segment must name the thread's creating organiser.
  if (!thread.organiser_slug || thread.organiser_slug !== orgSlug) notFound();
  // Belt and braces: only workspace-scoped threads get the deeper address.
  // `public_scope` is optional on the payload (older API builds omit it) —
  // then fall back to the canonical slug: for a workspace-scoped thread it
  // is the workspace slug, which D3 guarantees no organiser slug can equal.
  const workspaceScoped =
    thread.public_scope != null
      ? thread.public_scope === 'workspace'
      : thread.canonical_owner_slug === wsSlug &&
        thread.canonical_owner_slug !== thread.organiser_slug;
  if (!workspaceScoped) notFound();

  return <PublicThreadView data={data} paidNotice={paidNotice} />;
}
