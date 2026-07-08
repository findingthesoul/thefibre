import { apiFetch } from '@/lib/api';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { ProfileForm, type PlatformProfile } from './form';

// Ported from The Thread's settings/profile page, trimmed to the PLATFORM
// profile (/api/v1/profile — user_profile, one face per user shared by
// every Fibre app). Thread layers its organiser page (slug, public URL,
// photo upload via the Thread-only uploads endpoint) on top; Pulse has no
// public page, so those pieces were dropped.

export const metadata = { title: 'Profile settings · Fibre Pulse' };

export default async function ProfileSettingsPage() {
  const profile = await apiFetch<PlatformProfile>('/api/v1/profile');
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Profile"
        description="Your Fibre profile — display name, bio and timezone, shared by every Fibre app."
      />
      <ProfileForm profile={profile} />
    </PageContainer>
  );
}
