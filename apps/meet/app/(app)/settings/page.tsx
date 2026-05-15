import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { SettingsForm } from './form';

type Host = {
  id: string;
  slug: string;
  bio: string | null;
  location: string | null;
  personal_room_url: string | null;
  timezone: string;
  photo_url: string | null;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export default async function SettingsPage() {
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
        <div className="mt-10">
          <SettingsForm initial={host} />
        </div>
      )}
    </PageContainer>
  );
}
