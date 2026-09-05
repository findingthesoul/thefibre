import { appUrl } from '@thefibre/shared';
import { fetchCatalog, PublicApiError } from '@/lib/public-api';
import { isLocale, t, toLocale, type Locale } from '@/lib/i18n';

// Single join button for iframes — ?workspace=<slug>&label=<text>. Links to
// the public join page in the top window.
//
// ?lang= (validated) wins, else the workspace's own page language from the
// catalog, else English. ?theme is accepted but ignored — embeds always
// render light (see ../layout.tsx).

export default async function EmbedButtonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const workspaceSlug = typeof sp.workspace === 'string' ? sp.workspace : null;
  const langParam = typeof sp.lang === 'string' && isLocale(sp.lang) ? sp.lang : null;

  if (!workspaceSlug) {
    return <p className="me-error text-sm text-ink-subtle">Missing ?workspace=&lt;slug&gt;.</p>;
  }

  // Confirm the workspace exists and has Membership on — a dead button on a
  // live website is worse than a clear note.
  let workspaceLocale: string | null = null;
  try {
    const catalog = await fetchCatalog(workspaceSlug);
    workspaceLocale = catalog?.locale ?? null;
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) {
      return (
        <p className="me-error text-sm text-ink-subtle">
          {t(langParam, 'community_not_found')}
        </p>
      );
    }
    throw e;
  }

  const locale: Locale = langParam ?? toLocale(workspaceLocale);
  const label =
    typeof sp.label === 'string' && sp.label.trim() ? sp.label : t(locale, 'become_member');
  // Propagate an explicitly requested language to the join page; without
  // ?lang the join page resolves the same workspace language on its own.
  const langQuery = langParam ? `?lang=${langParam}` : '';

  return (
    <a
      href={`${appUrl('membership', process.env)}/${encodeURIComponent(workspaceSlug)}${langQuery}`}
      target="_top"
      className="me-btn inline-flex items-center justify-center rounded-md bg-ink px-5 h-10 text-sm font-medium text-ink-inverse hover:opacity-90"
    >
      {label}
    </a>
  );
}
