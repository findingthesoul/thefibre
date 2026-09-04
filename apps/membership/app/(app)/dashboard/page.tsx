import Link from 'next/link';
import { CalendarClock, UserPlus, Users, Banknote } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { money } from '@/lib/money';
import { StatusBadge } from '../members/status-badge';
import { personName, type Member, type Tier } from '../members/types';

export const metadata = { title: 'Membership' };

const DAY = 24 * 60 * 60 * 1000;

export default async function MembershipDashboard() {
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

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Membership</h1>
      <p className="mt-1 text-sm text-ink-muted">Your community&apos;s memberships at a glance.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} value={active.length} label="Active members" />
        <StatCard icon={CalendarClock} value={grace.length} label="In grace" />
        <StatCard icon={UserPlus} value={lapsed.length} label="Lapsed" />
        <StatCard
          icon={Banknote}
          value={money(annualCents, currency)}
          label="Annual value"
          sub="active members, yearly rate"
        />
      </div>

      {members.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface-raised p-8 text-center">
          <p className="text-sm text-ink-muted leading-relaxed">
            No members yet. Add one on the{' '}
            <Link href="/members" className="underline">
              Members
            </Link>{' '}
            page, or share your join page once tiers are set up.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Panel title="Renewing soon" sub="next 30 days">
            {renewingSoon.length === 0 ? (
              <div className="px-5 py-4 text-sm text-ink-muted">No renewals in the next 30 days.</div>
            ) : (
              renewingSoon.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  right={
                    m.renews_at ? new Date(m.renews_at).toLocaleDateString('en-GB') : '—'
                  }
                />
              ))
            )}
          </Panel>
          <Panel title="Recent joins" sub="latest 5">
            {recentJoins.length === 0 ? (
              <div className="px-5 py-4 text-sm text-ink-muted">No joins recorded yet.</div>
            ) : (
              recentJoins.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  right={
                    m.started_at ? new Date(m.started_at).toLocaleDateString('en-GB') : '—'
                  }
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

function MemberRow({ member, right }: { member: Member; right: string }) {
  return (
    <Link
      href="/members"
      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
    >
      <div className="min-w-0">
        <div className="text-sm text-ink truncate">{personName(member.person)}</div>
        <div className="text-xs text-ink-muted truncate">{member.tier?.name ?? '—'}</div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <StatusBadge status={member.status} />
        <span className="text-xs text-ink-muted tabular-nums">{right}</span>
      </div>
    </Link>
  );
}
