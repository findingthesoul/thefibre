import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
import { GoogleConnect } from './google-connect';
import { PersonalRoomForm } from './personal-room';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

// Connections are a user-level SPoT: one Google Calendar link + one personal
// meeting room per person, shared across the Fibre apps. The data lives
// behind /api/v1/meet/connections; this page manages the same row Meet's
// Settings → Connections does.

type Connections = {
  google_connected: boolean;
  personal_room_url: string | null;
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const locale = await uiLocale();
  const { google: googleStatus, reason } = await searchParams;
  let conn: Connections | null = null;
  let error: string | null = null;
  try {
    conn = await apiFetch<Connections>('/api/v1/meet/connections');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'connections_title')}
        description={t(locale, 'connections_desc')}
      />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      {conn && (
        <>
          <section className="mt-10">
            <SectionLabel>{t(locale, 'calendars')}</SectionLabel>
            <div className="mt-4">
              <GoogleConnect
                locale={locale}
                connected={conn.google_connected}
                statusParam={googleStatus ?? null}
                reasonParam={reason ?? null}
              />
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>{t(locale, 'personal_room')}</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              {t(locale, 'personal_room_desc_1')}{' '}
              <strong>{t(locale, 'personal_room_option')}</strong>{' '}
              {t(locale, 'personal_room_desc_2')}
            </p>
            <div className="mt-4">
              <PersonalRoomForm locale={locale} initial={conn.personal_room_url ?? ''} />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
