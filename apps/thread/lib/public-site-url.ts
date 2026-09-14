// The address of THIS workspace's public site — one place, because two
// screens now link to it (Settings → Website's Preview and the dashboard's
// "Your site") and they must never disagree about where it is.
//
// The workspace slug is the canonical owner of a workspace site
// (docs/brief-workspace-urls.md D1); the organiser's own slug is the fallback
// for a personal workspace. Server-only: it calls the API with the session.

import { apiFetch } from '@/lib/api';
import { THREAD_ORIGIN } from '@/lib/public-host';

export async function publicSite(): Promise<{ url: string | null; workspaceName: string | null }> {
  const brand = await apiFetch<{ slug: string | null; name: string | null }>(
    '/api/v1/workspace-brand',
  ).catch(() => ({ slug: null, name: null }));
  const slug =
    brand.slug ??
    (await apiFetch<{ slug: string }>('/api/v1/thread/me').catch(() => null))?.slug ??
    null;
  return { url: slug ? `${THREAD_ORIGIN}/${slug}` : null, workspaceName: brand.name };
}
