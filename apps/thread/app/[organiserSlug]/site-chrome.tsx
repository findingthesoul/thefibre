// The navbar and the footer — the two ingredients every themed page wears.
//
// Sjoerd listed them among "the ingredients of a website (image, navbar,
// logo, intro text, footer, privacy (from the fibre), conditions, contact
// page…)". They live here rather than inside each theme because a site whose
// header changed shape between its listing and one of its events would not
// read as a site. The themes decide what sits BETWEEN them.
//
// Privacy and terms come from `FOOTER_LINKS` in @thefibre/shared — the same
// two documents the platform's emails and the enrolment consent point at.
// A workspace does not write its own, and should not: those documents
// describe what The Fibre does with the data, which is the same wherever the
// page is wearing a festival poster.

import Link from 'next/link';
import { FOOTER_LINKS } from '@thefibre/shared';
import type { PublicSite } from '@/lib/public-site';

/** Tone per theme. Only the surfaces differ; the structure never does. */
const NAV_TONE: Record<PublicSite['theme'], string> = {
  plain: 'bg-surface-raised/90 border-b border-line',
  festival: 'bg-transparent absolute inset-x-0 top-0 z-20 text-white',
  corporate: 'bg-surface-raised border-b border-line',
  community: 'bg-surface-raised/80 border-b border-line',
};

export function SiteNav({
  site,
  ownerSlug,
  ownerName,
}: {
  site: PublicSite;
  ownerSlug: string;
  ownerName: string;
}) {
  const name = site.name ?? ownerName;
  const onHero = site.theme === 'festival';
  const linkClass = onHero
    ? 'text-sm text-white/80 hover:text-white transition-colors'
    : 'text-sm text-ink-subtle hover:text-ink transition-colors';

  return (
    <nav className={`${NAV_TONE[site.theme]} backdrop-blur-sm`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <Link href={`/${ownerSlug}`} className="flex items-center gap-2.5 min-w-0">
          {site.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logo_url} alt={name} className="h-8 w-auto max-w-[180px] object-contain" />
          ) : (
            <span
              className={`text-base font-medium tracking-tight truncate ${
                onHero ? 'text-white' : 'text-ink'
              }`}
            >
              {name}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-5 shrink-0">
          {site.links.map((l) => (
            <a key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
          {site.contact_enabled && (
            <Link href={`/${ownerSlug}/contact`} className={linkClass}>
              Contact
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter({
  site,
  ownerSlug,
  ownerName,
}: {
  site: PublicSite;
  ownerSlug: string;
  ownerName: string;
}) {
  const name = site.name ?? ownerName;
  return (
    <footer className="mt-20 border-t border-line bg-surface-raised">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {site.footer_note && (
          <p className="max-w-xl text-sm text-ink-subtle leading-relaxed whitespace-pre-line">
            {site.footer_note}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
          <span className="text-ink-subtle">{name}</span>
          {site.contact_enabled && (
            <Link href={`/${ownerSlug}/contact`} className="hover:text-ink">
              Contact
            </Link>
          )}
          <a href={FOOTER_LINKS.privacy} className="hover:text-ink">
            Privacy
          </a>
          <a href={FOOTER_LINKS.legal} className="hover:text-ink">
            Terms
          </a>
          <span className="ml-auto">
            Powered by <span className="font-medium">Thread</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
