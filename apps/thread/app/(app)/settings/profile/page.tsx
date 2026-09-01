import { apiFetch } from '@/lib/api';
import { appUrl } from '@thefibre/shared';
import type { OrganiserRow } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { PublicPageForm } from './form';

// Your public page — its ADDRESS, which is the only part of a profile that
// belongs to The Thread.
//
// Sjoerd, 2026-09-01: "It should be exactly the same page.. not different
// pages with the same content." Your name, photo, bio and timezone were
// editable here AND in The Fibre, and The Thread's copy won — which is how he
// came to have a photo on his organiser page and none on his profile.
//
// One editor now, in The Fibre. This page keeps the URL and points at it.

export default async function PublicPageSettings() {
  const organiser = await apiFetch<OrganiserRow>('/api/v1/thread/me');
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Public page"
        description="Where your organiser page lives, and what it shows."
      />
      <PublicPageForm
        organiser={organiser}
        fibreProfileUrl={`${appUrl('fibre-platform', process.env)}/settings/profile`}
      />
    </PageContainer>
  );
}
