import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { GoogleConnect } from '../google';
import { PersonalRoomForm } from './personal-room';

type Host = {
  google_connected?: boolean;
  personal_room_url: string | null;
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const locale = await uiLocale();
  const { google: googleStatus, reason } = await searchParams;
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
        title={t(locale, 'int_title')}
        description={t(locale, 'int_desc')}
      />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      {host && (
        <>
          <section className="mt-10">
            <SectionLabel>{t(locale, 'st_calendars')}</SectionLabel>
            <div className="mt-4">
              <GoogleConnect
                connected={!!host.google_connected}
                statusParam={googleStatus ?? null}
                reasonParam={reason ?? null}
                locale={locale}
              />
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>{t(locale, 'personal_room')}</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              {t(locale, 'int_room_desc')}
            </p>
            <div className="mt-4">
              <PersonalRoomForm initial={host.personal_room_url ?? ''} locale={locale} />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
