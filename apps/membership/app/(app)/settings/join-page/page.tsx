import { appUrl } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { JoinPageCard } from '../join-page-card';
import { loadSettings } from '../shared';

type Me = { workspace: { slug: string } | null };

export default async function JoinPageSettings() {
  const locale = await uiLocale();
  const { settings, adminOnly } = await loadSettings();
  const me = await apiFetch<Me>('/api/v1/auth/me').catch(() => null);
  const host = appUrl('membership', process.env);
  const publicUrl = me?.workspace?.slug
    ? `${host}/${encodeURIComponent(me.workspace.slug)}`
    : `${host}/<workspace-slug>`;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_join_title')} description={t(locale, 'join_page_desc')} />
      <div className="mt-8">
        {adminOnly ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            {t(locale, 'workspace_admins_only')}
          </p>
        ) : (
          <JoinPageCard
            joinPage={settings?.join_page ?? {}}
            publicUrl={publicUrl}
            initialLocale={settings?.locale ?? null}
            uiLocale={locale}
          />
        )}
      </div>
    </PageContainer>
  );
}
