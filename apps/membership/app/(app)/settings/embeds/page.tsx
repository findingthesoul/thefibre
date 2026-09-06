import { appUrl } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { EmbedsCard } from '../embeds-card';

type Me = { workspace: { slug: string } | null };

export default async function EmbedsSettings() {
  const locale = await uiLocale();
  const me = await apiFetch<Me>('/api/v1/auth/me').catch(() => null);
  const host = appUrl('membership', process.env);
  const workspaceSlug = me?.workspace?.slug ?? null;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_embeds_title')} description={t(locale, 'embeds_desc')} />
      <div className="mt-8">
        {workspaceSlug ? (
          <EmbedsCard host={host} workspaceSlug={workspaceSlug} locale={locale} />
        ) : (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            {t(locale, 'embeds_need_slug')}
          </p>
        )}
      </div>
    </PageContainer>
  );
}
