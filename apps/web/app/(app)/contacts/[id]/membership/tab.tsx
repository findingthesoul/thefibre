import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { appUrl } from '@thefibre/shared';

type Tier = {
  id: string;
  name: string;
  price_cents_year: number | null;
  price_cents_month: number | null;
  currency: string | null;
};

type Member = {
  id: string;
  status: 'active' | 'grace' | 'lapsed' | 'cancelled';
  started_at: string | null;
  renews_at: string | null;
  lapsed_at: string | null;
  notes: string | null;
  tier: Tier | Tier[] | null;
};

type MembershipData = { member: Member | null };

function getTier(m: Member): Tier | null {
  if (!m.tier) return null;
  return Array.isArray(m.tier) ? m.tier[0] ?? null : m.tier;
}

const STATUS_LABEL: Record<Member['status'], string> = {
  active: 'Active',
  grace: 'Grace',
  lapsed: 'Lapsed',
  cancelled: 'Cancelled',
};

function money(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export async function MembershipTab({ personId }: { personId: string }) {
  let data: MembershipData = { member: null };
  try {
    data = await apiFetch<MembershipData>(`/api/v1/persons/${personId}/membership`);
  } catch {
    // Non-fatal — page renders empty state.
  }

  const { member } = data;

  return (
    <>
      <div className="text-xs text-ink-subtle">
        What <span className="text-ink font-medium">Membership</span> knows
        about this person: tier, status and renewal. Identity (name, email) is
        owned by the platform.
      </div>

      {!member ? (
        <div className="mt-8">
          <EmptyState>No membership data.</EmptyState>
        </div>
      ) : (
        <MemberCard member={member} />
      )}
    </>
  );
}

function MemberCard({ member }: { member: Member }) {
  const tier = getTier(member);
  const yearly = money(tier?.price_cents_year, tier?.currency);
  const monthly = money(tier?.price_cents_month, tier?.currency);
  const price = [
    yearly ? `${yearly}/year` : null,
    monthly ? `${monthly}/month` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <SectionLabel>Membership</SectionLabel>
        <a
          href={appUrl('membership', process.env)}
          className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Manage in Membership
        </a>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <Label>Tier</Label>
        <Value>
          {tier ? (
            <>
              {tier.name}
              {price && <span className="text-ink-subtle"> · {price}</span>}
            </>
          ) : (
            <Muted>—</Muted>
          )}
        </Value>
        <Label>Status</Label>
        <Value>
          <StatusChip status={member.status} />
        </Value>
        <Label>Member since</Label>
        <Value>{member.started_at ? fmtDate(member.started_at) : <Muted>—</Muted>}</Value>
        <Label>Renews on</Label>
        <Value>{member.renews_at ? fmtDate(member.renews_at) : <Muted>—</Muted>}</Value>
        {member.lapsed_at && (
          <>
            <Label>Lapsed on</Label>
            <Value>{fmtDate(member.lapsed_at)}</Value>
          </>
        )}
        {member.notes && (
          <>
            <Label>Notes</Label>
            <Value>
              <p className="whitespace-pre-wrap">{member.notes}</p>
            </Value>
          </>
        )}
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: Member['status'] }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'grace'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-surface-sunken text-ink-muted border-line';
  return (
    <span
      className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${cls}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-ink-muted text-xs uppercase tracking-wider pt-0.5">
      {children}
    </div>
  );
}
function Value({ children }: { children: React.ReactNode }) {
  return <div className="text-ink-strong">{children}</div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}
