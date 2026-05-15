import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
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
        title="Connections"
        description="Connect external services so Meet can read your calendar and create video links."
      />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {host && (
        <>
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

          <section className="mt-12">
            <SectionLabel>Personal meeting room</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              Used by meeting types set to <strong>Personal room</strong>. A
              static Zoom Personal Meeting Room URL, your Whereby link, anything
              that lives at a fixed URL.
            </p>
            <div className="mt-4">
              <PersonalRoomForm initial={host.personal_room_url ?? ''} />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
