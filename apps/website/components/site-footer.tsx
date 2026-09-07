// Footer, the serious version (Sjoerd, 2026-09-08): legal links, the real
// tech stack, a reference to The Fibre underneath, and the commitment to
// safe data — on every page via the root layout. Legal pages deliberately
// reuse the Fibre's public documents (FOOTER_LINKS) rather than
// duplicating them; the brand line is composed from ENTITY parts — never
// legalFooterLine(), which names The Fibre.

import Link from 'next/link';
import { ENTITY, FOOTER_LINKS } from '@thefibre/shared';
import { APP_URL, CONTACT_EMAIL } from '@/lib/site';

const COL_TITLE = 'text-[11px] font-bold uppercase tracking-[0.18em] text-ink/50';
const COL_LINK = 'text-[13px] leading-6 text-ink/75 transition-colors hover:text-ink';

export function SiteFooter() {
  return (
    <footer className="snap-end bg-accent text-ink">
      <div className="mx-auto max-w-6xl px-6 py-14 md:px-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-the-thread.svg" alt="The Thread" className="h-7 w-auto" />
            <p className="mt-4 text-[13px] leading-6 text-ink/75">Tools to facilitate change.</p>
            <p className="mt-3 text-[13px] leading-6 text-ink/50">
              {ENTITY.name}
              <br />
              {ENTITY.address}
            </p>
          </div>

          <div>
            <p className={COL_TITLE}>Explore</p>
            <ul className="mt-4 space-y-1.5">
              <li><Link href="/workshop" className={COL_LINK}>The workshop</Link></li>
              <li><Link href="/pricing" className={COL_LINK}>Pricing</Link></li>
              <li><Link href="/about" className={COL_LINK}>About</Link></li>
              <li><Link href="/contact" className={COL_LINK}>Contact</Link></li>
              <li><a href={APP_URL} className={COL_LINK}>Sign in</a></li>
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
            <p className="mt-4 text-[13px] leading-6 text-ink/75">
              Every Thread tool stands on{' '}
              <a
                href="https://thefibre.app"
                className="underline underline-offset-2 transition-colors hover:text-ink"
              >
                The Fibre
              </a>
              , our own data platform: one contact base, where each tool sees only the data it can
              justify.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-ink/50">
              PostgreSQL with row-level security (Supabase, EU-West) · API on Fly.io (Frankfurt) ·
              payments by Stripe · hosted in the EU, end to end.
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-ink/10 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink">
            Our commitment to safe data
          </p>
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-ink/75">
            Your guests&apos; data belongs to your guests. We store the minimum a tool can justify,
            host everything in the EU, and erase on request. Nothing is sold, shared or profiled —
            GDPR by construction, not by checkbox.
          </p>
        </div>
      </div>

      <div className="border-t border-ink/10 py-4 text-center text-xs text-ink/50">
        © {new Date().getFullYear()} The Thread · {ENTITY.name} · No advertising. No profiling. No
        data sold.
      </div>
    </footer>
  );
}
