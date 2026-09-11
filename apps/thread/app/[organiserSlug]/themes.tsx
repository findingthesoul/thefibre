// The three site designs, plus the plain page that was here first.
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
// What is deliberately NOT here: per-page layout. Sjoerd named the future —
// "the drag and drop of the certificates for an very chique design tool" —
// and asked for "a basic structure to use templates" now. A theme is code, a
// template will be a document, and the ingredients on thread_settings are
// what both read from.

import Link from 'next/link';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { FOOTER_LINKS } from '@thefibre/shared';
import type { PublicSite } from '@/lib/public-site';
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
                nobody chose for its contrast. Bottom-weighted so the top of
                the image survives. */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
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

export const THEMES = {
  plain: PlainTheme,
  festival: FestivalTheme,
  corporate: CorporateTheme,
  community: CommunityTheme,
} as const;
