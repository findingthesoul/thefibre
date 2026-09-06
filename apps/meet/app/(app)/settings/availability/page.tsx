import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { AvailabilityForm } from './form';

type Host = {
  timezone: string;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export default async function AvailabilityPage() {
  const locale = await uiLocale();
  let host: Host | null = null;
  let error: string | null = null;
  try {
    host = await apiFetch<Host>('/api/v1/meet/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'st_availability')}
        description={t(locale, 'st_availability_desc')}
      />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      {host && (
        <div className="mt-10">
          <AvailabilityForm initial={host} locale={locale} />
        </div>
      )}
    </PageContainer>
  );
}
