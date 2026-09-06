import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { appUrl } from '@thefibre/shared';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';

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

const STATUS_LABEL: Record<Member['status'], UiKey> = {
  active: 'consent_active',
  grace: 'member_grace',
  lapsed: 'member_lapsed',
  cancelled: 'cancelled',
};

function money(
  cents: number | null | undefined,
  currency: string | null | undefined,
  locale: Locale,
): string | null {
  if (cents === null || cents === undefined) return null;
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export async function MembershipTab({ personId, locale }: { personId: string; locale: Locale }) {
  let data: MembershipData = { member: null };
  try {
    data = await apiFetch<MembershipData>(`/api/v1/persons/${personId}/membership`);
  } catch {
    // Non-fatal — page renders empty state.
  }

  const { member } = data;

  return (
    <>
      <div className="text-xs text-ink-subtle">{t(locale, 'membership_tab_blurb')}</div>

      {!member ? (
        <div className="mt-8">
          <EmptyState>{t(locale, 'no_membership_data')}</EmptyState>
        </div>
      ) : (
        <MemberCard member={member} locale={locale} />
      )}
    </>
  );
}

function MemberCard({ member, locale }: { member: Member; locale: Locale }) {
  const tier = getTier(member);
  const yearly = money(tier?.price_cents_year, tier?.currency, locale);
  const monthly = money(tier?.price_cents_month, tier?.currency, locale);
  const price = [
    yearly ? `${yearly}${t(locale, 'per_year_short')}` : null,
    monthly ? `${monthly}${t(locale, 'per_month_short')}` : null,
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
          {t(locale, 'manage_in_membership')}
        </a>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <Label>{t(locale, 'tier')}</Label>
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
        <Label>{t(locale, 'status')}</Label>
        <Value>
          <StatusChip status={member.status} locale={locale} />
        </Value>
        <Label>{t(locale, 'member_since')}</Label>
        <Value>{member.started_at ? fmtDate(member.started_at, locale) : <Muted>—</Muted>}</Value>
        <Label>{t(locale, 'renews_on')}</Label>
        <Value>{member.renews_at ? fmtDate(member.renews_at, locale) : <Muted>—</Muted>}</Value>
        {member.lapsed_at && (
          <>
            <Label>{t(locale, 'lapsed_on')}</Label>
            <Value>{fmtDate(member.lapsed_at, locale)}</Value>
          </>
        )}
        {member.notes && (
          <>
            <Label>{t(locale, 'notes')}</Label>
            <Value>
              <p className="whitespace-pre-wrap">{member.notes}</p>
            </Value>
          </>
        )}
      </div>
    </section>
  );
}

function StatusChip({ status, locale }: { status: Member['status']; locale: Locale }) {
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
      {t(locale, STATUS_LABEL[status])}
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
