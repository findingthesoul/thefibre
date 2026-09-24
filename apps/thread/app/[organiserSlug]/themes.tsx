// The site designs, plus the plain page that was here first.
//
// Sjoerd, 2026-09-11: "on workspace level.. provide three different design
// styles... A festival: full page hero image with a title and navbar at the
// top. A second one more corporate. A third one more community like style.
// Really good designs."
//
// Each theme is a LAYOUT, not a palette. They differ in what they put first,
// because they are for visitors arriving in different states:
//
//   festival   a stranger who has to feel something before they read
//              → the image is the page; the words sit on top of it
//   corporate  someone sent here to find a date and a price
//              → no decoration above the fold; dates in a column you can scan
//   community  someone who already belongs and wants to know what is on
//              → the host's face and voice first, the programme as a warm list
//
// 'plain' is exactly the page that existed before this file, kept as the
// default so nothing anybody had already published changed the day the
// themes shipped. It is also the honest choice for a workspace that wants a
// listing and not a website.
//
// Two more arrived on 2026-09-24, when Sjoerd asked for the event pages to
// be "more diverse... rhyming with the design of the template":
//
//   studio     the brand's own language, for a practice rather than an event
//              -> the fallen thread and the cut-outs from thethread.app, on a
//                 white ground, with no photograph needed at all
//   journal    someone following a body of work over time
//              -> dated entries under a rule, the year as the only ornament
//
// The four that existed differed in WHERE THE WEIGHT SITS — hero, table,
// face — but all four wore the same neutral palette and the same drawn
// nothing, so a workspace choosing between them was choosing a layout rather
// than a character. These two are the first with a voice: one is the
// marketing site's hand, the other is typography doing the whole job.
//
// Both are token-pure. The website's yellow is NOT here: the only yellow in
// this codebase is `save`, which means committing and nothing else
// (docs/brand-design.md), and borrowing it for decoration would make every
// Save button in the product mean slightly less.
//
// What is deliberately NOT here: per-page layout. Sjoerd named the future —
// "the drag and drop of the certificates for an very chique design tool" —
// and asked for "a basic structure to use templates" now. A theme is code, a
// template will be a document, and the ingredients on thread_settings are
// what both read from.

import Link from 'next/link';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { FOOTER_LINKS } from '@thefibre/shared';
import type { PublicSite } from '@/lib/public-site';
import { DrawnThread, Shape } from '@thefibre/shared/ui/marks';
import { ThreadsGrid, type PublicThreadListItem } from './threads-grid';
import { SiteNav, SiteFooter } from './site-chrome';

export type ThemeProps = {
  site: PublicSite;
  /** The owner as displayed: an organiser's name, a team's, a workspace's. */
  name: string;
  bio: string | null;
  photoUrl: string | null;
  /** The slug thread links live under. */
  baseSlug: string;
  /** The slug the nav's home link and the contact page live under — the same
   *  thing as baseSlug on every route except /{workspace}/{organiser}. */
  ownerSlug: string;
  threads: PublicThreadListItem[];
  /** Rendered above everything: the "← back to the workspace" line. */
  crumb?: React.ReactNode;
};

const EMPTY = 'Nothing public right now.';

// ── plain ─────────────────────────────────────────────────────────────────
// Untouched from before the themes existed, with one addition: the contact
// link, when a workspace has turned the form on but not chosen a design.

export function PlainTheme(p: ThemeProps) {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-2xl px-6 py-16">
        {p.crumb}
        <header className="flex items-center gap-4">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photoUrl}
              alt={p.name}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-line"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised ring-1 ring-line text-xl font-medium text-ink-subtle">
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{p.name}</h1>
            {p.bio && <p className="mt-1 text-sm text-ink-subtle leading-relaxed">{p.bio}</p>}
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">Threads</h2>
          {p.threads.length === 0 && <p className="mt-3 text-sm text-ink-subtle">{EMPTY}</p>}
          <ThreadsGrid organiserSlug={p.baseSlug} threads={p.threads} />
        </section>

        <footer className="mt-16 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span>
            Powered by <span className="font-medium">Thread</span> · The Fibre
          </span>
          {p.site.contact_enabled && (
            <Link href={`/${p.ownerSlug}/contact`} className="hover:text-ink">
              Contact
            </Link>
          )}
          <a href={FOOTER_LINKS.privacy} className="hover:text-ink">
            Privacy
          </a>
        </footer>
      </main>
    </div>
  );
}

