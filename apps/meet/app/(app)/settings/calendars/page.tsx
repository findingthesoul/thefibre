import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  EmptyState,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { CalendarRow, type Cal } from './row';
import { ResyncButton } from './resync';

export default async function CalendarsPage() {
  const locale = await uiLocale();
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
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'st_calendars')}
        description={t(locale, 'cal_page_desc')}
      />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {!connected ? (
        <div className="mt-10 rounded-lg border border-line bg-surface-raised p-6">
          <div className="text-sm">
            {t(locale, 'cal_not_connected')}{' '}
            <a href="/settings/integrations" className="underline">
              {t(locale, 'cal_connect_first')}
            </a>
          </div>
        </div>
      ) : (
        <section className="mt-10">
          <div className="rounded-lg border border-line bg-surface-raised p-6">
            <div className="text-base font-medium">{t(locale, 'cal_connected_title')}</div>
            <p className="mt-1 text-sm text-ink-subtle">
              {t(locale, 'cal_connected_desc')}
            </p>
            {items.length === 0 ? (
              <>
                <EmptyState>{t(locale, 'cal_empty')}</EmptyState>
                <ResyncButton locale={locale} />
              </>
            ) : (
              <>
                <ul className="mt-5 space-y-2">
                  {items.map((c) => (
                    <CalendarRow key={c.id} cal={c} locale={locale} />
                  ))}
                </ul>
                <ResyncButton locale={locale} />
              </>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-line bg-surface-raised p-6 text-sm text-ink-subtle leading-relaxed">
            <div className="font-medium text-ink">{t(locale, 'cal_missing_title')}</div>
            <p className="mt-2">
              {t(locale, 'cal_missing_body')}
            </p>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
