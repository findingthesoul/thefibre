import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ZoomConnect } from '../../settings/connections/zoom-connect';

// THE address we give Zoom.
//
// The Marketplace review (2026-10-08) requires that the URL on our listing
// takes somebody STRAIGHT to connecting Zoom: signed in, the Connect button;
// signed out, sign-in and then back here. `/settings/connections` could not
// do the second half — the (app) layout bounced an unsigned visit to the
// landing page, where the reviewer would be stranded with no way back — so
// this route exists and `/integrations` is on the round-trip list beside
// `/connect`.
//
// It is also a PUBLISHED address, which is the other reason not to point Zoom
// at a settings page: our settings layout is ours to rearrange, and a URL in
// somebody else's marketplace listing is not. This path stays put.
//
// Not a second Zoom UI: the card is the same `ZoomConnect` the Connections
// page renders, with nothing else on the page, so the Connect button is the
// first thing in view rather than the third section down.

type Connections = {
  zoom_connected?: boolean;
  zoom_account_email?: string | null;
  zoom_configured?: boolean;
};

export default async function ZoomIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ zoom?: string; reason?: string }>;
}) {
  const { zoom: zoomStatus, reason } = await searchParams;
  const locale = await uiLocale();
  let conn: Connections | null = null;
  let error: string | null = null;
  try {
    conn = await apiFetch<Connections>('/api/v1/meet/connections');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="3xl">
      <PageHeader
        title={t(locale, 'zoom_page_title')}
        description={t(locale, 'zoom_page_blurb')}
      />
      {error && <ErrorBanner>{t(locale, 'load_failed')} {error}</ErrorBanner>}
      {conn && (
        <div className="mt-8">
          <ZoomConnect
            locale={locale}
            connected={!!conn.zoom_connected}
            accountEmail={conn.zoom_account_email ?? null}
            configured={conn.zoom_configured !== false}
            statusParam={zoomStatus ?? null}
            reasonParam={reason ?? null}
          />
        </div>
      )}
      <p className="mt-10 text-sm text-ink-subtle">
        <Link href="/settings/connections" className="underline">
          {t(locale, 'zoom_page_all_connections')}
        </Link>
      </p>
    </PageContainer>
  );
}
