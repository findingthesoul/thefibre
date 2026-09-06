import { apiFetch } from '@/lib/api';
import { appUrl } from '@thefibre/shared';
import type { OrganiserRow } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { PublicPageForm } from './form';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

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
  const locale = await uiLocale();
  const organiser = await apiFetch<OrganiserRow>('/api/v1/thread/me');
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'settings_public_page')}
        description={t(locale, 'public_page_desc')}
      />
      <PublicPageForm
        locale={locale}
        organiser={organiser}
        fibreProfileUrl={`${appUrl('fibre-platform', process.env)}/settings/profile`}
      />
    </PageContainer>
  );
}
