import Link from 'next/link';
import { Landmark, PiggyBank, TrendingUp, ArrowUpRight } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { money, formatPeriod } from '@/lib/money';

export const metadata = { title: 'Fibre Pulse' };

type Period = {
  start: string;
  end: string;
  committed_in: number;
  committed_out: number;
  expected_in: number;
  expected_out: number;
  balance_committed: number;
  balance_expected: number;
  balance_best: number;
};

type Projection = {
  granularity: string;
  currency: string;
  anchor: { bank_cents: number; reserve_cents: number };
  reservation_pct: number;
  dips_below_zero: { committed: string | null; expected: string | null };
  periods: Period[];
};

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
            <Link href="/pipeline" className="underline">
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
          href="/pipeline"
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
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-6">
          <h2 className="text-base font-semibold tracking-tight mb-4">Running balance</h2>
          <BalanceChart periods={periods} />
          <div className="mt-3 flex gap-5 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-emerald-600" /> committed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-indigo-500" />{' '}
              expected (probability-weighted)
            </span>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">Period</th>
                <th className="py-2 pr-4 font-medium text-right">In (committed)</th>
                <th className="py-2 pr-4 font-medium text-right">Out</th>
                <th className="py-2 pr-4 font-medium text-right">Balance</th>
                <th className="py-2 font-medium text-right">Balance (expected)</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.start} className="border-b border-line/50 last:border-0">
                  <td className="py-2 pr-4 text-ink-subtle">{formatPeriod(p.start)}</td>
                  <td className="py-2 pr-4 text-right">{money(p.committed_in, currency)}</td>
                  <td className="py-2 pr-4 text-right">{money(p.committed_out, currency)}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${p.balance_committed < 0 ? 'text-red-600' : 'text-ink'}`}
                  >
                    {money(p.balance_committed, currency)}
                  </td>
                  <td
                    className={`py-2 text-right ${p.balance_expected < 0 ? 'text-red-500' : 'text-ink-subtle'}`}
                  >
                    {money(p.balance_expected, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted leading-relaxed">
            Nothing to project yet. Add{' '}
            <Link href="/accounts" className="underline">
              a bank balance
            </Link>
            , some{' '}
            <Link href="/pipeline" className="underline">
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

// Server-rendered SVG — two polylines over the period buckets. P3 replaces
// this with the full interactive chart; the shape of the answer is the same.
function BalanceChart({ periods }: { periods: Period[] }) {
  const W = 860;
  const H = 200;
  const PAD = 8;
  const values = periods.flatMap((p) => [p.balance_committed, p.balance_expected]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, periods.length - 1);
  const y = (v: number) => PAD + ((max - v) * (H - 2 * PAD)) / span;
  const line = (pick: (p: Period) => number) =>
    periods.map((p, i) => `${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Running balance chart"
    >
      <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} stroke="#e5e5e5" strokeWidth={1} />
      <polyline
        points={line((p) => p.balance_expected)}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <polyline
        points={line((p) => p.balance_committed)}
        fill="none"
        stroke="#059669"
        strokeWidth={2.5}
      />
    </svg>
  );
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
