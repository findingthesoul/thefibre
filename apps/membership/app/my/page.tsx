// The member's personal page (the /my pattern from Thread): sign IN to see
// every membership held under your email, across communities. No workspace
// membership required — outside the (app) group on purpose.

import { serverSupabase } from '@/lib/supabase/server';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { money } from '@/lib/money';
import { DEFAULT_LOCALE, INTL_LOCALES, t, toLocale, type I18nKey, type Locale } from '@/lib/i18n';
import { SignInButton } from '../sign-in-button';
import { ManagePaymentButton } from './manage-payment-button';

type PortalMembership = {
  member_id: string;
  workspace: { name: string; slug: string };
  tier: {
    name: string;
    price_cents_year: number | null;
    price_cents_month: number | null;
    currency: string | null;
  };
  status: string;
  started_at: string;
  renews_at: string | null;
  has_stripe: boolean;
};

type PortalInvoice = {
  id: string;
  item_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  stripe_invoice_url: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  grace: 'bg-amber-50 text-amber-700 ring-amber-200',
  lapsed: 'bg-surface-sunken text-ink-muted ring-line',
  cancelled: 'bg-surface-sunken text-ink-muted ring-line',
};

const STATUS_KEYS: Record<string, I18nKey> = {
  active: 'status_active',
  grace: 'status_grace',
  lapsed: 'status_lapsed',
  cancelled: 'status_cancelled',
};

function fmtDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function tierPrice(tier: PortalMembership['tier'], locale: Locale): string | null {
  const currency = tier.currency ?? 'EUR';
  const parts: string[] = [];
  if (tier.price_cents_month != null)
    parts.push(`${money(tier.price_cents_month, currency)} ${t(locale, 'per_month')}`);
  if (tier.price_cents_year != null)
    parts.push(`${money(tier.price_cents_year, currency)} ${t(locale, 'per_year')}`);
  return parts.length ? parts.join(' · ') : null;
}

export default async function MyPage() {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return <SignedOut />;

  // `locale` is the member's resolved language (i18n P1) — optional until
  // the API ships it; English until then.
  let data: { email: string; locale?: string | null; items: PortalMembership[] };
  try {
    data = await publicFetch<{ email: string; locale?: string | null; items: PortalMembership[] }>(
      '/api/v1/membership/portal/me',
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 401) return <SignedOut />;
    throw e;
  }

  // Invoices per membership, server-side (same transport, same token).
  const invoices = await Promise.all(
    data.items.map(async (m) => {
      try {
        const r = await publicFetch<{ items: PortalInvoice[] }>(
          `/api/v1/membership/portal/me/invoices?member_id=${encodeURIComponent(m.member_id)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        return r.items;
      } catch {
        return [] as PortalInvoice[];
      }
    }),
  );

  const locale = toLocale(data?.locale ?? null);

  return (
    <Shell>
      <h1 className="text-2xl font-medium tracking-tight">{t(locale, 'my_memberships')}</h1>
      <p className="mt-1 text-sm text-ink-subtle">{data.email}</p>

      {data.items.length === 0 && (
        <p className="mt-8 text-sm text-ink-subtle">{t(locale, 'no_memberships')}</p>
      )}

      <ul className="mt-8 space-y-4">
        {data.items.map((m, i) => {
          const price = tierPrice(m.tier, locale);
          const rows = invoices[i] ?? [];
          return (
            <li
              key={m.member_id}
              className="rounded-xl border border-line bg-surface-raised p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-medium truncate">{m.workspace.name}</div>
                  <div className="mt-0.5 text-sm text-ink-subtle">
                    {m.tier.name}
                    {price && <span className="text-ink-muted"> · {price}</span>}
                  </div>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                    STATUS_STYLES[m.status] ?? STATUS_STYLES.lapsed
                  }`}
                >
                  {STATUS_KEYS[m.status] ? t(locale, STATUS_KEYS[m.status]) : m.status}
                </span>
              </div>

              {m.renews_at && (
                <div className="mt-2 text-xs text-ink-muted">
                  {t(locale, 'renews_on', { date: fmtDate(m.renews_at, locale) })}
                </div>
              )}

              <div className="mt-4">
                <ManagePaymentButton
                  memberId={m.member_id}
                  hasStripe={m.has_stripe}
                  locale={locale}
                />
              </div>

              {rows.length > 0 && (
                <details className="mt-4 group">
                  <summary className="cursor-pointer text-xs text-ink-subtle hover:text-ink select-none">
                    {t(locale, 'invoices_count', { n: rows.length })}
                  </summary>
                  <ul className="mt-2 divide-y divide-line border border-line rounded-lg">
                    {rows.map((inv) => (
                      <li key={inv.id} className="flex items-baseline gap-3 px-3 py-2">
                        <span className="text-sm flex-1 min-w-0 truncate">{inv.item_label}</span>
                        <span className="text-xs text-ink-muted shrink-0 capitalize">
                          {inv.status}
                        </span>
                        <span className="text-sm shrink-0 tabular-nums">
                          {money(inv.amount_cents, inv.currency)}
                        </span>
                        <span className="text-xs text-ink-muted shrink-0 tabular-nums">
                          {fmtDate(inv.created_at, locale)}
                        </span>
                        {inv.stripe_invoice_url && (
                          <a
                            href={inv.stripe_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 shrink-0"
                          >
                            {t(locale, 'view')}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="mt-16 text-xs text-ink-muted">
        {t(locale, 'powered_by')} <span className="font-medium">Membership</span> · The Fibre
      </footer>
    </Shell>
  );
}

function SignedOut() {
  // No member payload yet, so no resolved language — default locale.
  return (
    <Shell>
      <h1 className="text-2xl font-medium tracking-tight">
        {t(DEFAULT_LOCALE, 'my_memberships')}
      </h1>
      <p className="mt-2 text-sm text-ink-subtle max-w-md leading-relaxed">
        {t(DEFAULT_LOCALE, 'signed_out_note')}
      </p>
      <div className="mt-6">
        <SignInButton next="/my" />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-2xl px-6 py-16">{children}</main>
    </div>
  );
}