// ── festival ──────────────────────────────────────────────────────────────
// The image IS the page. Nav floats over it, the headline sits in it, and
// nothing else competes until you have scrolled past.

export function FestivalTheme(p: ThemeProps) {
  const headline = p.site.headline ?? p.name;
  return (
    <div className="min-h-screen bg-surface">
      <header className="relative isolate flex min-h-[78vh] flex-col justify-end overflow-hidden">
        {p.site.hero_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.site.hero_url}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
            {/* The scrim is what makes white text legible over a photograph
                nobody chose for its contrast. Bottom-weighted so the middle
                of the image survives, plus a shallow second one at the top
                purely for the navbar — checked on staging against a photo of
                a bright ceiling, where white-on-white was exactly the
                failure. */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
            <div className="absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-black/55 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700" />
        )}
        <SiteNav site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />
        <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-32">
          {p.crumb && <div className="mb-6 text-white/70">{p.crumb}</div>}
          <h1 className="max-w-3xl text-[clamp(2.5rem,7vw,5rem)] font-semibold leading-[1.03] tracking-tight text-white text-balance">
            {headline}
          </h1>
          {p.site.intro ? (
            <RichText
              html={p.site.intro}
              className="mt-6 max-w-xl text-lg leading-relaxed text-white/85"
            />
          ) : (
            p.bio && <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">{p.bio}</p>
          )}
          {p.threads.length > 0 && (
            <a
              href="#programme"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-white/90 transition-colors"
            >
              See what’s on
            </a>
          )}
        </div>
      </header>

      <main id="programme" className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Programme</h2>
        {p.threads.length === 0 && <p className="mt-4 text-sm text-ink-subtle">{EMPTY}</p>}
        <ThreadsGrid organiserSlug={p.baseSlug} threads={p.threads} variant="poster" />
      </main>

      <SiteFooter site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />
    </div>
  );
}

// ── corporate ─────────────────────────────────────────────────────────────
// Restraint on purpose. A thin band, a serious headline, and a table-like
// listing where the date is the first thing in the row.

export function CorporateTheme(p: ThemeProps) {
  return (
    <div className="min-h-screen bg-surface">
      <SiteNav site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />

      <header className="border-b border-line bg-surface-sunken">
        <div className="mx-auto max-w-5xl px-6 py-16">
          {p.crumb}
          <h1 className="max-w-2xl text-[clamp(1.9rem,4vw,2.9rem)] font-medium leading-tight tracking-tight text-balance">
            {p.site.headline ?? p.name}
          </h1>
          {p.site.intro ? (
            <RichText
              html={p.site.intro}
              className="mt-5 max-w-2xl text-base leading-relaxed text-ink-subtle"
            />
          ) : (
            p.bio && (
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-subtle">{p.bio}</p>
            )
          )}
        </div>
      </header>

      {p.site.hero_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.site.hero_url} alt="" className="h-64 w-full object-cover" />
      )}

      <main className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Upcoming</h2>
        {p.threads.length === 0 && <p className="mt-4 text-sm text-ink-subtle">{EMPTY}</p>}
        <ThreadsGrid organiserSlug={p.baseSlug} threads={p.threads} variant="row" />
      </main>

      <SiteFooter site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />
    </div>
  );
}

// ── community ─────────────────────────────────────────────────────────────
// The host first. A face, a voice, then what is on — the order a member
// reads in, because they are not deciding whether to trust you.

