// What a member pays for something their membership lets them join, in words
// they can act on: "included" when the membership covers it, otherwise their
// price with what anybody else pays beside it, so the membership's worth is
// visible.
//
// One component for the Memberships card and the Upcoming list, because the
// two show the same row from the same walk — and a second copy of the
// sentence is how they would come to say different things about one price.

import type { CouldJoin } from '@/lib/portal-api';
import { money } from '@/lib/format';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';

// `locale` is optional so a caller not yet moved to a language reads English.
export function JoinPrice({ j, locale = 'en' }: { j: CouldJoin; locale?: Locale }) {
  if (j.your_price_cents === 0) {
    return <span className="text-emerald-700">{t(locale, 'price_included')}</span>;
  }
  return (
    <>
      <span className="text-emerald-700">{money(j.your_price_cents, j.currency, locale)}</span>
      {j.list_price_cents > j.your_price_cents && (
        <span className="text-ink-muted"> {t(locale, 'price_instead', { price: money(j.list_price_cents, j.currency, locale) })}</span>
      )}
      {/* Said only when it is so: a price marked "includes VAT" is the whole
          price; an excl. one gets its VAT at checkout. */}
      {j.price_includes_vat && <span className="text-ink-muted"> {t(locale, 'price_incl_vat')}</span>}
    </>
  );
}
