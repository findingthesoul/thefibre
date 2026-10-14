import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { loadSettings } from '../shared';
import { NotifyClient, type HeldThread } from './notify-client';

// Whether members are told about the community's team calendars: a thread
// newly on a calendar, a session moved or cancelled (lib/member-notify.ts in
// the API). On by default. Off lets an admin restructure a calendar without
// announcing every step — threads published while it is off are never
// announced afterwards, so switching back on floods nobody.

export default async function NotificationSettings() {
  const locale = await uiLocale();
  const { settings, adminOnly } = await loadSettings();
  // What the circuit breaker held back for a decision. A failed read shows
  // nothing rather than an empty "all clear" — the switch still works.
  const held = adminOnly
    ? []
    : await apiFetch<{ items: HeldThread[] }>('/api/v1/membership/notify-held')
        .then((r) => r.items)
        .catch(() => [] as HeldThread[]);
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_notify_title')} description={t(locale, 'st_notify_desc')} />
      <div className="mt-8">
        {adminOnly ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            {t(locale, 'workspace_admins_only')}
          </p>
        ) : (
          <NotifyClient on={settings?.notify_members ?? true} held={held} locale={locale} />
        )}
      </div>
    </PageContainer>
  );
}
