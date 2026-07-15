import Link from 'next/link';
import { cookies } from 'next/headers';
import { Landmark, PiggyBank, TrendingUp, ArrowUpRight } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { money, formatPeriod } from '@/lib/money';
import { COOKIE_CASHFLOW_SCOPE } from '@/lib/prefs-shared';
import { teamName, type CashflowScope, type InvolvedTeam } from '../cashflow/types';
import CashflowChart, { type Projection } from './cashflow-chart';
import { DashboardScopePicker } from './scope-picker';

export const metadata = { title: 'Fibre Pulse' };

async function safeItems<T>(path: string): Promise<T[]> {
  try {
    const r = await apiFetch<{ items: T[] }>(path);
    return r.items ?? [];
  } catch {
    return [];
  }
}

// The scoped projection — Me/Team ride RLS (owner=me / team_id=), Workspace is
// the bare read (admins/granted). Null on an access miss so the page still
// renders with the chooser.
async function fetchProjection(
  scope: CashflowScope,
  scopeTeamId: string | null,
): Promise<Projection | null> {
  try {
    const qs =
      scope === 'me'
        ? '?owner=me'
        : scope === 'team' && scopeTeamId
          ? `?team_id=${scopeTeamId}`
          : '';
    return await apiFetch<Projection>(`/api/v1/pulse/projection${qs}`);
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}

export default async function PulseDashboard() {
  // The preferred cashflow to land on — the SAME cookie the cashflow tab bar
  // writes, so the home page and the grid agree (Sjoerd 2026-07-15).
  const cookieStore = await cookies();
  const scopeCookie = cookieStore.get(COOKIE_CASHFLOW_SCOPE)?.value;

  const [access, involvedTeams, meInfo] = await Promise.all([
    apiFetch<{ can_read_workspace: boolean }>('/api/v1/pulse/access').catch(() => null),
    safeItems<InvolvedTeam>('/api/v1/pulse/involved-teams'),
    apiFetch<{ workspace: { name: string } | null }>('/api/v1/auth/me').catch(() => null),
  ]);
  const canWorkspace = access?.can_read_workspace ?? false;
  const teams = involvedTeams.map((t) => ({ id: t.team_id, name: teamName(t.team) }));
  const workspaceName = meInfo?.workspace?.name ?? null;

  // Resolve the remembered scope; a team cookie must still be one the caller
  // can see, and Workspace collapses to Me when they can't read it.
  let scope: CashflowScope = 'workspace';
  let scopeTeamId: string | null = null;
  if (scopeCookie === 'me') {
    scope = 'me';
  } else if (scopeCookie?.startsWith('team:')) {
    const id = scopeCookie.slice('team:'.length);
    if (id && teams.some((t) => t.id === id)) {
      scope = 'team';
      scopeTeamId = id;
    } else {
      scope = 'me';
    }
  }
  if (scope === 'workspace' && !canWorkspace) scope = 'me';

  const currentKey = scope === 'me' ? 'me' : scope === 'team' && scopeTeamId ? `team:${scopeTeamId}` : 'workspace';

  const projection = await fetchProjection(scope, scopeTeamId);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Pulse</h1>
      <DashboardScopePicker
        currentKey={currentKey}
        teams={teams}
        canWorkspace={canWorkspace}
        workspaceName={workspaceName}
      />
    </div>
  );

  if (!projection) {
    return (
      <div className="px-6 py-10 max-w-5xl">
        {header}
        <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8">
          <p className="text-sm text-ink-muted leading-relaxed">
            This cashflow&apos;s projection isn&apos;t visible to you. Your own deals live in{' '}
            <Link href="/cashflow" className="underline">
              the pipeline
            </Link>
            {teams.length > 0 || canWorkspace ? ' — or switch cashflow above.' : '.'}
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
      {header}
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
