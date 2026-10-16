import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { EmailsClient, type StoredTemplate } from './emails-client';

// Members → Settings → Emails (Sjoerd 2ix): a community's own words in its
// welcome email (per tier, or a default) and its calendar digest, per
// language. The facts in each email stay ours.

export default async function EmailSettings() {
  const locale = await uiLocale();
  const [templates, tiers] = await Promise.all([
    apiFetch<{ items: StoredTemplate[] }>('/api/v1/membership/email-templates').then((r) => r.items).catch(() => null),
    apiFetch<{ items: { id: string; name: string; archived_at: string | null }[] }>('/api/v1/membership/tiers')
      .then((r) => r.items.filter((x) => !x.archived_at))
      .catch(() => []),
  ]);
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_emails_title')} description={t(locale, 'st_emails_desc')} />
      <div className="mt-8">
        {templates ? (
          <EmailsClient templates={templates} tiers={tiers.map((x) => ({ id: x.id, name: x.name }))} locale={locale} />
        ) : (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">{t(locale, 'workspace_admins_only')}</p>
        )}
      </div>
    </PageContainer>
  );
}
