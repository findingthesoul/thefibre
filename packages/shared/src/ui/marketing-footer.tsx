// The default footer (Sjoerd, 2026-09-08: "should be on every page") —
// the yellow brand band born on the thethread.app website, extracted here
// so the Fibre's public pages (terms, privacy, support, about, pricing)
// carry the SAME footer instead of a thin per-app variant. Colours are
// brand-FIXED (#ffdd00 / #1a1a2e as arbitrary values), never theme
// tokens: the fibre web's --accent is not yellow, and this band must look
// identical wherever it renders. Links are absolute for the same reason.
// Server component; no hooks.

import { APPS, ENTITY, FOOTER_LINKS } from '../branding.js';

const WEBSITE = 'https://thethread.app';
const CONTACT_EMAIL = 'hello@thethread.app';

const INK = 'text-[#1a1a2e]';
const COL_TITLE = 'text-[11px] font-bold uppercase tracking-[0.18em] text-[#1a1a2e]/50';
const COL_LINK =
  'text-[13px] leading-6 text-[#1a1a2e]/75 transition-colors hover:text-[#1a1a2e]';

export function MarketingFooter({
  className = '',
  variant = 'thread',
}: {
  className?: string;
  /** 'thread' = the yellow brand band (thethread.app); 'fibre' = the same
   *  structure in the Fibre's quiet neutral, so thefibre.app stays a
   *  FIBRE page (Sjoerd, 2026-09-08). */
  variant?: 'thread' | 'fibre';
}) {
  const fibre = variant === 'fibre';
  return (
    <footer
      className={`${fibre ? 'border-t border-neutral-200 bg-neutral-50' : 'bg-[#ffdd00]'} ${INK} ${className}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-14 md:px-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fibre ? 'https://thefibre.app/brand/the-fibre.png' : `${WEBSITE}/logo-the-thread.svg`}
              alt={fibre ? 'The Fibre' : 'The Thread'}
              className="h-7 w-auto"
            />
            <p className="mt-4 text-[13px] leading-6 text-[#1a1a2e]/75">
              {fibre ? 'The data platform beneath The Thread.' : 'Tools to facilitate change.'}
            </p>
          </div>

          <div>
            <p className={COL_TITLE}>Explore</p>
            <ul className="mt-4 space-y-1.5">
              <li><a href={`${WEBSITE}/why`} className={COL_LINK}>Why The Thread</a></li>
              <li><a href={`${WEBSITE}/workshop`} className={COL_LINK}>The workshop</a></li>
              <li><a href={`${WEBSITE}/pricing`} className={COL_LINK}>Pricing</a></li>
              <li><a href={`${WEBSITE}/about`} className={COL_LINK}>About</a></li>
              <li><a href={`${WEBSITE}/contact`} className={COL_LINK}>Contact</a></li>
              <li><a href={APPS['the-thread'].url} className={COL_LINK}>Sign in</a></li>
            </ul>
          </div>

          <div>
            <p className={COL_TITLE}>Legal &amp; help</p>
            <ul className="mt-4 space-y-1.5">
              <li><a href={FOOTER_LINKS.privacy} className={COL_LINK}>Privacy policy</a></li>
              <li><a href={FOOTER_LINKS.legal} className={COL_LINK}>Terms of service</a></li>
              <li><a href={FOOTER_LINKS.help} className={COL_LINK}>Support</a></li>
              <li><a href={`mailto:${CONTACT_EMAIL}`} className={COL_LINK}>{CONTACT_EMAIL}</a></li>
            </ul>
          </div>

          <div>
            <p className={COL_TITLE}>Built on The Fibre</p>
            <p className="mt-4 text-[13px] leading-6 text-[#1a1a2e]/75">
              Every Thread tool stands on{' '}
              <a
                href={APPS['fibre-platform'].url}
                className="underline underline-offset-2 transition-colors hover:text-[#1a1a2e]"
              >
                The Fibre
              </a>
              , our own data platform: one contact base, where each tool sees only the data it can
              justify.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-[#1a1a2e]/50">
              PostgreSQL with row-level security (Supabase, EU-West) · API on Fly.io (Frankfurt) ·
              payments by Stripe · hosted in the EU, end to end.
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-[#1a1a2e]/10 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]">
            Our commitment to safe data
          </p>
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#1a1a2e]/75">
            Your guests&apos; data belongs to your guests. We store the minimum a tool can justify,
            host everything in the EU, and erase on request. Nothing is sold, shared or profiled —
            GDPR by construction, not by checkbox.
          </p>
        </div>
      </div>

      <div className="border-t border-[#1a1a2e]/10 py-4 text-center text-xs text-[#1a1a2e]/50">
        © {new Date().getFullYear()} {fibre ? 'The Fibre' : ENTITY.publicName} · No advertising.
        No profiling. No data sold.
      </div>
    </footer>
  );
}
