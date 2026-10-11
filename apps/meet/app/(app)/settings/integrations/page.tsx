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
import { ZoomConnect } from './zoom';
import { TeamsConnect } from './teams';
import { PersonalRoomForm } from './personal-room';

type Host = {
  google_connected?: boolean;
  zoom_connected?: boolean;
  zoom_account_email?: string | null;
  zoom_configured?: boolean;
  /** Temporary, while the Zoom Marketplace app is in review. */
  zoom_pending_notice?: boolean;
  teams_connected?: boolean;
  teams_account_email?: string | null;
  teams_configured?: boolean;
  personal_room_url: string | null;
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; zoom?: string; teams?: string; reason?: string }>;
}) {
  const locale = await uiLocale();
  const { google: googleStatus, zoom: zoomStatus, teams: teamsStatus, reason } = await searchParams;
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
            <SectionLabel>{t(locale, 'tab_conferencing')}</SectionLabel>
            <div className="mt-4">
          {/* Zoom is still in Marketplace review, so Connect may not work
              yet. The API decides who is told — super admins and the
              reviewer's workspace are not. REMOVE WHEN THE ZOOM MARKETPLACE
              APP IS PUBLISHED (apps/api/src/lib/zoom-pending.ts). */}
              <ZoomConnect
                pendingNotice={host?.zoom_pending_notice === true}
                connected={!!host.zoom_connected}
                accountEmail={host.zoom_account_email ?? null}
                configured={host.zoom_configured !== false}
                statusParam={zoomStatus ?? null}
                reasonParam={reason ?? null}
                locale={locale}
              />
            </div>
            <div className="mt-4">
              {/* `=== true`, not `!== false` like Zoom above. Zoom's field
                  predates some deployments, so absent has to mean "assume
                  yes" there. teams_configured ships with this card, so absent
                  means the API could not say — and the safe answer to "can
                  you connect?" is no, with the reason in words, rather than
                  an enabled button that 503s. */}
              <TeamsConnect
                connected={!!host.teams_connected}
                accountEmail={host.teams_account_email ?? null}
                configured={host.teams_configured === true}
                statusParam={teamsStatus ?? null}
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
