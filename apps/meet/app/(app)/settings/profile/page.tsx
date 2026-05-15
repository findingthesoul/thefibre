import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
} from '@/components/ui/page';
import { ProfileForm } from './form';

type Host = {
  slug: string;
  bio: string | null;
  location: string | null;
  photo_url: string | null;
};

export default async function ProfilePage() {
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
      <PageHeader title="Profile" description="How you appear on your public booking page." />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {host && (
        <div className="mt-10">
          <ProfileForm initial={host} />
        </div>
      )}
    </PageContainer>
  );
}
