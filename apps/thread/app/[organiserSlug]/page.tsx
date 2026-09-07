import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { PublicThreadListItem } from './threads-grid';
import { OrganiserListing, type PublicOrganiser } from './organiser-listing';

// The first URL segment is any public owner slug — workspace, team or
// organiser (docs/brief-workspace-urls.md D3: one namespace, workspaces
// win; the API resolver applies the precedence).
export default async function PublicOrganiserPage({
  params,
}: {
  params: Promise<{ organiserSlug: string }>;
}) {
  const { organiserSlug } = await params;

  let data: { organiser: PublicOrganiser; threads: PublicThreadListItem[] };
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
    />
  );
}
