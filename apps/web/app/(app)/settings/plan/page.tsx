import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel, EmptyState } from '@/components/ui/page';
import { ENTITY } from '@thefibre/shared';
import { FEATURE_GROUPS, eur, feePhrase, type CataloguePlan } from '@/lib/plans';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { UpgradePanel } from './upgrade';
import { InvoicesList } from './invoices-list';
import { ReactivateBanner } from './reactivate';
import type { InvoicePurchase } from '@thefibre/shared/ui/invoice-dialog';

// Settings → Plan — the page every needsPlan() refusal has pointed at since
// the gates landed ("Settings → Plan has the details"). Three answers in one
// screen: what am I on, what am I using against it, what would the next
// package give me. Read-only: plans are changed by talking to us (and, once
// Stripe Billing lands, by the upgrade button growing a checkout).

export const metadata = { title: 'Plan · Settings' };

type PlanPayload = {
  plan: {
    id: string;
    name: string;
    status: string;
    comped: boolean;
    price_cents_month: number;
    price_cents_year: number | null;
    effective_price_cents_month: number;
    effective_price_cents_year: number | null;
    tailored: boolean;
    included_seats: number | null;
    extra_seat_cents_month: number | null;
    included_emails_month: number | null;
    included_storage_gb: number | null;
    retention_months: number | null;
    thread_live_limit: number | null;
    features: Record<string, boolean | number | null>;
  };
  usage: {
    seats_used: number;
    emails_this_month: number;
    emails_included: number | null;
    extra_seats?: number;
  };
  catalogue: CataloguePlan[];
  billing?: {
    available: boolean;
    subscribed: boolean;
    interval: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
};

// GET /api/v1/billing/usage — the P4 meters: storage alongside email, the
// overage unit prices, and the archive flags. Separate call so the page
// degrades to the /plan numbers when it fails.
type MeterPayload = {
  emails: {
    used: number;
    included: number | null;
    overage_cents_per_1000: number | null;
    projected_overage_cents: number;
  };
  storage: {
    bytes: number;
    included_gb: number | null;
    overage_cents_per_gb: number | null;
    projected_overage_cents: number;
  };
  warnings: { meter: string; sent_at: string }[];
  archive: { archived_at: string | null; archive_warned_at: string | null };
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; upgraded?: string }>;
}) {
  const { welcome, upgraded } = await searchParams;
  const locale = await uiLocale();
  let data: PlanPayload | null = null;
  let meters: MeterPayload | null = null;
  try {
    data = await apiFetch<PlanPayload>('/api/v1/plan');
  } catch {
    // fall through to the empty state
  }
  try {
    meters = await apiFetch<MeterPayload>('/api/v1/billing/usage');
  } catch {
    // meters are additive — the page still renders on the /plan numbers
  }

  if (!data) {
    return (
      <PageContainer max="4xl">
        <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
        <PageHeader title={t(locale, 'plan_title')} />
        <EmptyState>{t(locale, 'plan_load_failed')}</EmptyState>
      </PageContainer>
    );
  }

  const { plan, usage, catalogue, billing } = data;

  // The workspace's own Fibre invoices — fibre-platform rows in the purchase
  // ledger, written by the billing webhook. Opened in the SHARED invoice
  // dialog (share link / PDF / email to / print) — the one viewer for the
  // whole family. Admin-scoped; non-admins simply see no section.
  let invoices: InvoicePurchase[] = [];
  try {
    const inv = await apiFetch<{ items: InvoicePurchase[] }>(
      '/api/v1/purchases?scope=workspace&app=fibre-platform',
    );
    invoices = inv.items;
  } catch {
    /* non-admin or none — section hides itself */
  }
  const renewLine =
    billing?.subscribed && billing.current_period_end
      ? `${t(locale, billing.cancel_at_period_end ? 'ends' : 'renews')} ${new Date(
          billing.current_period_end,
        ).toLocaleDateString(INTL_LOCALES[locale], { dateStyle: 'medium' })}${
          billing.interval
            ? ` · ${t(locale, billing.interval === 'annual' ? 'billed_yearly' : 'billed_monthly')}`
            : ''
        }`
      : null;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader
        title={t(locale, 'plan_title')}
        description={t(locale, 'plan_blurb')}
      />

      {welcome && (
        <div className="mt-6 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-5 py-4 text-sm leading-relaxed">
          <span className="font-medium">{t(locale, 'welcome_ready')}</span>{' '}
          {t(locale, 'welcome_picked_pre')}{' '}
          <span className="font-medium">
            {catalogue.find((p) => p.id === welcome)?.name ?? welcome}
          </span>{' '}
          {t(locale, 'welcome_picked_post')}
        </div>
      )}
      {upgraded && (
        <div className="mt-6 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-5 py-4 text-sm">
          <span className="font-medium">{t(locale, 'payment_received')}</span>{' '}
          {t(locale, 'payment_received_post')}
        </div>
      )}
      {meters?.archive.archived_at && (
        <ReactivateBanner
          locale={locale}
          archivedOn={new Date(meters.archive.archived_at).toLocaleDateString(
            INTL_LOCALES[locale],
            { dateStyle: 'long' },
          )}
        />
      )}
      {billing?.cancel_at_period_end && billing.current_period_end && (
        <div className="mt-6 rounded-lg border border-amber-600/40 bg-amber-500/10 px-5 py-4 text-sm leading-relaxed">
          <span className="font-medium">
            {t(locale, 'subscription_ends')}{' '}
            {new Date(billing.current_period_end).toLocaleDateString(INTL_LOCALES[locale], {
              dateStyle: 'long',
            })}
          </span>
          {' '}
          {t(locale, 'subscription_ends_post')}
        </div>
      )}

      {/* Current plan ------------------------------------------------- */}
      <section className="mt-10 rounded-lg border border-line bg-surface-raised p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-medium">{plan.name}</h2>
              {plan.comped && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'on_the_house')}
                </span>
              )}
              {plan.tailored && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'tailored_price')}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-subtle">
              {plan.comped
                ? t(locale, 'comped_msg')
                : plan.effective_price_cents_month === 0
                  ? t(locale, 'free_as_long_as_fits')
                  : `${t(locale, 'per_month_ex_vat', { price: eur(plan.effective_price_cents_month) })}${
                      plan.effective_price_cents_year
                        ? ` · ${t(locale, 'per_year_two_free', { price: eur(plan.effective_price_cents_year) })}`
                        : ''
                    }.`}
              {renewLine ? ` ${renewLine}.` : ''}
            </p>
          </div>
          <a
            href={`mailto:${ENTITY.whitelistEmail}?subject=${encodeURIComponent('Changing our Fibre plan')}`}
            className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface-sunken"
          >
            {t(locale, 'talk_to_us')}
          </a>
        </div>

        {billing?.available && (
          <UpgradePanel
            locale={locale}
            currentPlanId={plan.id}
            currentInterval={billing.interval}
            comped={plan.comped}
            subscribed={billing.subscribed}
            cancelling={billing.cancel_at_period_end}
            targets={catalogue
              .filter((p) => p.id !== 'org')
              .map((p) => ({
                id: p.id,
                name: p.name,
                price_cents_month: p.price_cents_month,
                price_cents_year: p.price_cents_year,
              }))}
          />
        )}

        {/* Usage ------------------------------------------------------ */}
        <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-line pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Usage
            locale={locale}
            label={t(locale, 'seats')}
            used={usage.seats_used}
            included={plan.included_seats}
            note={
              usage.extra_seats && plan.extra_seat_cents_month
                ? `${t(locale, 'extra_seats_line', {
                    n: usage.extra_seats,
                    each: eur(plan.extra_seat_cents_month),
                    total: eur(usage.extra_seats * plan.extra_seat_cents_month),
                  })}${billing?.subscribed ? t(locale, 'on_your_subscription') : ''}`
                : plan.extra_seat_cents_month
                  ? t(locale, 'extra_seats_price', { price: eur(plan.extra_seat_cents_month) })
                  : undefined
            }
          />
          <Usage
            locale={locale}
            label={t(locale, 'email_this_month')}
            used={meters?.emails.used ?? usage.emails_this_month}
            included={meters?.emails.included ?? usage.emails_included}
            note={
              meters && meters.emails.projected_overage_cents > 0
                ? t(locale, 'overage_so_far', {
                    price: eur(meters.emails.projected_overage_cents),
                  })
                : meters?.emails.overage_cents_per_1000 != null
                  ? t(locale, 'over_allowance_emails', {
                      price: eur(meters.emails.overage_cents_per_1000),
                    })
                  : undefined
            }
          />
          {meters && (
            <Usage
              locale={locale}
              label={t(locale, 'storage')}
              used={meters.storage.bytes}
              included={
                meters.storage.included_gb === null
                  ? null
                  : meters.storage.included_gb * 1_000_000_000
              }
              format={(bytes) =>
                bytes >= 1_000_000_000
                  ? `${(bytes / 1_000_000_000).toFixed(1)} GB`
                  : `${Math.round(bytes / 1_000_000)} MB`
              }
              note={
                meters.storage.projected_overage_cents > 0
                  ? t(locale, 'overage_storage', {
                      price: eur(meters.storage.projected_overage_cents),
                    })
                  : meters.storage.overage_cents_per_gb != null
                    ? t(locale, 'over_allowance_gb', {
                        price: eur(meters.storage.overage_cents_per_gb),
                      })
                    : undefined
              }
            />
          )}
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-ink-muted">
              {t(locale, 'data_kept')}
            </dt>
            <dd className="mt-1 text-ink">
              {plan.retention_months
                ? t(locale, 'n_months', { n: plan.retention_months })
                : t(locale, 'as_long_as_you_pay')}
            </dd>
          </div>
        </dl>
      </section>

      {/* Your Fibre invoices ------------------------------------------- */}
      {invoices.length > 0 && (
        <section className="mt-12">
          <SectionLabel>{t(locale, 'your_fibre_invoices')}</SectionLabel>
          <InvoicesList invoices={invoices} locale={locale} />
        </section>
      )}

      {/* The packages -------------------------------------------------- */}
      <section className="mt-12">
        <SectionLabel>{t(locale, 'all_packages')}</SectionLabel>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-normal text-ink-muted" />
                {catalogue.map((p) => (
                  <th key={p.id} className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {p.name}
                      {p.id === plan.id && (
                        <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-900">
                          {t(locale, 'yours')}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs font-normal text-ink-muted">
                      {p.price_cents_month === 0 && p.id !== 'org'
                        ? t(locale, 'free')
                        : p.id === 'org'
                          ? t(locale, 'talk_to_us')
                          : `${eur(p.price_cents_month)}${t(locale, 'per_mo')}`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <NumberRow label={t(locale, 'seats_included')} catalogue={catalogue} value={(p) => (p.included_seats === null ? t(locale, 'unlimited') : String(p.included_seats))} />
              <NumberRow label={t(locale, 'email_per_month')} catalogue={catalogue} value={(p) => (p.included_emails_month === null ? t(locale, 'negotiated') : p.included_emails_month.toLocaleString(INTL_LOCALES[locale]))} />
              <NumberRow label={t(locale, 'storage')} catalogue={catalogue} value={(p) => (p.included_storage_gb === null ? t(locale, 'negotiated') : `${p.included_storage_gb} GB`)} />
              <NumberRow label={t(locale, 'fee_paid_enrolments')} catalogue={catalogue} value={(p) => feePhrase(p.meet_paid_pct, p.meet_paid_cap_cents)} />
              {FEATURE_GROUPS.filter((g) => g.rows.length > 0).flatMap((g) =>
                g.rows.map((row) => (
                  <tr key={row.key} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 text-ink-subtle">{row.label}</td>
                    {catalogue.map((p) => {
                      const v = p.features?.[row.key];
                      return (
                        <td key={p.id} className="px-4 py-2.5">
                          {row.kind === 'limit'
                            ? v === null || v === undefined
                              ? p.features?.[g.rows[0]!.key] === false
                                ? '—'
                                : t(locale, 'unlimited')
                              : String(v)
                            : v === true
                              ? '✓'
                              : '—'}
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-muted">{t(locale, 'packages_footnote')}</p>
      </section>
    </PageContainer>
  );
}

function Usage({
  locale,
  label,
  used,
  included,
  note,
  format,
}: {
  locale: Locale;
  label: string;
  used: number;
  included: number | null;
  note?: string | undefined;
  /** How a raw value renders — bytes become "1.2 GB", counts stay counts. */
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => v.toLocaleString(INTL_LOCALES[locale]));
  const pct = included !== null && included > 0 ? (used / included) * 100 : null;
  const over = pct !== null && pct > 100;
  const warm = pct !== null && pct >= 80 && !over;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1">
        <span className={`font-mono ${over ? 'text-amber-700 dark:text-amber-400' : 'text-ink'}`}>
          {fmt(used)}
        </span>
        <span className="text-ink-muted"> / {included === null ? '∞' : fmt(included)}</span>
      </dd>
      {pct !== null && (
        <div
          className="mt-1.5 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuenow={Math.round(Math.min(pct, 100))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${t(locale, 'pct_of_allowance', { pct: Math.round(pct) })}`}
        >
          <div
            className={`h-full rounded-full ${
              over
                ? 'bg-amber-600 dark:bg-amber-500'
                : warm
                  ? 'bg-amber-400 dark:bg-amber-400/80'
                  : 'bg-neutral-900 dark:bg-neutral-100'
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
      {note && <div className="mt-1 text-xs text-ink-muted">{note}</div>}
    </div>
  );
}

function NumberRow({
  label,
  catalogue,
  value,
}: {
  label: string;
  catalogue: CataloguePlan[];
  value: (p: CataloguePlan) => string;
}) {
  return (
    <tr className="border-b border-line/60">
      <td className="px-4 py-2.5 text-ink-subtle">{label}</td>
      {catalogue.map((p) => (
        <td key={p.id} className="px-4 py-2.5">
          {value(p)}
        </td>
      ))}
    </tr>
  );
}
