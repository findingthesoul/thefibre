import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { BookingsClient, type BookingRow, type ScopeOption } from './client';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: 'upcoming' | 'past' | 'all';
    view?: 'list' | 'week' | 'month';
    include_cancelled?: string;
    team_id?: string;
  }>;
}) {
  const locale = await uiLocale();
  const sp = await searchParams;
  const scope = sp.scope ?? 'upcoming';
  const view = sp.view ?? 'list';
  const includeCancelled = sp.include_cancelled === '1';
  const teamFilter = sp.team_id ?? '';

  let items: BookingRow[] = [];
  let teams: Team[] = [];
  let error: string | null = null;
  try {
    const qs = new URLSearchParams();
    qs.set('scope', scope);
    if (includeCancelled) qs.set('include_cancelled', '1');
    if (teamFilter) qs.set('team_id', teamFilter);
    const [bs, ts] = await Promise.all([
      apiFetch<{ items: BookingRow[] }>(`/api/v1/meet/bookings?${qs.toString()}`),
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams').catch(() => ({ items: [] })),
    ]);
    items = bs.items;
    teams = ts.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const scopeOptions: ScopeOption[] = [
    { value: '', label: t(locale, 'all_scopes') },
    { value: 'personal', label: t(locale, 'personal') },
    ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
  ];

  return (
    <PageContainer max="5xl">
      <PageHeader title={t(locale, 'bookings_title')} description={t(locale, 'bookings_desc')} />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      <div className="mt-8">
        <BookingsClient
          items={items}
          scope={scope}
          view={view}
          includeCancelled={includeCancelled}
          teamFilter={teamFilter}
          scopeOptions={scopeOptions}
          locale={locale}
        />
      </div>
    </PageContainer>
  );
}