export function CommunityTheme(p: ThemeProps) {
  const avatar = p.site.logo_url ?? p.photoUrl;
  return (
    <div className="min-h-screen bg-surface-sunken">
      <SiteNav site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />

      <header className="relative overflow-hidden">
        {p.site.hero_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.site.hero_url} alt="" className="h-56 w-full object-cover sm:h-72" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-sunken" />
          </>
        )}
        <div
          className={`mx-auto max-w-3xl px-6 text-center ${
            p.site.hero_url ? '-mt-16 relative pb-14' : 'pt-20 pb-14'
          }`}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={p.name}
              className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-surface-sunken shadow-sm"
            />
          ) : (
            <span className="mx-auto inline-flex h-28 w-28 items-center justify-center rounded-full bg-surface-raised ring-4 ring-surface-sunken text-3xl font-medium text-ink-subtle">
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <h1 className="mt-6 text-[clamp(1.75rem,4vw,2.6rem)] font-medium tracking-tight text-balance">
            {p.site.headline ?? p.name}
          </h1>
          {p.site.intro ? (
            <RichText
              html={p.site.intro}
              className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-subtle"
            />
          ) : (
            p.bio && (
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-subtle">
                {p.bio}
              </p>
            )
          )}
          {p.crumb && <div className="mt-6">{p.crumb}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-16">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">What’s on</h2>
        {p.threads.length === 0 && <p className="mt-4 text-sm text-ink-subtle">{EMPTY}</p>}
        <ThreadsGrid organiserSlug={p.baseSlug} threads={p.threads} />
      </main>

      <SiteFooter site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />
    </div>
  );
}

// ── studio ────────────────────────────────────────────────────────────────
// The house hand. A white ground, one line falling through the page behind
// everything, and a cut-out sitting off the margin — the vocabulary of
// thethread.app, which until now stopped at the marketing site's edge.
//
// It is the only design that needs no photograph. festival is the other
// image-led theme and it is unusable without a good one; a practitioner with
// nothing but their words had four themes that all looked administrative.
//
// The line is two segments with an x-fraction handoff (see DrawnThread): it
// leaves the header low-right and enters the programme there. One path
// across both sections would break the moment the header reflowed.

const STUDIO_HEADER_PATH =
  'M8 4 C30 22 18 46 34 62 C52 80 76 70 88 86 C97 98 94 112 86 120';
const STUDIO_MAIN_PATH =
  'M86 0 C78 16 54 14 40 26 C24 40 30 62 20 76 C12 88 14 104 26 118';

