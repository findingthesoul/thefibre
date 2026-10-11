import { OrgPeople, type OrgPerson } from './org-people';
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
  /** Plain text — a meta description, an OG image, an email. */
  bio?: string | null;
  /** The same bio as markup, which is what a theme renders. */
  bio_html?: string | null;
  photo_url?: string | null;
};

export function OrganiserListing({
  organiser,
  threads,
  baseSlug,
  workspace = null,
  site = null,
  people = [],
  // ENGLISH, like `EMPTY` in themes.tsx a few lines away, and for the same
  // reason: the page SHELL has no locale. The public catalogue is reached
  // per THREAD (threads-grid resolves th.language), and a workspace page is
  // not one thread. Adding a catalogue key no caller could pass a locale to
  // would look translated without being translatable. When the shell gains a
  // language, this and EMPTY move together.
  peopleTitle = 'People',
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
  /** Who is listed on this organisation's page. Empty on a person's or a
   *  team's page, and empty on an older API that does not send it — both of
   *  which render nothing, so neither needs a special case. */
  people?: OrgPerson[];
  /** The heading above them, from the public page's own catalogue. */
  peopleTitle?: string;
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
      bioHtml={organiser.bio_html ?? null}
      photoUrl={organiser.photo_url ?? null}
      baseSlug={baseSlug}
      ownerSlug={ownerSlug}
      threads={threads}
      people={<OrgPeople people={people} title={peopleTitle} />}
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
