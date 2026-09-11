import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { PublicThreadListItem } from '../threads-grid';
import { OrganiserListing, type PublicOrganiser } from '../organiser-listing';
import type { PublicSite } from '@/lib/public-site';
import { fetchPublicThread, PublicThreadView } from './thread-view';

// /{owner}/{thread} — the canonical thread address (personal · team ·
// workspace, docs/brief-workspace-urls.md D1). With ONE fallback: when no
// thread matches, /{workspace}/{organiser} lists that organiser's public
// threads within the workspace (D2). A thread wins the collision — if a
// thread slug equals an organiser slug in the same workspace, the thread
// page renders and the organiser listing stays reachable only while no
// such thread exists. Deliberate: thread addresses are the product.
export default async function PublicThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ organiserSlug: string; threadSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organiserSlug, threadSlug } = await params;
  // ?paid=success|cancelled — the return leg from Stripe Checkout.
  const sp = await searchParams;
  const paidNotice =
    sp.paid === 'success' ? ('success' as const) : sp.paid === 'cancelled' ? ('cancelled' as const) : null;

  const data = await fetchPublicThread(organiserSlug, threadSlug);
  if (data) return <PublicThreadView data={data} paidNotice={paidNotice} />;

  // No such thread — try segment1 as a WORKSPACE and segment2 as an
  // organiser inside it: the /{workspace}/{organiser} listing (D2).
  let listing: {
    workspace: { slug: string; name: string | null };
    organiser: PublicOrganiser;
    threads: PublicThreadListItem[];
    site?: PublicSite;
  };
  try {
    listing = await publicFetch(
      `/api/v1/thread/public/workspace/${organiserSlug}/organiser/${threadSlug}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <OrganiserListing
      organiser={listing.organiser}
      threads={listing.threads}
      // Workspace-scoped threads live under the WORKSPACE slug.
      baseSlug={listing.workspace.slug}
      workspace={listing.workspace}
      site={listing.site ?? null}
    />
  );
}
