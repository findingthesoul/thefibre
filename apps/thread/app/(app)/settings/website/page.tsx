// Settings → Website — the workspace's public face, in one screen.
//
// Sjoerd, 2026-09-11: three design styles at workspace level, plus the
// ingredients a site is made of. This is where both are chosen; the themes
// that render them live in apps/thread/app/[organiserSlug]/themes.tsx.
//
// It sits under Settings rather than on the sidebar: it is configuration you
// touch twice a year, not work.

import { apiFetch, ApiError } from '@/lib/api';
import { publicSite } from '@/lib/public-site-url';
import { ExternalLink } from 'lucide-react';
import { buttonClassName } from '@thefibre/shared/ui/button';
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

  const { url: publicUrl, workspaceName } = await publicSite();

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'settings_website')}
        description={t(locale, 'settings_website_desc')}
        // Preview in the header, where it is found before scrolling (Sjoerd,
        // 2026-09-14: "the website page should also have a preview link").
        // It opens the live public page, so it shows what is SAVED.
        actions={
          publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClassName('secondary', 'md')}
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              {t(locale, 'site_preview')}
            </a>
          ) : undefined
        }
      />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      {settings && (
        <WebsiteForm
          locale={locale}
          settings={settings}
          publicUrl={publicUrl}
          workspaceName={workspaceName}
        />
      )}
    </PageContainer>
  );
}
