import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel, EmptyState } from '@/components/ui/page';
import { ENTITY } from '@thefibre/shared';
import { FEATURE_GROUPS, eur, feePhrase, type CataloguePlan } from '@/lib/plans';
import { UpgradePanel } from './upgrade';

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

export default async function PlanPage() {
  let data: PlanPayload | null = null;
  try {
    data = await apiFetch<PlanPayload>('/api/v1/plan');
  } catch {
    // fall through to the empty state
  }

  if (!data) {
    return (
      <PageContainer max="4xl">
        <Breadcrumb href="/settings" label="Settings" />
        <PageHeader title="Plan" />
        <EmptyState>Could not load your plan. Try again in a moment.</EmptyState>
      </PageContainer>
    );
  }

  const { plan, usage, catalogue, billing } = data;
  const renewLine =
    billing?.subscribed && billing.current_period_end
      ? `${billing.cancel_at_period_end ? 'Ends' : 'Renews'} ${new Date(
          billing.current_period_end,
        ).toLocaleDateString('en-GB', { dateStyle: 'medium' })}${
          billing.interval ? ` · billed ${billing.interval}` : ''
        }`
      : null;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Plan"
        description="What this workspace is on, what it is using, and what the other packages offer."
      />

      {/* Current plan ------------------------------------------------- */}
      <section className="mt-10 rounded-lg border border-line bg-surface-raised p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-medium">{plan.name}</h2>
              {plan.comped && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  On the house
                </span>
              )}
              {plan.tailored && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  Tailored price
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-subtle">
              {plan.comped
                ? 'This workspace pays nothing — the plan was granted by The Fibre.'
                : plan.effective_price_cents_month === 0
                  ? 'Free, for as long as it fits.'
                  : `${eur(plan.effective_price_cents_month)} per month ex-VAT${
                      plan.effective_price_cents_year
                        ? ` · ${eur(plan.effective_price_cents_year)} per year (two months free)`
                        : ''
                    }.`}
              {renewLine ? ` ${renewLine}.` : ''}
            </p>
          </div>
          <a
            href={`mailto:${ENTITY.whitelistEmail}?subject=${encodeURIComponent('Changing our Fibre plan')}`}
            className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface-sunken"
          >
            Talk to us
          </a>
        </div>

        {billing?.available && (
          <UpgradePanel
            currentPlanId={plan.id}
            comped={plan.comped}
            subscribed={billing.subscribed}
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
        <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
          <Usage
            label="Seats"
            used={usage.seats_used}
            included={plan.included_seats}
            note={
              usage.extra_seats && plan.extra_seat_cents_month
                ? `${usage.extra_seats} extra × ${eur(plan.extra_seat_cents_month)} = ${eur(
                    usage.extra_seats * plan.extra_seat_cents_month,
                  )}/month${billing?.subscribed ? ', on your subscription' : ''}`
                : plan.extra_seat_cents_month
                  ? `Extra seats ${eur(plan.extra_seat_cents_month)}/month`
                  : undefined
            }
          />
          <Usage label="Email this month" used={usage.emails_this_month} included={usage.emails_included} />
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-ink-muted">Data kept</dt>
            <dd className="mt-1 text-ink">
              {plan.retention_months ? `${plan.retention_months} months` : 'For as long as you pay'}
            </dd>
          </div>
        </dl>
      </section>

      {/* The packages -------------------------------------------------- */}
      <section className="mt-12">
        <SectionLabel>All packages</SectionLabel>
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
                          Yours
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs font-normal text-ink-muted">
                      {p.price_cents_month === 0 && p.id !== 'org'
                        ? 'Free'
                        : p.id === 'org'
                          ? 'Talk to us'
                          : `${eur(p.price_cents_month)}/mo`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <NumberRow label="Seats included" catalogue={catalogue} value={(p) => (p.included_seats === null ? 'Unlimited' : String(p.included_seats))} />
              <NumberRow label="Email / month" catalogue={catalogue} value={(p) => (p.included_emails_month === null ? 'Negotiated' : p.included_emails_month.toLocaleString('en-GB'))} />
              <NumberRow label="Storage" catalogue={catalogue} value={(p) => (p.included_storage_gb === null ? 'Negotiated' : `${p.included_storage_gb} GB`)} />
              <NumberRow label="Fee on paid enrolments" catalogue={catalogue} value={(p) => feePhrase(p.meet_paid_pct, p.meet_paid_cap_cents)} />
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
                                : 'Unlimited'
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
        <p className="mt-3 text-xs text-ink-muted">
          Prices ex-VAT, per workspace per month. Fibre Meet is in every package. Downgrading never
          deletes anything — what a smaller plan lacks becomes read-only, not gone.
        </p>
      </section>
    </PageContainer>
  );
}

function Usage({
  label,
  used,
  included,
  note,
}: {
  label: string;
  used: number;
  included: number | null;
  note?: string | undefined;
}) {
  const over = included !== null && used > included;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1">
        <span className={`font-mono ${over ? 'text-amber-700 dark:text-amber-400' : 'text-ink'}`}>
          {used.toLocaleString('en-GB')}
        </span>
        <span className="text-ink-muted"> / {included === null ? '∞' : included.toLocaleString('en-GB')}</span>
      </dd>
      {note && <div className="mt-0.5 text-xs text-ink-muted">{note}</div>}
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
