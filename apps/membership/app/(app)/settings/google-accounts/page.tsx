import { apiFetch, ApiError } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { AccountsClient, type GoogleAccountItem } from './accounts-client';
import { GA_STATUSES, type GaStatus } from './statuses';

// Google Workspace addresses members asked for (builder 4's routes,
// lib/google-account.ts; Sjoerd, 2026-10-16). The Fibre creates nothing in
// Google: the admin creates each account by hand in the Google admin console
// and marks it created here, or declines it. The admin email about a new
// request links to this page, so its path is part of that email.

export const dynamic = 'force-dynamic';

export default async function GoogleAccountsSettings({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const locale = await uiLocale();
  const asked = (await searchParams).status;
  const status: GaStatus = (GA_STATUSES as readonly string[]).includes(asked ?? '') ? (asked as GaStatus) : 'requested';
  // admin-only route: 403 = not an admin. Any other failure says so rather
  // than showing an empty list that reads as "nobody is waiting".
  const res = await apiFetch<{ items: GoogleAccountItem[]; domain: string | null }>(
    `/api/v1/membership/google-accounts?status=${status}`,
  )
    .then((r) => ({ ok: true as const, ...r }))
    .catch((e) => ({ ok: false as const, forbidden: e instanceof ApiError && e.status === 403 }));
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_google_accounts_title')} description={t(locale, 'st_google_accounts_desc')} />
      <div className="mt-8">
        {!res.ok && res.forbidden ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            {t(locale, 'workspace_admins_only')}
          </p>
        ) : (
          <AccountsClient
            status={status}
            items={res.ok ? res.items : null}
            domain={res.ok ? res.domain : null}
            locale={locale}
          />
        )}
      </div>
    </PageContainer>
  );
}
