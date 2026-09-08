import Link from 'next/link';
import Image from 'next/image';
import { APPS, ENTITY, BRAND_ASSETS } from '@thefibre/shared';
import { MarketingFooter } from '@thefibre/shared/ui/marketing-footer';

// Signed-OUT public pages: /about, /support, /terms, /privacy-policy.
//
// They live in this route group rather than in `(app)` on purpose — `(app)`'s
// layout redirects anyone without a session back to `/`, and every one of
// these pages is linked from the footer of transactional email, i.e. read by
// people who are not signed in and may not have an account at all.
//
// Palette follows the landing page (white / neutral), not the themed
// surface/ink tokens the signed-in shell uses.

const FIBRE = APPS['fibre-platform'];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="inline-block">
          <Image
            src="/brand/the-fibre.png"
            alt={BRAND_ASSETS.logoAlt}
            width={BRAND_ASSETS.logoNativeWidth}
            height={BRAND_ASSETS.logoNativeHeight}
            className="h-9 w-auto"
          />
        </Link>

        {children}
      </div>

      <MarketingFooter variant="fibre" />
    </main>
  );
}
