import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { BookingsClient, type BookingRow, type ScopeOption } from './client';
import { NewBookingButton, type BookableType } from './new-booking';

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
  let bookable: BookableType[] = [];
  let error: string | null = null;
  try {
    const qs = new URLSearchParams();
    qs.set('scope', scope);
    if (includeCancelled) qs.set('include_cancelled', '1');
    if (teamFilter) qs.set('team_id', teamFilter);
    const [bs, ts, mts] = await Promise.all([
      apiFetch<{ items: BookingRow[] }>(`/api/v1/meet/bookings?${qs.toString()}`),
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams').catch(() => ({ items: [] })),
      // What you can book somebody into. Archived and one-off types are out:
      // a one-off IS its time, so there is nothing to choose.
      apiFetch<{ items: (BookableType & { archived_at: string | null; event_type: string })[] }>(
        '/api/v1/meet/meeting-types',
      ).catch(() => ({ items: [] })),
    ]);
    items = bs.items;
    teams = ts.items;
    bookable = mts.items
      .filter((m) => !m.archived_at && m.event_type !== 'one_off' && m.event_type !== 'poll')
      .map((m) => ({
        id: m.id,
        name: m.name,
        duration_minutes: m.duration_minutes,
        price_cents: m.price_cents,
        price_currency: m.price_currency,
      }));
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
      <PageHeader
        title={t(locale, 'bookings_title')}
        description={t(locale, 'bookings_desc')}
        actions={<NewBookingButton types={bookable} locale={locale} />}
      />

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
