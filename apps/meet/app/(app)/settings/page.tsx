import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  ErrorBanner,
} from '@/components/ui/page';
import { SettingsForm } from './form';
import { GoogleConnect } from './google';

type Host = {
  id: string;
  slug: string;
  bio: string | null;
  location: string | null;
  personal_room_url: string | null;
  timezone: string;
  photo_url: string | null;
  working_hours: Record<string, { start: string; end: string }[]> | null;
  google_connected?: boolean;
};

export default async function SettingsPage({
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
      <PageHeader
        title="Settings"
        description="How you appear on your public booking page."
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      {host && (
        <>
          <div className="mt-10">
            <SettingsForm initial={host} />
          </div>

          <section className="mt-14">
            <SectionLabel>Integrations</SectionLabel>
            <div className="mt-4">
              <GoogleConnect
                connected={!!host.google_connected}
                statusParam={googleStatus ?? null}
                reasonParam={reason ?? null}
              />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
