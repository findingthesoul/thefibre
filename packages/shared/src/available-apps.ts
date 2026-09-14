// The app switcher's list: which apps this user, in this workspace, on this
// host, can switch to — and where each one lives.
//
// ONE implementation (2026-09-14). Until then seven byte-identical copies of
// lib/available-apps.ts sat in seven apps, and they had already drifted:
// Connections learned to pass the serving host so a staging menu stays on
// staging (Sjoerd, 2026-09-13: "The menu brings me from .tech to .app"),
// and the other six kept sending people to production. A copy is a bug
// waiting for the fix to be applied once.
//
// Rules, unchanged: an app appears when it is (a) activated for the
// workspace, (b) the user holds an app_membership for it, and (c) the shared
// branding registry marks it available. The platform is always listed. Names
// and URLs come from the registry so a rename is a one-file change. Order is
// the canonical display order (Sjoerd 2026-09-07): platform first, then the
// family as the launcher poster reads.
//
// URLs go through crossAppHref: a same-apex target is a plain absolute URL; a
// target on the other apex becomes a relative /sso/hop link that carries the
// session across. `currentApp` is the slug of the app the caller runs in.

import { APPS, APP_DISPLAY_ORDER, APP_IDS, type AppId } from './index.js';
import { crossAppHref } from './sso-hop.js';
import type { AppEntry } from './ui/app-switcher.js';

/** How the API embeds a related app row: an object, or PostgREST's array form. */
type AppRef = { slug: string } | { slug: string }[] | null;
export type AppMembershipRow = { app: AppRef };
export type WorkspaceAppRow = { deactivated_at: string | null; app: AppRef };

function slugOf(o: AppRef): string | null {
  if (!o) return null;
  return Array.isArray(o) ? (o[0]?.slug ?? null) : o.slug;
}

export function buildAppList({
  currentApp,
  memberships,
  workspaceApps,
  host,
  env,
}: {
  currentApp: AppId;
  memberships: AppMembershipRow[];
  workspaceApps: WorkspaceAppRow[];
  /**
   * The host serving this page (`headers().get('host')`). Without it a
   * deployment that was never given its siblings' URLs points the whole
   * menu at PRODUCTION. See appUrl.
   */
  host?: string | null;
  /**
   * The app's `process.env` — required, not defaulted: without the
   * NEXT_PUBLIC_*_URL overrides every link resolves to production, which is
   * the trap this module exists to close.
   */
  env: Record<string, string | undefined>;
}): AppEntry[] {
  const memberSlugs = new Set(memberships.map((m) => slugOf(m.app)).filter((s): s is string => !!s));
  const activatedSlugs = new Set(
    workspaceApps
      .filter((w) => !w.deactivated_at)
      .map((w) => slugOf(w.app))
      .filter((s): s is string => !!s),
  );

  const out: AppEntry[] = [];
  for (const slug of APP_IDS) {
    const meta = APPS[slug];
    if (!meta.available) continue;
    if (slug !== 'fibre-platform' && !(activatedSlugs.has(slug) && memberSlugs.has(slug))) continue;
    out.push({ slug, name: meta.name, url: crossAppHref(currentApp, slug, env, undefined, host) });
  }

  const rank = (s: string) => {
    const i = APP_DISPLAY_ORDER.indexOf(s as (typeof APP_DISPLAY_ORDER)[number]);
    return i === -1 ? APP_DISPLAY_ORDER.length : i;
  };
  return out.sort((x, y) => rank(x.slug) - rank(y.slug));
}
