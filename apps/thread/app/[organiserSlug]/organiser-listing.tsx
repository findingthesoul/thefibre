import { OrgPeople, type OrgPerson } from './org-people';
import { OrgLinks, type OrgLink } from './org-links';
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
import type { CardDates } from '@thefibre/shared/thread-dates';

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
  cardDates,
  baseSlug,
  workspace = null,
  site = null,
  people = [],
  organisations = [],
  ownerKind = 'organiser',
  // ENGLISH, like `EMPTY` in themes.tsx a few lines away, and for the same
  // reason: the page SHELL has no locale. The public catalogue is reached
  // per THREAD (threads-grid resolves th.language), and a workspace page is
  // not one thread. Adding a catalogue key no caller could pass a locale to
  // would look translated without being translatable. When the shell gains a
  // language, this and EMPTY move together.
  peopleTitle = 'People',
  // English for the same reason — see the note above.
  organisationsTitle = 'Runs these with',
}: {
  organiser: PublicOrganiser;
  threads: PublicThreadListItem[];
  /** The workspace's card date choice (card_dates on the page payload). */
  cardDates?: CardDates | undefined;
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
  /** The organisations a PERSON runs threads with. Empty on every other kind
   *  of page, and empty on an older API. */
  organisations?: OrgLink[];
  /** The heading above the organisations. */
  organisationsTitle?: string;
  /** Which of the three this page is. Drives the one decision below that
   *  cannot be made from the data alone: whether to wear the organisation's
   *  clothes. */
  ownerKind?: 'organiser' | 'team' | 'workspace';
}) {
  const name = organiser.display_name ?? organiser.slug;

  // ── THE SPLIT (docs/person-and-organisation-pages.md §2) ────────────────
  //
  // Sjoerd, 2026-10-04, reading his own page: the soul.com logo, the line
  // "courses… by soul.com", and underneath it his own first-person About me.
  // "Half me the person, half me the organiser, confusing. Maybe these are
  // two things."
  //
  // They are. A PERSON's page keeps the THEME — a visual language says
  // "related to", not "belongs to" — and sheds every ingredient that belongs
  // to the organisation: logo, site name, headline, intro, hero, footer and
  // the site's own links and contact page.
  //
  // Everything then falls back to the person by itself, because the themes
  // already read `site.headline ?? p.name`, `site.logo_url ?? p.photoUrl`
  // and `site.name ?? ownerName`. Blanking the wrapper is the whole change;
  // no theme needed a line.
  //
  // The URL does not move and the threads do not move. What changes is what
  // surrounds them, which is exactly what he said was confusing.
  const wrapper = site ?? PLAIN_SITE;
  const resolved =
    ownerKind === 'organiser'
      ? {
          ...wrapper,
          name: null,
          logo_url: null,
          hero_url: null,
          headline: null,
          intro: null,
          footer_note: null,
          links: [],
          contact_enabled: false,
          contact_intro: null,
        }
      : wrapper;
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
      cardDates={cardDates}
      below={
        ownerKind === 'organiser' ? (
          <OrgLinks organisations={organisations} label={organisationsTitle} />
        ) : (
          <OrgPeople people={people} title={peopleTitle} />
        )
      }
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
