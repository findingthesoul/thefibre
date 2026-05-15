// Computes the list of apps to show in the app switcher: the ones (a)
// activated for the current workspace, (b) the current user has membership
// for, AND (c) actually live (a real subdomain serves them). Fibre Sales /
// Fibre Learn are intentionally excluded until they're built.

import type { AppEntry } from '@/components/shell/app-switcher';

type Meta = { name: string; url: string; available: boolean };

export const APP_META: Record<string, Meta> = {
  'fibre-platform': { name: 'The Fibre', url: 'https://thefibre.app', available: true },
  'fibre-meet': { name: 'Fibre Meet', url: 'https://meet.thefibre.app', available: true },
  'the-thread': { name: 'The Thread', url: 'https://thread.thefibre.app', available: true },
  'fibre-sales': { name: 'Fibre Sales', url: 'https://sales.thefibre.app', available: false },
  'fibre-learn': { name: 'Fibre Learn', url: 'https://learn.thefibre.app', available: false },
};

type Membership = { app: { slug: string } | { slug: string }[] | null };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

function slugOf(o: { slug: string } | { slug: string }[] | null): string | null {
  if (!o) return null;
  return Array.isArray(o) ? o[0]?.slug ?? null : o.slug;
}

export function buildAppList({
  memberships,
  workspaceApps,
}: {
  memberships: Membership[];
  workspaceApps: WorkspaceApp[];
}): AppEntry[] {
  const memberSlugs = new Set(
    memberships
      .map((m) => slugOf(m.app))
      .filter((s): s is string => !!s),
  );
  const activatedSlugs = new Set(
    workspaceApps
      .filter((w) => !w.deactivated_at)
      .map((w) => slugOf(w.app))
      .filter((s): s is string => !!s),
  );

  const slugs: string[] = ['fibre-platform'];
  for (const s of ['fibre-meet', 'the-thread', 'fibre-sales', 'fibre-learn']) {
    const meta = APP_META[s];
    if (!meta?.available) continue;
    if (activatedSlugs.has(s) && memberSlugs.has(s)) slugs.push(s);
  }

  return slugs
    .map((slug) => {
      const meta = APP_META[slug];
      if (!meta) return null;
      return { slug, name: meta.name, url: meta.url };
    })
    .filter((x): x is AppEntry => !!x);
}
