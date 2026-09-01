import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { eur } from '@/lib/plans';

// The platform's own bookkeeping — recurring revenue, ledger income, and the
// request pipeline, from platform tables only. The data wall applies to the
// operator too: operating costs and the per-account business view live in
// Pulse (Solidarity Lab's workspace), fed through the purchase ledger.

export const metadata = { title: 'Economics' };

type Me = { user: { is_super_admin?: boolean } };

type Economics = {
  mrr_cents: number;
  arr_cents: number;
  by_plan: Record<
    string,
    { name: string; total: number; paying: number; comped: number; mrr_cents: number }
  >;
  paying: {
    workspace: string;
    slug: string;
    plan: string;
    status: string;
    interval: string;
    mrr_cents: number;
    tailored: boolean;
  }[];
  comped: { workspace: string; slug: string; plan: string; reason: string | null }[];
  income: {
    d30: { fees_cents: number; subscriptions_cents: number; sales_count: number };
    d90: { fees_cents: number; subscriptions_cents: number; sales_count: number };
  };
  pipeline: Record<string, number>;
};

export default async function AdminEconomicsPage() {
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let data: Economics | null = null;
  try {
    data = await apiFetch<Economics>('/api/v1/admin/economics');
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <PageContainer max="4xl">
        <PageHeader title="Economics" />
        <EmptyState>Could not load the numbers. Check the API log.</EmptyState>
      </PageContainer>
    );
  }

  const planRows = Object.entries(data.by_plan);
  const income30 = data.income.d30;
  const income90 = data.income.d90;

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Economics"
        description="What the platform earns: subscriptions, fees on paid enrolments, and who is on the house. Costs and the full business view live in Pulse."
      />

      {/* Headline ------------------------------------------------------ */}
      <section className="mt-10 grid gap-4 sm:grid-cols-4">
        <Stat label="MRR" value={eur(data.mrr_cents)} />
        <Stat label="ARR (run rate)" value={eur(data.arr_cents)} />
        <Stat label="Paying workspaces" value={String(data.paying.length)} />
        <Stat label="On the house" value={String(data.comped.length)} />
      </section>

      {/* Income -------------------------------------------------------- */}
      <section className="mt-12">
        <SectionLabel>Ledger income</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="px-4 py-2.5 font-normal" />
                <th className="px-4 py-2.5 font-normal">Last 30 days</th>
                <th className="px-4 py-2.5 font-normal">Last 90 days</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="px-4 py-2.5 text-ink-subtle">Subscription invoices paid</td>
                <td className="px-4 py-2.5 font-mono">{eur(income30.subscriptions_cents)}</td>
                <td className="px-4 py-2.5 font-mono">{eur(income90.subscriptions_cents)}</td>
              </tr>
              <tr className="border-b border-line/60">
                <td className="px-4 py-2.5 text-ink-subtle">
                  Fees on paid enrolments (Connect)
                </td>
                <td className="px-4 py-2.5 font-mono">{eur(income30.fees_cents)}</td>
                <td className="px-4 py-2.5 font-mono">{eur(income90.fees_cents)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-ink-subtle">Paid sales in the ledger</td>
                <td className="px-4 py-2.5 font-mono">{income30.sales_count}</td>
                <td className="px-4 py-2.5 font-mono">{income90.sales_count}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Plans --------------------------------------------------------- */}
      <section className="mt-12">
        <SectionLabel>By plan</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="px-4 py-2.5 font-normal">Plan</th>
                <th className="px-4 py-2.5 font-normal">Workspaces</th>
                <th className="px-4 py-2.5 font-normal">Paying</th>
                <th className="px-4 py-2.5 font-normal">Comped</th>
                <th className="px-4 py-2.5 font-normal">MRR</th>
              </tr>
            </thead>
            <tbody>
              {planRows.map(([id, p]) => (
                <tr key={id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5">{p.name}</td>
                  <td className="px-4 py-2.5 font-mono">{p.total}</td>
                  <td className="px-4 py-2.5 font-mono">{p.paying}</td>
                  <td className="px-4 py-2.5 font-mono">{p.comped}</td>
                  <td className="px-4 py-2.5 font-mono">{eur(p.mrr_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Paying -------------------------------------------------------- */}
      {data.paying.length > 0 && (
        <section className="mt-12">
          <SectionLabel>Paying workspaces</SectionLabel>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {data.paying.map((w) => (
              <li key={w.slug} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{w.workspace}</span>
                  <span className="ml-2 text-xs text-ink-muted">
                    {w.plan} · {w.interval}
                    {w.tailored ? ' · tailored' : ''}
                    {w.status !== 'active' ? ` · ${w.status}` : ''}
                  </span>
                </div>
                <span className="font-mono text-sm">{eur(w.mrr_cents)}/mo</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Comped -------------------------------------------------------- */}
      <section className="mt-12">
        <SectionLabel>On the house</SectionLabel>
        {data.comped.length === 0 ? (
          <EmptyState>Nobody. Every workspace pays or is on Free.</EmptyState>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {data.comped.map((w) => (
              <li key={w.slug} className="px-4 py-3 text-sm">
                <span className="font-medium">{w.workspace}</span>
                <span className="ml-2 text-xs text-ink-muted">{w.plan}</span>
                <div className="mt-0.5 text-xs text-ink-muted">
                  {w.reason ?? 'no reason written — write one on Workspaces'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pipeline ------------------------------------------------------ */}
      <section className="mt-12">
        <SectionLabel>Access-request pipeline</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-6 rounded-lg border border-line bg-surface-raised px-5 py-4 text-sm">
          {(['pending', 'approved', 'denied'] as const).map((s) => (
            <div key={s} className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">{s}</span>
              <span className="font-mono">{data.pipeline[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-line pt-6">
        <SectionLabel>Where the costs are</SectionLabel>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-subtle">
          Deliberately not here. Operating costs (Supabase, Vercel, Fly, Resend, domains) are
          budget lines in <span className="font-medium text-ink">Pulse</span>, in Solidarity
          Lab&rsquo;s own workspace — seeded by{' '}
          <code className="font-mono text-xs">apps/api/scripts/seed-operating-costs.mjs</code> and
          corrected against real invoices there. Pulse holds the whole business view: costs against
          income, runway, per-account revenue. This page only shows what the platform tables
          themselves know.
        </p>
      </section>
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-medium tracking-tight">{value}</div>
    </div>
  );
}
