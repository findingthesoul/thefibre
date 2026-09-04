import { apiFetch, ApiError } from '@/lib/api';
import { appUrl } from '@thefibre/shared';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
} from '@/components/ui/page';
import { PublicPageForm } from './form';

// Your public page — its ADDRESS and location, which are the only parts of
// a profile that belong to Meet. Name, photo and bio come from the platform
// profile (one editor, in The Fibre) — same page shape as The Thread's.

type Host = {
  slug: string;
  location: string | null;
  display_name: string | null;
  bio: string | null;
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
      <PageHeader
        title="Public page"
        description="Where your booking page lives, and what it shows."
      />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {host && (
        <PublicPageForm
          host={host}
          fibreProfileUrl={`${appUrl('fibre-platform', process.env)}/settings/profile`}
        />
      )}
    </PageContainer>
  );
}
