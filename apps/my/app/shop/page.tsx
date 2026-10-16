// SHOP — what the communities a person belongs to or bought from offer them
// (Sjoerd, 2026-10-16/17: "offer products for purchase/upgrade in my.thread
// (owned ones can't be bought again; recurring ones can be cancelled)", as
// its own page, only their own communities, no setting).
//
// The rules are the API's (lib/shop.ts, GET /me/shop): members-only = what
// "Add or change" offers, open = what /public/buy and /public/subscribe sell,
// owned = never offered again. This page only lays them out and hands each
// action to the route that already does it.

import { NOTICE } from '@thefibre/shared/ui/recipes';
import { loadSession } from '@/lib/session';
import { fetchBuyerDetails, fetchRenewals, fetchShop } from '@/lib/portal-api';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { ShopView } from './shop-view';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;
  const locale = await pageLocale();
  const [shop, renewals, buyer] = await Promise.all([fetchShop(session.token), fetchRenewals(session.token), fetchBuyerDetails(session.token)]);
  const person = session.portal.person;
  const name = buyer?.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email;

  return (
    <PageShell title={t(locale, 'nav_shop')} subtitle={t(locale, 'shop_blurb')}>
      {shop === null ? (
        // A failed read is not an empty shop.
        <div className={`mt-8 ${NOTICE.error}`}>{t(locale, 'shop_failed')}</div>
      ) : shop.length === 0 ? (
        <Empty title={t(locale, 'shop_empty_title')}>{t(locale, 'shop_empty_body')}</Empty>
      ) : (
        <ShopView
          communities={shop}
          renewals={(renewals?.memberships ?? []).map((r) => ({ member_id: r.member_id, community: r.community, tier: r.tier, renews_at: r.renews_at ?? null }))}
          buyer={{ email: person.email, name, country: buyer?.country ?? null, taxNo: buyer?.tax_no ?? null }}
        />
      )}
    </PageShell>
  );
}
