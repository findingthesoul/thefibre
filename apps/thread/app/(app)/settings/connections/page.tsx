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
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Connections"
        description="External services connected to your account — one connection per person, shared across Meet and Thread."
      />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {conn && (
        <>
          <section className="mt-10">
            <SectionLabel>Calendars</SectionLabel>
            <div className="mt-4">
              <GoogleConnect
                connected={conn.google_connected}
                statusParam={googleStatus ?? null}
                reasonParam={reason ?? null}
              />
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>Personal meeting room</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              Used by activities set to <strong>Personal room</strong> — a
              static Zoom Personal Meeting Room URL, your Whereby link,
              anything that lives at a fixed URL.
            </p>
            <div className="mt-4">
              <PersonalRoomForm initial={conn.personal_room_url ?? ''} />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
