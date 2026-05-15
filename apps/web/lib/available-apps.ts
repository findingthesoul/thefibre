// Computes the list of apps to show in the app switcher: the ones (a)
// activated for the current workspace AND (b) the current user has membership
// for. The Fibre itself is always included (it's the platform).

import type { AppEntry } from '@/components/shell/app-switcher';

export const APP_META: Record<
  string,
  { name: string; url: string }
> = {
  'fibre-platform': { name: 'The Fibre', url: 'https://thefibre.app' },
  'fibre-meet': { name: 'Fibre Meet', url: 'https://meet.thefibre.app' },
  'the-thread': { name: 'The Thread', url: 'https://thread.thefibre.app' },
  'fibre-sales': { name: 'Fibre Sales', url: 'https://sales.thefibre.app' },
  'fibre-learn': { name: 'Fibre Learn', url: 'https://learn.thefibre.app' },
};

type Membership = {
  app: { slug: string } | { slug: string }[] | null;
};
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

  // Platform is always shown.
  const slugs: string[] = ['fibre-platform'];
  for (const s of ['fibre-meet', 'the-thread', 'fibre-sales', 'fibre-learn']) {
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
