import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
import { GoogleConnect } from '../google';

type Host = { google_connected?: boolean };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
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
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Integrations"
        description="Connect external services so Meet can read your calendar and create video links."
      />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {host && (
        <section className="mt-10">
          <SectionLabel>Calendars</SectionLabel>
          <div className="mt-4">
            <GoogleConnect
              connected={!!host.google_connected}
              statusParam={googleStatus ?? null}
              reasonParam={reason ?? null}
            />
          </div>
        </section>
      )}
    </PageContainer>
  );
}
