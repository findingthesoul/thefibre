import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { PublicThreadListItem } from './threads-grid';
import { OrganiserListing, type PublicOrganiser } from './organiser-listing';
import type { PublicSite } from '@/lib/public-site';

// The first URL segment is any public owner slug — workspace, team or
// organiser (docs/brief-workspace-urls.md D3: one namespace, workspaces
// win; the API resolver applies the precedence).
/** The owner's own name and words on a pasted link, rather than the app's.
 *  The card is opengraph-image.tsx alongside this file. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ organiserSlug: string }>;
}): Promise<Metadata> {
  const { organiserSlug } = await params;
  const data = await publicFetch<{
    organiser: { display_name: string | null; bio: string | null };
    site?: { name: string | null; headline: string | null } | null;
  }>(`/api/v1/thread/public/organiser/${organiserSlug}`).catch(() => null);
  if (!data) return {};
  const title = data.site?.name ?? data.organiser.display_name ?? organiserSlug;
  // A meta description is plain text by definition — markup in it would be
  // printed by search engines and social cards verbatim. `organiser.bio` is
  // published as plain text for exactly this kind of reader; the formatted
  // version is `bio_html`, which only a renderer takes.
  const description = data.site?.headline ?? data.organiser.bio ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: title },
  };
}

export default async function PublicOrganiserPage({
  params,
}: {
  params: Promise<{ organiserSlug: string }>;
}) {
  const { organiserSlug } = await params;

  let data: { organiser: PublicOrganiser; threads: PublicThreadListItem[]; site?: PublicSite };
  try {
    data = await publicFetch(`/api/v1/thread/public/organiser/${organiserSlug}`);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <OrganiserListing
      organiser={data.organiser}
      threads={data.threads}
      baseSlug={data.organiser.slug}
      site={data.site ?? null}
    />
  );
}
