// Computes the list of apps to show in the app switcher: ones that are
// (a) activated for the workspace, (b) the user has membership for, AND
// (c) marked available in the shared branding registry. Names + URLs come
// from @thefibre/shared so a rename is a one-file change.
//
// URLs go through crossAppHref: a same-apex target stays a plain absolute
// URL; a target on the other apex (the thethread.app split) becomes a
// relative /sso/hop link that carries the session across. `currentApp` is
// the slug of the app THIS copy runs in — passed by the layout, so the six
// copies of this file stay byte-identical.

import { APPS, type AppId, APP_IDS } from '@thefibre/shared';
import { crossAppHref } from '@thefibre/shared/sso-hop';
import type { AppEntry } from '@/components/shell/app-switcher';

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
  currentApp,
  memberships,
  workspaceApps,
}: {
  currentApp: AppId;
  memberships: Membership[];
  workspaceApps: WorkspaceApp[];
}): AppEntry[] {
  const memberSlugs = new Set(
    memberships.map((m) => slugOf(m.app)).filter((s): s is string => !!s),
  );
  const activatedSlugs = new Set(
    workspaceApps
      .filter((w) => !w.deactivated_at)
      .map((w) => slugOf(w.app))
      .filter((s): s is string => !!s),
  );

  const order: AppId[] = [
    'fibre-platform',
    ...APP_IDS.filter((s) => s !== 'fibre-platform'),
  ];
  const out: AppEntry[] = [];

  for (const slug of order) {
    const meta = APPS[slug];
    if (!meta.available) continue;
    // Platform is always included. Delivery apps need activation + membership.
    if (
      slug !== 'fibre-platform' &&
      !(activatedSlugs.has(slug) && memberSlugs.has(slug))
    ) {
      continue;
    }
    out.push({ slug, name: meta.name, url: crossAppHref(currentApp, slug, process.env) });
  }
  return out;
}
