import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  EmptyState,
} from '@/components/ui/page';
import { CalendarRow, type Cal } from './row';

export default async function CalendarsPage() {
  let items: Cal[] = [];
  let connected = false;
  let error: string | null = null;
  try {
    const [me, cals] = await Promise.all([
      apiFetch<{ google_connected?: boolean }>('/api/v1/meet/me'),
      apiFetch<{ items: Cal[] }>('/api/v1/meet/calendars').catch(() => ({ items: [] })),
    ]);
    connected = !!me.google_connected;
    items = cals.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Calendars"
        description="Pick which Google calendars block availability and where new bookings get created."
      />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      {!connected ? (
        <div className="mt-10 rounded-lg border border-line bg-surface-raised p-6">
          <div className="text-sm">
            Google Calendar isn&apos;t connected yet.{' '}
            <a href="/settings/integrations" className="underline">
              Connect it
            </a>{' '}
            first.
          </div>
        </div>
      ) : (
        <section className="mt-10">
          <div className="rounded-lg border border-line bg-surface-raised p-6">
            <div className="text-base font-medium">Connected calendars</div>
            <p className="mt-1 text-sm text-ink-subtle">
              Conflict sources block availability; the write target receives new bookings.
            </p>
            {items.length === 0 ? (
              <EmptyState>No calendars synced yet.</EmptyState>
            ) : (
              <ul className="mt-5 space-y-2">
                {items.map((c) => (
                  <CalendarRow key={c.id} cal={c} />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-line bg-surface-raised p-6 text-sm text-ink-subtle leading-relaxed">
            <div className="font-medium text-ink">Don&apos;t see a calendar you expected?</div>
            <p className="mt-2">
              Fibre Meet shows every Google calendar you own or have write access
              to. Add the calendar inside Google Calendar and disconnect /
              reconnect the integration to refresh the list.
            </p>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
