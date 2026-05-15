import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
} from '@/components/ui/page';
import { AvailabilityForm } from './form';

type Host = {
  timezone: string;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export default async function AvailabilityPage() {
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
      <PageHeader title="Availability" description="Timezone and weekly working hours." />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {host && (
        <div className="mt-10">
          <AvailabilityForm initial={host} />
        </div>
      )}
    </PageContainer>
  );
}