export function StudioTheme(p: ThemeProps) {
  return (
    <div className="min-h-screen bg-surface">
      <SiteNav site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />

      <header className="relative isolate overflow-hidden">
        <DrawnThread
          d={STUDIO_HEADER_PATH}
          viewBox="0 0 100 124"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-ink/15"
          strokeWidth={1.75}
        />
        {/* Fully inside the frame on purpose. Hanging it off the right
            edge let overflow-hidden clip it into a wedge, which reads as a
            rendering fault rather than as a cut-out — checked on the page,
            not in the markup. Hidden below sm, where there is no margin for
            it to sit in. */}
        <Shape
          name="leaf"
          rotate={-14}
          className="pointer-events-none absolute right-8 top-10 -z-10 hidden w-24 text-ink/[0.05] sm:block lg:w-32"
        />
        {/* Same container width as the programme below. The text is
            narrowed INSIDE it — when the header was max-w-3xl over a
            max-w-5xl main, the two sections started at different x and the
            page read as two pages stuck together. */}
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-24 sm:pt-28">
          {p.crumb && <div className="mb-8">{p.crumb}</div>}
          {/* The eyebrow is the owner's name ABOVE their headline. When a
              workspace has written no headline the headline falls back to
              that same name, and printing it twice looks like a bug — seen
              on a real organiser with no headline set. */}
          {p.site.headline && p.site.headline !== p.name && (
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
              {p.name}
            </p>
          )}
          <h1 className="mt-4 max-w-3xl text-[clamp(2rem,5.5vw,3.5rem)] font-semibold leading-[1.06] tracking-tight text-balance">
            {p.site.headline ?? p.name}
          </h1>
          {p.site.intro ? (
            <RichText
              html={p.site.intro}
              className="mt-6 max-w-xl text-lg leading-relaxed text-ink-subtle"
            />
          ) : (
            p.bio && (
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-subtle">{p.bio}</p>
            )
          )}
        </div>
      </header>

      {/* The hero is optional here and sits UNDER the words, as a plate
          rather than a backdrop — this theme's job is to work without one. */}
      {p.site.hero_url && (
        <div className="mx-auto max-w-5xl px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.site.hero_url}
            alt=""
            className="h-56 w-full rounded-xl object-cover sm:h-80"
          />
        </div>
      )}

      <main className="relative isolate mx-auto max-w-5xl px-6 pb-24 pt-16">
        {/* Hidden below sm. The grid is one column on a phone, so this
            segment has no margin to run down — it crosses the cards
            instead, and a line drawn over a photograph of an event reads as
            a scratch on the screen. The header's segment stays at every
            width because it only ever crosses empty space. Seen at 375px,
            not reasoned about. */}
        <DrawnThread
          d={STUDIO_MAIN_PATH}
          viewBox="0 0 100 124"
          className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full text-ink/10 sm:block"
          strokeWidth={1.75}
        />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
          What’s on
        </h2>
        {p.threads.length === 0 && <p className="mt-4 text-sm text-ink-subtle">{EMPTY}</p>}
        <ThreadsGrid organiserSlug={p.baseSlug} threads={p.threads} variant="poster" />
      </main>

      <SiteFooter site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />
    </div>
  );
}

// ── journal ───────────────────────────────────────────────────────────────
// Typography doing the whole job. No image above the fold, no cards, no
// colour — an oversized headline, a hairline rule, and the programme as
// dated entries: a body of work listed rather than sold.
//
// It shares variant="row" with corporate deliberately. That variant already
// puts the date first in a column you can scan, and a fifth card shape to
// maintain would buy nothing. What differs above it is the register:
// corporate is a company's calendar, this is a practitioner's record.

export function JournalTheme(p: ThemeProps) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-surface">
      <SiteNav site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />

      <header className="mx-auto max-w-4xl px-6 pb-12 pt-24 sm:pt-32">
        {p.crumb && <div className="mb-8">{p.crumb}</div>}
        <div className="flex items-baseline justify-between gap-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            {p.site.headline && p.site.headline !== p.name ? p.name : ''}
          </p>
          {/* The year is the only ornament, and it is information. */}
          <span className="hidden text-[11px] tabular-nums tracking-[0.22em] text-ink-muted sm:block">
            {year}
          </span>
        </div>
        <h1 className="mt-8 text-[clamp(2.25rem,6.5vw,4.25rem)] font-medium leading-[1.02] tracking-[-0.02em] text-balance">
          {p.site.headline ?? p.name}
        </h1>
        {p.site.intro ? (
          <RichText
            html={p.site.intro}
            className="mt-8 max-w-2xl text-base leading-[1.75] text-ink-subtle"
          />
        ) : (
          p.bio && (
            <p className="mt-8 max-w-2xl text-base leading-[1.75] text-ink-subtle">{p.bio}</p>
          )
        )}
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <div className="border-t border-ink pt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            Entries
          </h2>
          {p.threads.length === 0 && <p className="mt-4 text-sm text-ink-subtle">{EMPTY}</p>}
          <ThreadsGrid organiserSlug={p.baseSlug} threads={p.threads} variant="row" />
        </div>
      </main>

      <SiteFooter site={p.site} ownerSlug={p.ownerSlug} ownerName={p.name} />
    </div>
  );
}

export const THEMES = {
  plain: PlainTheme,
  festival: FestivalTheme,
  corporate: CorporateTheme,
  community: CommunityTheme,
  studio: StudioTheme,
  journal: JournalTheme,
} as const;
