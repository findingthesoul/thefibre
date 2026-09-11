// The public listing page body, shared between its two addresses
// (docs/brief-workspace-urls.md):
//
//   /{owner}              organiser · team · workspace listing
//   /{workspace}/{organiser}   the organiser INSIDE the workspace
//
// Presentational server component — both routes fetch and hand the payload
// here so the render never forks.
//
// Since 2026-09-11 it is a DISPATCHER: the workspace picks one of four
// designs in Settings → Website and this chooses the renderer. The themes
// live in ./themes.tsx with the reasoning for each; what stays here is the
// mapping from a payload to the props every theme takes, so a new theme is
// one entry in THEMES and nothing else.

import Link from 'next/link';
import { PLAIN_SITE, type PublicSite } from '@/lib/public-site';
import { THEMES } from './themes';
import type { PublicThreadListItem } from './threads-grid';

export type PublicOrganiser = {
  id?: string;
  slug: string;
  display_name: string | null;
  bio?: string | null;
  photo_url?: string | null;
};

export function OrganiserListing({
  organiser,
  threads,
  baseSlug,
  workspace = null,
  site = null,
}: {
  organiser: PublicOrganiser;
  threads: PublicThreadListItem[];
  /** The owner slug thread links (and the enrol popup) live under —
   *  the workspace's for a workspace listing, else the organiser's. */
  baseSlug: string;
  /** Set on the /{workspace}/{organiser} form: names the workspace the
   *  organiser is listed within and links back to its page. */
  workspace?: { slug: string; name: string | null } | null;
  /** The workspace's site design. Null (an older payload) = the plain page. */
  site?: PublicSite | null;
}) {
  const name = organiser.display_name ?? organiser.slug;
  const resolved = site ?? PLAIN_SITE;
  const Theme = THEMES[resolved.theme] ?? THEMES.plain;

  // On /{workspace}/{organiser} the nav's home link and the contact page
  // belong to the WORKSPACE — it owns the site — while thread links still
  // live under baseSlug. They are the same slug everywhere else.
  const ownerSlug = workspace?.slug ?? baseSlug;

  return (
    <Theme
      site={resolved}
      name={name}
      bio={organiser.bio ?? null}
      photoUrl={organiser.photo_url ?? null}
      baseSlug={baseSlug}
      ownerSlug={ownerSlug}
      threads={threads}
      crumb={
        workspace ? (
          <nav className="mb-8 text-sm">
            <Link href={`/${workspace.slug}`} className="opacity-70 hover:opacity-100">
              ← {workspace.name ?? workspace.slug}
            </Link>
          </nav>
        ) : undefined
      }
    />
  );
}
