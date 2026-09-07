// Footer. Legal pages deliberately reuse the Fibre's public documents
// (FOOTER_LINKS) rather than duplicating them; the brand line is composed
// from ENTITY parts — never legalFooterLine(), which names The Fibre.

import Link from 'next/link';
import { ENTITY, FOOTER_LINKS } from '@thefibre/shared';
import { APP_URL, CONTACT_EMAIL } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-warm">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 md:flex-row md:items-end md:justify-between md:px-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-the-thread.svg" alt="The Thread" className="h-6 w-auto" />
          <p className="mt-3 text-[13px] text-ink-muted">
            The Thread · {ENTITY.address} · {ENTITY.hostedLine}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-subtle">
          <Link href="/workshop" className="hover:text-ink">
            The workshop
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/about" className="hover:text-ink">
            About
          </Link>
          <a href={APP_URL} className="hover:text-ink">
            Sign in
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">
            {CONTACT_EMAIL}
          </a>
          <a href={FOOTER_LINKS.legal} className="hover:text-ink">
            Terms
          </a>
          <a href={FOOTER_LINKS.privacy} className="hover:text-ink">
            Privacy
          </a>
        </nav>
      </div>
      <div className="border-t border-line/60 py-4 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} The Thread. No advertising. No profiling. No data sold.
      </div>
    </footer>
  );
}
