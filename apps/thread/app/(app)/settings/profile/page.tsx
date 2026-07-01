import { apiFetch } from '@/lib/api';
import type { OrganiserRow } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { ProfileForm } from './form';

export default async function ProfileSettingsPage() {
  const organiser = await apiFetch<OrganiserRow>('/api/v1/thread/me');
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Profile"
        description="Your public organiser page — where your threads live."
      />
      <ProfileForm organiser={organiser} />
    </PageContainer>
  );
}
