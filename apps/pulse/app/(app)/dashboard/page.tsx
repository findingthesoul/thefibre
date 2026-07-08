import Link from 'next/link';
import { Landmark, PiggyBank, TrendingUp, ArrowUpRight } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { money, formatPeriod } from '@/lib/money';
import CashflowChart, { type Projection } from './cashflow-chart';

export const metadata = { title: 'Fibre Pulse' };

export default async function PulseDashboard() {
  let projection: Projection | null = null;
  try {
    projection = await apiFetch<Projection>('/api/v1/pulse/projection');
  } catch (e) {
    // Non-admins can't read the money surfaces (proposal §2.4) — they still
    // get the page with a pointer to their own pipeline.
    if (!(e instanceof ApiError)) throw e;
  }

  if (!projection) {
    return (
      <div className="px-6 py-10 max-w-5xl">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Pulse</h1>
        <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8">
          <p className="text-sm text-ink-muted leading-relaxed">
            The projection is visible to workspace admins. Your own deals live in{' '}
            <Link href="/cashflow" className="underline">
              the pipeline
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const { periods, currency, anchor, dips_below_zero: dips } = projection;
  const hasData =
    anchor.bank_cents !== 0 ||
    periods.some((p) => p.expected_in || p.expected_out || p.committed_in || p.committed_out);

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Pulse</h1>
      <p className="mt-1 text-sm text-ink-muted">{runwaySentence(dips, hasData)}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/accounts"
          icon={Landmark}
          value={money(anchor.bank_cents, currency)}
          label="In the bank"
          sub="latest snapshots"
        />
        <StatCard
          href="/accounts"
          icon={PiggyBank}
          value={money(anchor.reserve_cents, currency)}
          label="Reserved"
          sub="earmarked buckets"
        />
        <StatCard
          href="/cashflow"
          icon={TrendingUp}
          value={money(
            periods.reduce((a, p) => a + p.expected_in, 0),
            currency,
          )}
          label="Expected in"
          sub={`next ${periods.length} periods, weighted`}
        />
      </div>

      {hasData ? (
        <CashflowChart projection={projection} />
      ) : (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted leading-relaxed">
            Nothing to project yet. Add{' '}
            <Link href="/accounts" className="underline">
              a bank balance
            </Link>
            , some{' '}
            <Link href="/cashflow" className="underline">
              expected income
            </Link>{' '}
            and{' '}
            <Link href="/budget" className="underline">
              recurring costs
            </Link>{' '}
            — the chart draws itself.
          </p>
        </div>
      )}
    </div>
  );
}

function runwaySentence(
  dips: { committed: string | null; expected: string | null },
  hasData: boolean,
): string {
  if (!hasData) return 'Your cashflow, projected forward.';
  if (!dips.committed && !dips.expected) {
    return 'You stay above zero for the whole horizon. Breathe.';
  }
  if (dips.committed && dips.expected) {
    return `On committed money you dip below zero around ${formatPeriod(dips.committed)}; with the weighted pipeline around ${formatPeriod(dips.expected)}.`;
  }
  if (dips.committed) {
    return `On committed money alone you dip below zero around ${formatPeriod(dips.committed)} — the weighted pipeline keeps you above.`;
  }
  return `The weighted projection dips below zero around ${formatPeriod(dips.expected!)}.`;
}

function StatCard({
  href,
  icon: Icon,
  value,
  label,
  sub,
}: {
  href: string;
  icon: typeof Landmark;
  value: string | number;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-5 hover:ring-black/10 transition"
    >
      <div className="flex items-start justify-between">
        <Icon size={18} strokeWidth={1.75} className="text-ink-muted" />
        <ArrowUpRight
          size={14}
          className="text-ink-muted opacity-0 group-hover:opacity-100 transition"
        />
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="text-sm text-ink-subtle">{label}</div>
      <div className="text-xs text-ink-muted mt-0.5">{sub}</div>
    </Link>
  );
}
