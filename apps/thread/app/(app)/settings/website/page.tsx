// Settings → Website — the workspace's public face, in one screen.
//
// Sjoerd, 2026-09-11: three design styles at workspace level, plus the
// ingredients a site is made of. This is where both are chosen; the themes
// that render them live in apps/thread/app/[organiserSlug]/themes.tsx.
//
// It sits under Settings rather than on the sidebar: it is configuration you
// touch twice a year, not work.

import { apiFetch, ApiError } from '@/lib/api';
import { appUrl } from '@thefibre/shared';
import { PageContainer, PageHeader, Breadcrumb, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { WebsiteForm, type SiteSettings } from './form';

export const dynamic = 'force-dynamic';

export default async function WebsiteSettingsPage() {
  const locale = await uiLocale();
  let settings: SiteSettings | null = null;
  let error: string | null = null;
  try {
    settings = await apiFetch<SiteSettings>('/api/v1/thread/settings');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // The address to preview. The workspace slug is the canonical owner of a
  // workspace site (docs/brief-workspace-urls.md D1); falling back to the
  // organiser's keeps the link useful for a personal workspace.
  const brand = await apiFetch<{ slug: string | null }>('/api/v1/workspace-brand').catch(
    () => ({ slug: null }),
  );
  const me = await apiFetch<{ slug: string }>('/api/v1/thread/me').catch(() => null);
  const ownerSlug = brand.slug ?? me?.slug ?? null;

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'settings_website')}
        description={t(locale, 'settings_website_desc')}
      />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      {settings && (
        <WebsiteForm
          locale={locale}
          settings={settings}
          publicUrl={ownerSlug ? `${appUrl('the-thread', process.env)}/${ownerSlug}` : null}
        />
      )}
    </PageContainer>
  );
}
