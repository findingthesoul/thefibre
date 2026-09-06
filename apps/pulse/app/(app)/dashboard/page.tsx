import Link from 'next/link';
import { cookies } from 'next/headers';
import { Landmark, PiggyBank, TrendingUp, ArrowUpRight } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { money, formatPeriod } from '@/lib/money';
import { COOKIE_CASHFLOW_SCOPE } from '@/lib/prefs-shared';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { teamName, type CashflowScope, type InvolvedTeam } from '../cashflow/types';
import CashflowChart, { type Projection } from './cashflow-chart';
import { DashboardScopePicker } from './scope-picker';

export const metadata = { title: 'Pulse' };

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
  const locale = await uiLocale();
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
        locale={locale}
      />
    </div>
  );

  if (!projection) {
    return (
      <div className="px-6 py-10 max-w-5xl">
        {header}
        <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8">
          <p className="text-sm text-ink-muted leading-relaxed">
            {t(locale, 'dash_no_access_before')}{' '}
            <Link href="/cashflow" className="underline">
              {t(locale, 'dash_no_access_link')}
            </Link>
            {teams.length > 0 || canWorkspace ? ` ${t(locale, 'dash_no_access_switch')}` : '.'}
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
      <p className="mt-1 text-sm text-ink-muted">{runwaySentence(locale, dips, hasData)}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/accounts"
          icon={Landmark}
          value={money(anchor.bank_cents, currency)}
          label={t(locale, 'in_the_bank')}
          sub={t(locale, 'latest_snapshots')}
        />
        <StatCard
          href="/accounts"
          icon={PiggyBank}
          value={money(anchor.reserve_cents, currency)}
          label={t(locale, 'reserved')}
          sub={t(locale, 'earmarked_buckets')}
        />
        <StatCard
          href="/cashflow"
          icon={TrendingUp}
          value={money(
            periods.reduce((a, p) => a + p.expected_in, 0),
            currency,
          )}
          label={t(locale, 'expected_in')}
          sub={t(locale, 'next_n_periods', { n: periods.length })}
        />
      </div>

      {hasData ? (
        <CashflowChart projection={projection} locale={locale} />
      ) : (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted leading-relaxed">
            {t(locale, 'proj_empty_1')}{' '}
            <Link href="/accounts" className="underline">
              {t(locale, 'proj_empty_link_bank')}
            </Link>
            {t(locale, 'proj_empty_2')}{' '}
            <Link href="/cashflow" className="underline">
              {t(locale, 'proj_empty_link_income')}
            </Link>{' '}
            {t(locale, 'proj_empty_3')}{' '}
            <Link href="/budget" className="underline">
              {t(locale, 'proj_empty_link_costs')}
            </Link>{' '}
            {t(locale, 'proj_empty_4')}
          </p>
        </div>
      )}
    </div>
  );
}

function runwaySentence(
  locale: Locale,
  dips: { committed: string | null; expected: string | null },
  hasData: boolean,
): string {
  const intl = INTL_LOCALES[locale];
  if (!hasData) return t(locale, 'runway_default');
  if (!dips.committed && !dips.expected) {
    return t(locale, 'runway_above_zero');
  }
  if (dips.committed && dips.expected) {
    return t(locale, 'runway_both', {
      c: formatPeriod(dips.committed, intl),
      e: formatPeriod(dips.expected, intl),
    });
  }
  if (dips.committed) {
    return t(locale, 'runway_committed', { c: formatPeriod(dips.committed, intl) });
  }
  return t(locale, 'runway_expected', { e: formatPeriod(dips.expected!, intl) });
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
