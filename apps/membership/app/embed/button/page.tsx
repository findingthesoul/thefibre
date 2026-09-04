import { appUrl } from '@thefibre/shared';
import { fetchCatalog, PublicApiError } from '@/lib/public-api';

// Single join button for iframes — ?workspace=<slug>&label=<text>. Links to
// the public join page in the top window.

export default async function EmbedButtonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const workspaceSlug = typeof sp.workspace === 'string' ? sp.workspace : null;
  const label = typeof sp.label === 'string' && sp.label.trim() ? sp.label : 'Become a member';

  if (!workspaceSlug) {
    return <p className="me-error text-sm text-ink-subtle">Missing ?workspace=&lt;slug&gt;.</p>;
  }

  // Confirm the workspace exists and has Membership on — a dead button on a
  // live website is worse than a clear note.
  try {
    await fetchCatalog(workspaceSlug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) {
      return <p className="me-error text-sm text-ink-subtle">This community was not found.</p>;
    }
    throw e;
  }

  return (
    <a
      href={`${appUrl('membership', process.env)}/${encodeURIComponent(workspaceSlug)}`}
      target="_top"
      className="me-btn inline-flex items-center justify-center rounded-md bg-ink px-5 h-10 text-sm font-medium text-ink-inverse hover:opacity-90"
    >
      {label}
    </a>
  );
}
