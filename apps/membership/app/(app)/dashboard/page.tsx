import Link from 'next/link';
import { CalendarClock, UserPlus, Users, Banknote } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { money } from '@/lib/money';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { StatusBadge } from '../members/status-badge';
import { personName, type Member, type Tier } from '../members/types';

export const metadata = { title: 'Membership' };

const DAY = 24 * 60 * 60 * 1000;

export default async function MembershipDashboard() {
  const locale = await uiLocale();
  let members: Member[] = [];
  let tiers: Tier[] = [];
  try {
    const [mR, tR] = await Promise.all([
      apiFetch<{ items: Member[] }>('/api/v1/membership/members?limit=100'),
      apiFetch<{ items: Tier[] }>('/api/v1/membership/tiers'),
    ]);
    members = mR.items;
    tiers = tR.items;
  } catch {
    /* empty state below */
  }

  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const active = members.filter((m) => m.status === 'active');
  const grace = members.filter((m) => m.status === 'grace');
  const lapsed = members.filter((m) => m.status === 'lapsed');

  // Annual run-rate of active memberships: yearly price, or monthly × 12.
  const annualCents = active.reduce((sum, m) => {
    const t = tierById.get(m.tier_id);
    return sum + (t?.price_cents_year ?? (t?.price_cents_month ?? 0) * 12);
  }, 0);
  const currency = tiers[0]?.currency ?? 'EUR';

  const now = Date.now();
  const renewingSoon = members
    .filter(
      (m) =>
        (m.status === 'active' || m.status === 'grace') &&
        m.renews_at &&
        new Date(m.renews_at).getTime() >= now &&
        new Date(m.renews_at).getTime() <= now + 30 * DAY,
    )
    .sort((a, b) => (a.renews_at ?? '').localeCompare(b.renews_at ?? ''));

  const recentJoins = [...members]
    .filter((m) => m.started_at)
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
    .slice(0, 5);

  const intl = INTL_LOCALES[locale];

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">
        {t(locale, 'nav_membership')}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">{t(locale, 'dash_blurb')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} value={active.length} label={t(locale, 'active_members')} />
        <StatCard icon={CalendarClock} value={grace.length} label={t(locale, 'in_grace')} />
        <StatCard icon={UserPlus} value={lapsed.length} label={t(locale, 'lapsed_label')} />
        <StatCard
          icon={Banknote}
          value={money(annualCents, currency)}
          label={t(locale, 'annual_value')}
          sub={t(locale, 'annual_value_sub')}
        />
      </div>

      {members.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface-raised p-8 text-center">
          <p className="text-sm text-ink-muted leading-relaxed">
            {t(locale, 'dash_empty_before')}{' '}
            <Link href="/members" className="underline">
              {t(locale, 'nav_members')}
            </Link>{' '}
            {t(locale, 'dash_empty_after')}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Panel title={t(locale, 'renewing_soon')} sub={t(locale, 'next_30_days')}>
            {renewingSoon.length === 0 ? (
              <div className="px-5 py-4 text-sm text-ink-muted">
                {t(locale, 'no_renewals_30')}
              </div>
            ) : (
              renewingSoon.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  locale={locale}
                  right={m.renews_at ? new Date(m.renews_at).toLocaleDateString(intl) : '—'}
                />
              ))
            )}
          </Panel>
          <Panel title={t(locale, 'recent_joins')} sub={t(locale, 'latest_5')}>
            {recentJoins.length === 0 ? (
              <div className="px-5 py-4 text-sm text-ink-muted">{t(locale, 'no_joins_yet')}</div>
            ) : (
              recentJoins.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  locale={locale}
                  right={m.started_at ? new Date(m.started_at).toLocaleDateString(intl) : '—'}
                />
              ))
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  sub,
}: {
  icon: typeof Users;
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <Link
      href="/members"
      className="rounded-2xl border border-line bg-surface-raised p-5 hover:bg-surface-sunken transition-colors"
    >
      <Icon size={18} strokeWidth={1.75} className="text-ink-muted" />
      <div className="mt-3 text-xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="text-sm text-ink-subtle">{label}</div>
      {sub && <div className="text-xs text-ink-muted mt-0.5">{sub}</div>}
    </Link>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-raised overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-baseline justify-between">
        <span className="text-sm font-semibold tracking-tight text-ink">{title}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </div>
      <div className="divide-y divide-line/60">{children}</div>
    </div>
  );
}

function MemberRow({
  member,
  right,
  locale,
}: {
  member: Member;
  right: string;
  locale: Locale;
}) {
  return (
    <Link
      href="/members"
      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
    >
      <div className="min-w-0">
        <div className="text-sm text-ink truncate">
          {personName(member.person, t(locale, 'unknown_person'))}
        </div>
        <div className="text-xs text-ink-muted truncate">{member.tier?.name ?? '—'}</div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <StatusBadge status={member.status} locale={locale} />
        <span className="text-xs text-ink-muted tabular-nums">{right}</span>
      </div>
    </Link>
  );
}
